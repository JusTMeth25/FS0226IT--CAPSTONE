package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.RoomItemRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Il negozio dell'hotel ricompra le carte che hanno un prezzo di mercato, pagandole in gold.
 *
 * Il prezzo di mercato va da pochi centesimi a milioni di dollari, quindi non si converte in
 * proporzione: si usa la radice quadrata, con un tetto per rarita'. Cosi' una carta preziosa
 * vale piu' di una comune, ma rivendere tutto quello che esce da un pacchetto rende sempre meno
 * di quanto costa il pacchetto: si puo' vendere quanto si vuole senza rompere l'economia.
 */
@Service
public class CardBuybackService {

    /** Gold per la radice quadrata del prezzo in dollari: 4 USD -> 7 gold, 100 USD -> 35 gold. */
    static final double RATE = 3.5;
    /** Gold al massimo per una copia, a seconda della rarita'. */
    static final Map<String, Integer> CAP = Map.of(
            "common", 3, "uncommon", 8, "rare", 20, "epic", 45, "legendary", 120);

    private final UserCardRepository userCardRepository;
    private final CardRepository cardRepository;
    private final RoomItemRepository roomItemRepository;
    private final WalletService walletService;
    private final UserCardService userCardService;

    public CardBuybackService(UserCardRepository userCardRepository, CardRepository cardRepository,
                              RoomItemRepository roomItemRepository, WalletService walletService,
                              UserCardService userCardService) {
        this.userCardRepository = userCardRepository;
        this.cardRepository = cardRepository;
        this.roomItemRepository = roomItemRepository;
        this.walletService = walletService;
        this.userCardService = userCardService;
    }

    /** Gold offerti per una copia; 0 se la carta non ha un prezzo di mercato. */
    public static int quote(Card card) {
        Double price = card.getMarketPrice();
        if (price == null || price <= 0) return 0;
        int gold = (int) Math.round(RATE * Math.sqrt(price));
        return Math.max(1, Math.min(CAP.getOrDefault(card.getRarity(), 3), gold));
    }

    /**
     * Copie che si possono vendere: quelle esposte nelle vetrine della propria stanza restano,
     * e delle preferite se ne tiene sempre almeno una.
     */
    int sellable(UUID userId, UserCard owned) {
        long displayed = roomItemRepository.countByOwnerIdAndCardId(userId, owned.getCard().getId());
        int keep = (int) Math.max(displayed, owned.isFavorite() ? 1 : 0);
        return Math.max(0, owned.getQuantity() - keep);
    }

    public record Offer(Map<String, Object> card, int quantity, int sellable, double marketPrice, int gold) {
    }

    public record Quotes(List<Offer> cards) {
    }

    /** gold: saldo dopo la vendita; earned: gold ricavati; left: copie rimaste. */
    public record Sale(int gold, int earned, int left) {
    }

    /** Le carte della collezione che il negozio compra, dalla piu' pagata. */
    @Transactional(readOnly = true)
    public Quotes quotes(UUID userId) {
        List<Offer> offers = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0 && quote(uc.getCard()) > 0)
                .map(uc -> new Offer(cardView(uc.getCard()), uc.getQuantity(), sellable(userId, uc),
                        uc.getCard().getMarketPrice(), quote(uc.getCard())))
                .sorted(Comparator.comparingInt(Offer::gold).reversed()
                        .thenComparing(Comparator.comparingDouble(Offer::marketPrice).reversed()))
                .toList();
        return new Quotes(offers);
    }

    /** Vende `quantity` copie di una carta (indicata con il code pubblico). */
    @Transactional
    public Sale sell(UUID userId, String cardCode, int quantity) {
        if (quantity < 1) throw ApiException.badRequest("invalid_quantity");
        Card card = cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        int each = quote(card);
        if (each == 0) throw ApiException.badRequest("card_not_buyable");
        UserCard owned = userCardRepository.findByUserIdAndCardId(userId, card.getId())
                .orElseThrow(() -> ApiException.badRequest("card_not_owned"));
        if (sellable(userId, owned) < quantity) throw ApiException.badRequest("card_not_sellable");
        int total = each * quantity;

        User user = owned.getUser();
        userCardService.remove(user, card, quantity);
        user = walletService.adjustGold(userId, total, WalletTransactionType.CARD_BUYBACK, card.getCode(),
                "Negozio: " + quantity + " x " + card.getName());
        return new Sale(user.getGold(), total, owned.getQuantity());
    }

    private static Map<String, Object> cardView(Card card) {
        Map<String, Object> view = new java.util.LinkedHashMap<>();
        view.put("id", card.getCode());
        view.put("name", card.getName());
        view.put("rarity", card.getRarity());
        view.put("img", card.getImgUrl() == null ? "" : card.getImgUrl());
        view.put("source", card.getSource() == null ? "" : card.getSource());
        view.put("fullImage", card.isFullImage());
        view.put("coinPrice", com.capstone.vinyldex.dto.response.CardDto.coinPrice(card));
        return view;
    }
}
