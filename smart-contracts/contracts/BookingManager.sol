// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // Import Ownable

/**
 * @title BookingManager
 * @notice Handles the lifecycle of a hotel booking: 
 * Reserve (Lock) -> Check-In (Burn) OR Cancel (Refund)
 */
contract BookingManager is ERC1155Holder, ReentrancyGuard, Ownable { // Inherit Ownable
    IERC1155 public immutable roomNightToken;
    uint256 public bookingCounter;

    enum BookingStatus { Active, Completed, Cancelled }

    struct Booking {
        uint256 id;
        address guest;
        uint256 tokenId;
        uint256 quantity;
        string details; // Date, Guest Name, etc.
        BookingStatus status;
    }

    mapping(uint256 => Booking) public bookings;
    uint256[] public allBookingIds;

    event RoomBooked(uint256 indexed bookingId, address indexed guest, uint256 tokenId, uint256 quantity, string details);
    event StayCompleted(uint256 indexed bookingId);
    event BookingCancelled(uint256 indexed bookingId);

    // Pass msg.sender to Ownable constructor
    constructor(address _roomNightTokenAddress) Ownable(msg.sender) {
        roomNightToken = IERC1155(_roomNightTokenAddress);
        bookingCounter = 1;
    }

    // 1. Guest creates a booking (Locks tokens in this contract)
    // NOTE: User must setApprovalForAll(this_contract, true) on the Token contract first!
    function bookRoom(uint256 _tokenId, uint256 _quantity, string memory _details) public nonReentrant {
        _bookRoom(_tokenId, _quantity, _details, msg.sender);
    }

    // 2. Admin books on behalf of a guest (Invisible Wallet)
    // The tokens are transferred from the ADMIN (msg.sender) to the BookingManager, 
    // but the booking is recorded for the GUEST.
    function bookRoomFor(uint256 _tokenId, uint256 _quantity, string memory _details, address _guest) public nonReentrant onlyOwner {
        _bookRoom(_tokenId, _quantity, _details, _guest);
    }

    // Internal helper to avoid code duplication
    function _bookRoom(uint256 _tokenId, uint256 _quantity, string memory _details, address _guest) internal {
        require(_quantity > 0, "Qty must be > 0");
        
        // Transfer tokens from Sender (Guest or Admin) to This Contract
        roomNightToken.safeTransferFrom(msg.sender, address(this), _tokenId, _quantity, "");

        uint256 bookingId = bookingCounter;
        bookings[bookingId] = Booking({
            id: bookingId,
            guest: _guest, // Record the actual guest as the owner
            tokenId: _tokenId,
            quantity: _quantity,
            details: _details,
            status: BookingStatus.Active
        });
        
        allBookingIds.push(bookingId);
        bookingCounter++;

        emit RoomBooked(bookingId, _guest, _tokenId, _quantity, _details);
    }

    // 3. Hotel confirms Check-In (Burns the tokens)
    function completeStay(uint256 _bookingId) public nonReentrant {
        Booking storage booking = bookings[_bookingId];
        require(booking.status == BookingStatus.Active, "Not Active");

        // Burn the tokens (Revenue Recognized)
        // We use the interface to call burn. We cast to a Burnable interface or use low-level call.
        IBurnable(address(roomNightToken)).burn(address(this), booking.tokenId, booking.quantity);

        booking.status = BookingStatus.Completed;
        emit StayCompleted(_bookingId);
    }

    // 4. Cancel Booking (Refunds the tokens)
    function cancelBooking(uint256 _bookingId) public nonReentrant {
        Booking storage booking = bookings[_bookingId];
        require(booking.status == BookingStatus.Active, "Not Active");
        
        // Refund tokens to Guest
        roomNightToken.safeTransferFrom(address(this), booking.guest, booking.tokenId, booking.quantity, "");

        booking.status = BookingStatus.Cancelled;
        emit BookingCancelled(_bookingId);
    }

    function getBookingCount() public view returns (uint256) {
        return allBookingIds.length;
    }
}

interface IBurnable {
    function burn(address account, uint256 id, uint256 value) external;
}
