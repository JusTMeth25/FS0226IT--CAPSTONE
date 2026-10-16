package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CardTournamentRulesTest {

    private static PvpGame.CardInfo card(String id, int fans, int style, int influence, int energy) {
        return new PvpGame.CardInfo(id, id, "rare", null, "original", false,
                Map.of("fans", fans, "style", style, "influence", influence, "energy", energy), null, 0, null, null, null, 0);
    }

    @Test
    @DisplayName("Il montepremi e' di 1000 gold: 500 al vincitore, 250 al finalista, 125 a ogni semifinalista")
    void prizePool() {
        int[] prizes = CardTournamentService.PRIZES;
        assertEquals(CardTournamentService.PRIZE_POOL, prizes[0] + prizes[1] + 2 * prizes[2]);
        assertEquals(1000, CardTournamentService.PRIZE_POOL);
        assertEquals(16, CardTournamentService.SIZE);
        assertEquals(List.of("Ottavi di finale", "Quarti di finale", "Semifinali", "Finale"), CardTournamentService.ROUND_NAMES);
    }

    @Test
    @DisplayName("Pareggio nel torneo: passa chi ha fatto piu' punti nei tre round")
    void tiebreakOnTotalPoints() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        PvpGame game = new PvpGame(a, "A", b, "B", new Random(1));
        // Stesse carte tranne una: nei round si pareggia sempre o quasi, ma A ha un punto in piu' in tutto.
        game.setTeam(a, List.of(card("a1", 50, 50, 50, 50), card("a2", 50, 50, 50, 50), card("a3", 51, 51, 51, 51)));
        game.setTeam(b, List.of(card("b1", 50, 50, 50, 50), card("b2", 50, 50, 50, 50), card("b3", 50, 50, 50, 50)));
        while (game.phase() != PvpGame.Phase.ENDED) {
            if (game.phase() == PvpGame.Phase.CATEGORY) game.autoCategory();
            game.autoPicks();
            game.resolve();
        }
        if (game.winner() == null) assertEquals(a, PvpService.tiebreakWinner(game, new Random(2)));
        else assertEquals(a, game.winner());
    }

    @Test
    @DisplayName("Pareggio perfetto: si tira a sorte ma passa sempre uno dei due")
    void tiebreakCoinFlip() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        PvpGame game = new PvpGame(a, "A", b, "B", new Random(3));
        List<PvpGame.CardInfo> same = List.of(card("x1", 40, 40, 40, 40), card("x2", 40, 40, 40, 40), card("x3", 40, 40, 40, 40));
        game.setTeam(a, same);
        game.setTeam(b, same);
        while (game.phase() != PvpGame.Phase.ENDED) {
            if (game.phase() == PvpGame.Phase.CATEGORY) game.autoCategory();
            game.autoPicks();
            game.resolve();
        }
        assertEquals(null, game.winner());
        UUID winner = PvpService.tiebreakWinner(game, new Random(4));
        assertEquals(true, winner.equals(a) || winner.equals(b));
    }
}
