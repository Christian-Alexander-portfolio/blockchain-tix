// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./TicketNFT.sol";

/**
 * @title TicketMarketplace
 * @notice Handles secondary market ticket sales with enforced price caps.
 *         Since wallets are custodial, the platform owner (backend deployer) calls buyTicket.
 *         USDC resale payments flow: buyer wallet USDC → this contract → (fee to platform, remainder to seller).
 *         Braintree resale payments are handled off-chain; this contract only transfers the NFT.
 */
contract TicketMarketplace is Ownable, ReentrancyGuard {
    TicketNFT public immutable nft;
    IERC20 public immutable usdc;

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 askPriceCents; // USD cents (matches faceValueCents scale)
        bool active;
        bool isUsdcPayment; // true = USDC on-chain payment; false = off-chain (Braintree)
    }

    uint256 public nextListingId;
    // max resale markup in basis points (e.g. 1500 = 15%)
    uint256 public maxResaleMarkupBps;
    // platform fee in basis points (e.g. 250 = 2.5%)
    uint256 public platformFeeBps;
    address public feeRecipient;

    mapping(uint256 => Listing) public listings;

    event TicketListed(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 askPriceCents
    );
    event TicketSold(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 salePriceCents
    );
    event ListingCancelled(uint256 indexed listingId);
    event MaxMarkupUpdated(uint256 newBps);
    event PlatformFeeUpdated(uint256 newBps);

    constructor(
        address nftAddress,
        address usdcAddress,
        uint256 _platformFeeBps,
        uint256 _maxResaleMarkupBps,
        address _feeRecipient
    ) Ownable(msg.sender) {
        nft = TicketNFT(nftAddress);
        usdc = IERC20(usdcAddress);
        platformFeeBps = _platformFeeBps;
        maxResaleMarkupBps = _maxResaleMarkupBps;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice List a ticket for resale. Called by owner (backend) on behalf of seller.
     * @param tokenId The NFT token to list
     * @param askPriceCents Resale price in USD cents
     * @param seller Address of the custodial wallet selling
     * @param isUsdcPayment Whether payment is on-chain USDC or off-chain Braintree
     */
    function listTicket(
        uint256 tokenId,
        uint256 askPriceCents,
        address seller,
        bool isUsdcPayment
    ) external onlyOwner returns (uint256 listingId) {
        require(nft.ownerOf(tokenId) == seller, "Marketplace: seller does not own token");

        uint256 faceValueCents = nft.getFaceValueCents(tokenId);
        uint256 maxPrice = faceValueCents + (faceValueCents * maxResaleMarkupBps) / 10000;
        require(askPriceCents <= maxPrice, "Marketplace: price exceeds max markup");
        require(askPriceCents >= faceValueCents, "Marketplace: price below face value");

        listingId = nextListingId++;
        listings[listingId] = Listing({
            tokenId: tokenId,
            seller: seller,
            askPriceCents: askPriceCents,
            active: true,
            isUsdcPayment: isUsdcPayment
        });

        emit TicketListed(listingId, tokenId, seller, askPriceCents);
    }

    /**
     * @notice Cancel an active listing. Called by owner (backend) on behalf of seller.
     */
    function cancelListing(uint256 listingId) external onlyOwner {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        listing.active = false;
        emit ListingCancelled(listingId);
    }

    /**
     * @notice Execute an off-chain (Braintree) resale purchase — only transfers the NFT.
     *         Payment was already collected off-chain before this is called.
     * @param listingId The listing to fulfill
     * @param buyer Address of the buyer's custodial wallet
     */
    function fulfillBraintreeSale(uint256 listingId, address buyer)
        external
        onlyOwner
        nonReentrant
    {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(!listing.isUsdcPayment, "Marketplace: use fulfillUsdcSale for USDC listings");

        listing.active = false;
        nft.safeTransferFrom(listing.seller, buyer, listing.tokenId);

        emit TicketSold(listingId, listing.tokenId, buyer, listing.askPriceCents);
    }

    /**
     * @notice Execute an on-chain USDC resale purchase.
     *         Buyer must have approved this contract to spend USDC before calling.
     * @param listingId The listing to fulfill
     * @param buyer Address of the buyer's custodial wallet
     * @param usdcAmount Amount of USDC (6 decimals) to transfer from buyer
     */
    function fulfillUsdcSale(
        uint256 listingId,
        address buyer,
        uint256 usdcAmount
    ) external onlyOwner nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(listing.isUsdcPayment, "Marketplace: use fulfillBraintreeSale for card listings");

        listing.active = false;

        uint256 fee = (usdcAmount * platformFeeBps) / 10000;
        uint256 sellerAmount = usdcAmount - fee;

        // Collect USDC from buyer
        require(usdc.transferFrom(buyer, address(this), usdcAmount), "USDC transfer failed");
        // Pay seller
        require(usdc.transfer(listing.seller, sellerAmount), "Seller payment failed");
        // Fee stays in contract until withdrawn

        // Transfer NFT
        nft.safeTransferFrom(listing.seller, buyer, listing.tokenId);

        emit TicketSold(listingId, listing.tokenId, buyer, listing.askPriceCents);
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        require(usdc.transfer(to, balance), "Withdraw failed");
    }

    function setMaxResaleMarkupBps(uint256 bps) external onlyOwner {
        require(bps <= 10000, "Cannot exceed 100%");
        maxResaleMarkupBps = bps;
        emit MaxMarkupUpdated(bps);
    }

    function setPlatformFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 2000, "Fee cannot exceed 20%");
        platformFeeBps = bps;
        emit PlatformFeeUpdated(bps);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
    }
}
