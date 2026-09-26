package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.NpcTrade;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.NpcTradeRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.repository.UserWalletTransactionRepository;
import com.capstone.vinyldex.service.LevelService;
import com.capstone.vinyldex.service.UserCardService;
import com.capstone.vinyldex.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NpcDealsTest {

    private final CardRepository cards = mock(CardRepository.class);
    private final UserCardRepository userCards = mock(UserCardRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserCardService userCardService = mock(UserCardService.class);
    private final NpcTradeRepository npcTrades = mock(NpcTradeRepository.class);
    private NpcDeals deals;
    private final List<Card> pool = new ArrayList<>();
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
        anna.setId(UUID.randomUUID());
        for (String rarity : List.of("common", "uncommon", "rare", "epic", "legendary")) {
            for (int i = 0; i < 6; i++) pool.add(card(rarity + i, rarity, null));
        }
        when(cards.findAllActiveWithArtistClass()).thenReturn(pool);
        pool.forEach(c -> when(cards.findByCode(c.getCode())).thenReturn(Optional.of(c)));
        when(users.findById(anna.getId())).thenReturn(Optional.of(anna));
        deals = new NpcDeals(cards, userCards, users, userCardService, mock(WalletService.class),
                mock(LevelService.class), mock(UserWalletTransactionRepository.class), npcTrades);
    }

    @Test
    @DisplayName("Il valore sale con la rarita' e con il prezzo di mercato")
    void cardValue() {
        assertTrue(NpcDeals.value(card("l", "legendary", null)) > NpcDeals.value(card("e", "epic", null)));
        assertTrue(NpcDeals.value(card("r", "rare", 20.0)) > NpcDeals.value(card("r2", "rare", null)));
    }

    @Test
    @DisplayName("La vetrina di un NPC e' la stessa per tutta la giornata")
    void showcaseIsStable() {
        UUID npc = UUID.randomUUID();
        List<String> first = deals.showcase(npc).stream().map(Card::getCode).toList();
        assertEquals(first, deals.showcase(npc).stream().map(Card::getCode).toList());
        assertTrue(first.size() >= 4);
    }

    @Test
    @DisplayName("Le carte trovate nei pacchetti entrano nella vetrina dell'NPC e ne escono se le scambia")
    void foundCardsGoOnShowcase() {
        UUID npc = UUID.randomUUID();
        Card found = card("trovata", "legendary", null);
        pool.add(found);
        when(cards.findByCode("trovata")).thenReturn(Optional.of(found));
        deals.addFound(npc, List.of(card("scarsa", "common", 0.1), found));
        assertEquals("trovata", deals.showcase(npc).get(0).getCode(), "la piu' preziosa per prima");
        assertEquals(2, deals.found(npc).size());
        for (int i = 0; i < 5; i++) deals.addFound(npc, List.of(card("altra" + i, "rare", null)));
        assertEquals(NpcDeals.FOUND_KEPT, deals.found(npc).size(), "se ne tengono solo le ultime");

        deals.addFound(npc, List.of(found));
        when(userCardService.owns(any(), any(), eq(1))).thenReturn(true);
        assertEquals(NpcDeals.Verdict.ACCEPTED, deals.propose(npc, "Dario", anna.getId(), "legendary0", "trovata"));
        assertTrue(deals.found(npc).stream().noneMatch(c -> c.getCode().equals("trovata")), "scambiata, non e' piu' sua");
    }

    @Test
    @DisplayName("L'NPC accetta solo scambi equi e mai carte che non sono nella sua vetrina")
    void proposalsMustBeFair() {
        UUID npc = UUID.randomUUID();
        Card best = deals.showcase(npc).stream().max((a, b) -> NpcDeals.value(a) - NpcDeals.value(b)).orElseThrow();

        assertEquals(NpcDeals.Verdict.UNFAIR, deals.propose(npc, "Dario", anna.getId(), "common0", best.getCode()));
        assertEquals(NpcDeals.Verdict.NOT_OFFERED, deals.propose(npc, "Dario", anna.getId(), "legendary0", "carta-inventata"));
        verify(userCardService, never()).remove(any(), any(), eq(1));

        when(userCardService.owns(any(), any(), eq(1))).thenReturn(true);
        assertEquals(NpcDeals.Verdict.ACCEPTED, deals.propose(npc, "Dario", anna.getId(), "legendary0", best.getCode()));
        verify(userCardService).remove(eq(anna), any(), eq(1));
        verify(userCardService).add(eq(anna), eq(best), eq(1));
    }

    @Test
    @DisplayName("Ogni scambio finisce nel database, e il limite giornaliero si conta da li'")
    void dailyLimit() {
        when(userCardService.owns(any(), any(), eq(1))).thenReturn(true);
        assertEquals(NpcDeals.Verdict.ACCEPTED, deals.trade(anna.getId(), "Dario", "common0", "common1"));
        ArgumentCaptor<NpcTrade> saved = ArgumentCaptor.forClass(NpcTrade.class);
        verify(npcTrades).save(saved.capture());
        assertEquals(anna.getId(), saved.getValue().getUserId());
        assertEquals("Dario", saved.getValue().getNpcName());
        assertEquals(LocalDate.now(), saved.getValue().getDay());

        // Dopo un riavvio conta quello che c'e' nel database, non la memoria.
        when(npcTrades.countByUserIdAndDay(anna.getId(), LocalDate.now())).thenReturn((long) NpcDeals.TRADES_PER_DAY);
        assertEquals(NpcDeals.TRADES_PER_DAY, deals.tradesToday(anna.getId()));
        assertEquals(NpcDeals.Verdict.LIMIT, deals.trade(anna.getId(), "Dario", "common0", "common1"));
        verify(npcTrades).save(any());
    }

    @Test
    @DisplayName("L'NPC chiede una carta doppia e offre una carta nuova di valore almeno pari")
    void offersAreAttractive() {
        Card doubled = pool.get(8);
        when(userCards.findByUserIdWithCard(anna.getId())).thenReturn(List.of(
                new UserCard(anna, doubled, 3), new UserCard(anna, pool.get(0), 1)));
        NpcDeals.Offer offer = deals.makeOffer(anna.getId(), new Random(3)).orElseThrow();
        assertEquals(doubled, offer.want());
        assertTrue(NpcDeals.value(offer.give()) >= NpcDeals.value(doubled));
        assertFalse(offer.give().equals(pool.get(0)), "offre una carta che non ha");
    }
}
