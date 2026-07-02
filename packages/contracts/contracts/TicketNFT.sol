// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TicketNFT
 * @notice ERC-721 where transfers are restricted to the approved Marketplace contract.
 *         Tickets can only be resold through our platform — this is enforced on-chain.
 */
contract TicketNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct TicketData {
        uint256 eventId;
        uint256 tierId;
        uint256 faceValueCents; // USD cents
        bool scanned;
    }

    uint256 private _nextTokenId;
    address public marketplaceAddress;
    string private _baseTokenURI;

    mapping(uint256 => TicketData) public ticketData;

    event MarketplaceSet(address indexed marketplace);
    event TicketScanned(uint256 indexed tokenId);

    constructor(address initialAdmin, string memory baseURI) ERC721("BlockchainTicket", "BTIX") {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, initialAdmin);
        _baseTokenURI = baseURI;
    }

    function setMarketplace(address marketplace) external onlyRole(DEFAULT_ADMIN_ROLE) {
        marketplaceAddress = marketplace;
        emit MarketplaceSet(marketplace);
    }

    function setBaseURI(string memory baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }

    function mintTicket(
        address to,
        uint256 eventId,
        uint256 tierId,
        uint256 faceValueCents
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = ++_nextTokenId;
        ticketData[tokenId] = TicketData({
            eventId: eventId,
            tierId: tierId,
            faceValueCents: faceValueCents,
            scanned: false
        });
        _safeMint(to, tokenId);
    }

    function markScanned(uint256 tokenId) external onlyRole(MINTER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        ticketData[tokenId].scanned = true;
        emit TicketScanned(tokenId);
    }

    function getFaceValueCents(uint256 tokenId) external view returns (uint256) {
        return ticketData[tokenId].faceValueCents;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // Override _update (OZ 5.x) to enforce that transfers only happen via minting or marketplace.
    // When the marketplace is transferring, pass auth=address(0) to skip OZ's approval check
    // (the marketplace is owner-controlled and we enforce listing before transfer).
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            require(
                msg.sender == marketplaceAddress,
                "TicketNFT: transfers only via marketplace"
            );
            // Bypass OZ's ERC-721 approval check — marketplace authorization is enforced above
            return super._update(to, tokenId, address(0));
        }
        return super._update(to, tokenId, auth);
    }

    // Required override since both ERC721 and AccessControl define supportsInterface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
}
