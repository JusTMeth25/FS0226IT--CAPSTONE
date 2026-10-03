package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.RoomItemRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CardBuybackServiceTest {

    private final UserCardRepository userCards = mock(UserCardRepository.class);
    private final CardRepository cards = mock(CardRepository.class);
    private final RoomItemRepository roomItems = mock(RoomItemRepository.class);
    private final WalletService wallet = mock(WalletService.class);
    private final UserCardService userCardService = mock(UserCardService.class);
    private CardBuybackService service;
    private final User anna = new User();

    private static Card card(String code, String rarity, Double price) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode(code);
        card.setName(code);
        card.setRarity(rarity);
        if (price != null) card.setMetadata(Map.of("marketPrice", price));
        return card;
    }

    @BeforeEach
    void setUp() {
        service = new CardBuybackService(userCards, cards, roomItems, wallet, userCardService);
        anna.setId(UUID.randomUUID());
        when(wallet.adjustGold(eq(anna.getId()), anyInt(), eq(WalletTransactionType.CARD_BUYBACK), anyString(), anyString()))
                .thenAnswer(inv -> {
                    anna.setGold(anna.getGold() + inv.<Integer>getArgument(1));
                    return anna;
                });
    }

    private UserCard owned(Card card, int quantity) {
        UserCard uc = new UserCard(anna, card, quantity);
        when(cards.findByCode(card.getCode())).thenReturn(Optional.of(card));
        when(userCards.findByUserIdAndCardId(anna.getId(), card.getId())).thenReturn(Optional.of(uc));
        return uc;
    }

    @Test
    @DisplayName("Il prezzo sale con il valore di mercato, ma con un tetto per rarita'")
    void quotes() {
        assertEquals(0, CardBuybackService.quote(card("x", "rare", null)), "senza prezzo non si compra");
        assertEquals(3, CardBuybackService.quote(card("c", "common", 0.2)));
        assertEquals(8, CardBuybackService.quote(card("c2", "common", 50.0)), "tetto delle comuni");
        assertEquals(16, CardBuybackService.quote(card("r", "rare", 5.0)));
        assertEquals(400, CardBuybackService.quote(card("l", "legendary", 2_100_000.0)), "tetto delle leggendarie");
        assertTrue(CardBuybackService.quote(card("e", "epic", 100.0)) > CardBuybackService.quote(card("e2", "epic", 10.0)));
    }

    @Test
    @DisplayName("Vendere toglie le copie e accredita i gold")
    void sells() {
        Card rare = card("rara", "rare", 5.0);
        owned(rare, 3);

        CardBuybackService.Sale sale = service.sell(anna.getId(), "rara", 2);

        verify(userCardService).remove(anna, rare, 2);
        assertEquals(32, sale.earned());
    }

    @Test
    @DisplayName("Le preferite tengono una copia e le vetrine le loro")
    void keepsFavoritesAndDisplays() {
        Card rare = card("rara", "rare", 5.0);
        UserCard uc = owned(rare, 2);
        uc.setFavorite(true);
        assertThrows(ApiException.class, () -> service.sell(anna.getId(), "rara", 2));

        uc.setFavorite(false);
        when(roomItems.countByOwnerIdAndCardId(anna.getId(), rare.getId())).thenReturn(2L);
        assertThrows(ApiException.class, () -> service.sell(anna.getId(), "rara", 1));
        verify(userCardService, never()).remove(any(), any(), anyInt());
    }

    @Test
    @DisplayName("Si vende quanto si vuole, senza limiti al giorno")
    void noDailyLimit() {
        Card epic = card("epica", "epic", 1000.0);
        owned(epic, 60);
        int total = 0;
        for (int i = 0; i < 5; i++) total += service.sell(anna.getId(), "epica", 10).earned();
        assertEquals(120 * 50, total);
    }

    @Test
    @DisplayName("La lista mostra solo le carte con un prezzo, dalla piu' pagata")
    void quoteList() {
        UserCard cheap = new UserCard(anna, card("comune", "common", 0.3), 4);
        UserCard rich = new UserCard(anna, card("epica", "epic", 400.0), 1);
        UserCard none = new UserCard(anna, card("senza", "rare", null), 1);
        when(userCards.findByUserIdWithCard(anna.getId())).thenReturn(List.of(cheap, rich, none));

        CardBuybackService.Quotes quotes = service.quotes(anna.getId());

        assertEquals(2, quotes.cards().size());
        assertEquals("epica", quotes.cards().getFirst().card().get("id"));
        assertEquals(4, quotes.cards().get(1).sellable());
    }
}
