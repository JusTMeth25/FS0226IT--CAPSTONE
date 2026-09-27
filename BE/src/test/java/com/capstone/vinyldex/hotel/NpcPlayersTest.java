package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** NPC giocatori: punteggi da giocatore medio e tetto delle offerte all'asta. */
class NpcPlayersTest {

    private final NpcPlayers players = new NpcPlayers(null, null, null, null, null, null,
            mock(org.springframework.transaction.PlatformTransactionManager.class));

    @Test
    @DisplayName("Punteggi degli NPC fra il 30% e il 75% del massimo del minigioco")
    void scores() {
        int max = Minigames.maxScore("bowling");
        assertEquals(100, max);
        for (int i = 0; i < 200; i++) {
            int score = players.scoreFor("bowling");
            assertTrue(score >= 30 && score <= 75, "punteggio " + score);
        }
        assertEquals(0, players.scoreFor("gioco-inesistente"));
    }

    @Test
    @DisplayName("Asta: l'NPC non offre oltre un tetto vicino al valore della carta, sempre uguale per lo stesso lotto")
    void auctionCap() {
        Card card = new Card();
        card.setRarity("epic");
        UUID lot = UUID.randomUUID();
        int cap = AuctionService.npcCap(card, lot);
        assertEquals(cap, AuctionService.npcCap(card, lot));
        int value = Math.max(20, NpcDeals.value(card));
        assertTrue(cap >= Math.round(value * 0.9) && cap <= Math.round(value * 1.3), "tetto " + cap + " valore " + value);
    }

    @Test
    @DisplayName("I personaggi che giocano esistono tutti nell'hotel")
    void rosterKeys() {
        NpcPlayers.KEYS.forEach(key -> assertTrue(NpcRoster.byKey(key).isPresent(), key));
    }
}
