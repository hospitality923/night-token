// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract RoomNightToken is ERC1155, Ownable, ERC1155Burnable, Pausable, ERC1155Holder {
    mapping(uint256 => RoomTypeInfo) public roomTypeInfo;
    uint256 public nextTokenId;

    struct RoomTypeInfo {
        string hotelId;
        string roomName;
        bool isDefined;
    }

    event BookingRedeemed(address indexed redeemedBy, uint256 indexed tokenId, uint256 quantity, string bookingDetails);

    constructor(address initialOwner, string memory _uri) ERC1155(_uri) Ownable(initialOwner) {
        nextTokenId = 1;
    }

    function pause() public onlyOwner { _pause(); }
    function unpause() public onlyOwner { _unpause(); }

    function createRoomType(string memory _hotelId, string memory _roomName) public onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        roomTypeInfo[tokenId] = RoomTypeInfo({ hotelId: _hotelId, roomName: _roomName, isDefined: true });
        return tokenId;
    }

    function mintTokens(address _to, uint256 _tokenId, uint256 _quantity, bytes memory _data) public onlyOwner whenNotPaused {
        require(roomTypeInfo[_tokenId].isDefined, "Token ID does not exist");
        _mint(_to, _tokenId, _quantity, _data);
    }

    function redeem(uint256 _tokenId, uint256 _quantity, string memory _bookingDetails) public whenNotPaused {
        _burn(_msgSender(), _tokenId, _quantity);
        emit BookingRedeemed(_msgSender(), _tokenId, _quantity, _bookingDetails);
    }

    function setURI(string memory newuri) public onlyOwner { _setURI(newuri); }

    // FIX: Explicit override to resolve conflict between ERC1155 and ERC1155Holder
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
