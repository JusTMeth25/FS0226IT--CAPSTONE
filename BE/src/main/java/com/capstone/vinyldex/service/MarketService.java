package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.MarketListingDto;
import com.capstone.vinyldex.entity.*;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.MarketListingRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Mercato fra giocatori.
 *
 * Le carte messe in vendita escono subito dalla collezione del venditore: finche' l'inserzione
 * e' attiva sono in deposito. Annullarla le restituisce, venderle le passa all'acquirente.
 * Senza questo deposito lo stesso esemplare potrebbe essere venduto due volte.
 */
@Service
public class MarketService {

    private final MarketListingRepository listingRepository;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final UserCardService userCardService;
    private final WalletService walletService;
    private final MissionEngine missionEngine;

    public MarketService(MarketListingRepository listingRepository,
                         CardRepository cardRepository,
                         UserRepository userRepository,
                         UserCardService userCardService,
                         WalletService walletService,
                         MissionEngine missionEngine) {
        this.listingRepository = listingRepository;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.userCardService = userCardService;
        this.walletService = walletService;
        this.missionEngine = missionEngine;
    }

    /** Vetrina pubblica delle inserzioni attive. cardId, se presente, e' il code della carta. */
    @Transactional(readOnly = true)
    public List<MarketListingDto> listActive(String rarity, String cardId) {
        UUID cardUuid = null;
        if (cardId != null && !cardId.isBlank()) {
            // Carta inesistente: nessuna inserzione puo' corrispondere, si restituisce vuoto.
            cardUuid = cardRepository.findByCode(cardId).map(Card::getId).orElse(null);
            if (cardUuid == null) return List.of();
        }

        return listingRepository.findActive(
                        rarity == null || rarity.isBlank() ? null : rarity, cardUuid).stream()
                .map(MarketListingDto::from)
                .toList();
    }

    /** Pubblica un'inserzione e mette in deposito le copie vendute. */
    @Transactional
    public MarketListingDto createListing(UUID sellerId, String cardCode, int quantity, int pricePerUnit) {
        Card card = cardRepository.findByCode(cardCode)
                .orElseThrow(() -> ApiException.notFound("card_not_found"));
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        userCardService.remove(seller, card, quantity);

        MarketListing listing = new MarketListing();
        listing.setSeller(seller);
        listing.setCard(card);
        listing.setQuantity(quantity);
        listing.setPricePerUnit(pricePerUnit);
        listing.setStatus(MarketListingStatus.ACTIVE);

        return MarketListingDto.from(listingRepository.save(listing));
    }

    /** Acquisto: gold dall'acquirente al venditore, carte dal deposito all'acquirente. */
    @Transactional
    public BuyResult buy(UUID buyerId, UUID listingId, int quantity) {
        MarketListing listing = listingRepository.findById(listingId)
                .filter(l -> l.getStatus() == MarketListingStatus.ACTIVE)
                .orElseThrow(() -> ApiException.notFound("listing_not_available"));

        if (listing.getSeller().getId().equals(buyerId)) {
            throw ApiException.badRequest("cannot_buy_own_listing");
        }
        if (quantity <= 0 || quantity > listing.getQuantity()) {
            throw ApiException.badRequest("invalid_quantity");
        }

        User buyer = userRepository.findById(buyerId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        int total = listing.getPricePerUnit() * quantity;
        String relatedId = listing.getId().toString();

        // L'addebito viene prima: se il saldo non basta la transazione salta qui e il venditore
        // non viene mai accreditato.
        walletService.adjustGold(buyerId, -total, WalletTransactionType.MARKET_PURCHASE, relatedId);
        walletService.adjustGold(listing.getSeller().getId(), total, WalletTransactionType.MARKET_SALE, relatedId);

        userCardService.add(buyer, listing.getCard(), quantity);

        int remaining = listing.getQuantity() - quantity;
        listing.setQuantity(remaining);
        listing.setStatus(remaining <= 0 ? MarketListingStatus.SOLD : MarketListingStatus.ACTIVE);
        listingRepository.save(listing);

        missionEngine.incrementByType(buyer, MissionType.BUY_MARKET, 1);
        missionEngine.incrementByType(listing.getSeller(), MissionType.SELL_MARKET, 1);
        missionEngine.recomputeAbsolute(buyer);

        int gold = userRepository.findById(buyerId).map(User::getGold).orElse(buyer.getGold());
        return new BuyResult(MarketListingDto.from(listing), gold);
    }

    /** Il venditore ritira l'inserzione: le copie in deposito tornano nella sua collezione. */
    @Transactional
    public void cancelListing(UUID sellerId, UUID listingId) {
        MarketListing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> ApiException.notFound("listing_not_found"));

        if (!listing.getSeller().getId().equals(sellerId)) {
            throw ApiException.forbidden("forbidden");
        }
        if (listing.getStatus() != MarketListingStatus.ACTIVE) {
            throw ApiException.badRequest("listing_not_active");
        }

        userCardService.add(listing.getSeller(), listing.getCard(), listing.getQuantity());
        listing.setStatus(MarketListingStatus.CANCELLED);
        listingRepository.save(listing);
    }

    public record BuyResult(MarketListingDto listing, int gold) {
    }
}
