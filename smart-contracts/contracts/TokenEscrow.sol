// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenEscrow is ERC1155Holder, ReentrancyGuard {
    IERC1155 public immutable roomNightToken;
    uint256 public saleCounter;

    enum SaleState { Pending, Released, Cancelled }
    struct Sale {
        address seller;
        address buyer;
        uint256 tokenId;
        uint256 quantity;
        SaleState state;
    }
    mapping(uint256 => Sale) public sales;

    event SaleCreated(uint256 indexed saleId, address indexed seller, address indexed buyer, uint256 tokenId, uint256 quantity);
    event SaleReleased(uint256 indexed saleId);
    event SaleCancelled(uint256 indexed saleId);

    constructor(address _roomNightTokenAddress) {
        roomNightToken = IERC1155(_roomNightTokenAddress);
        saleCounter = 1;
    }

    // FIX: Changed 'bytes calldata' to 'bytes memory' to match OpenZeppelin v5
    function onERC1155Received(address, address _from, uint256 _id, uint256 _amount, bytes memory _data) public virtual override returns (bytes4) {
        require(msg.sender == address(roomNightToken), "Not RoomNightToken");
        address buyer = abi.decode(_data, (address));
        require(buyer != address(0), "Invalid Buyer");

        uint256 saleId = saleCounter;
        sales[saleId] = Sale({ seller: _from, buyer: buyer, tokenId: _id, quantity: _amount, state: SaleState.Pending });
        saleCounter++;
        emit SaleCreated(saleId, _from, buyer, _id, _amount);

        return super.onERC1155Received(address(0), _from, _id, _amount, _data);
    }

    function releaseSaleToBuyer(uint256 _saleId) public nonReentrant {
        Sale storage sale = sales[_saleId];
        require(msg.sender == sale.seller, "Not Seller");
        require(sale.state == SaleState.Pending, "Not Pending");

        sale.state = SaleState.Released;
        emit SaleReleased(_saleId);
        roomNightToken.safeTransferFrom(address(this), sale.buyer, sale.tokenId, sale.quantity, "");
    }

    function cancelSale(uint256 _saleId) public nonReentrant {
        Sale storage sale = sales[_saleId];
        require(msg.sender == sale.seller, "Not Seller");
        require(sale.state == SaleState.Pending, "Not Pending");

        sale.state = SaleState.Cancelled;
        emit SaleCancelled(_saleId);
        roomNightToken.safeTransferFrom(address(this), sale.seller, sale.tokenId, sale.quantity, "");
    }
}
