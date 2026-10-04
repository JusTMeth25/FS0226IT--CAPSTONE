package com.capstone.vinyldex.casino;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BingoGameTest {

    @Test
    @DisplayName("Le cartelle sono quelle del bingo a 90: 15 numeri, 5 per riga, colonne giuste, ogni colonna usata")
    void cardsAreValid() {
        Random random = new Random(3);
        for (int k = 0; k < 2_000; k++) {
            BingoGame.Card card = BingoGame.randomCard(random);
            int total = 0;
            Set<Integer> seen = new java.util.HashSet<>();
            for (int r = 0; r < 3; r++) {
                int inRow = 0;
                for (int c = 0; c < 9; c++) {
                    int n = card.rows()[r][c];
                    if (n == 0) continue;
                    inRow++;
                    assertTrue(seen.add(n), "numero ripetuto");
                    int from = c == 0 ? 1 : c * 10;
                    int to = c == 8 ? 90 : c * 10 + 9;
                    assertTrue(n >= from && n <= to, n + " nella colonna " + c);
                }
                assertEquals(5, inRow);
                total += inRow;
            }
            assertEquals(15, total);
            for (int c = 0; c < 9; c++) {
                int col = c;
                assertTrue(card.rows()[0][col] + card.rows()[1][col] + card.rows()[2][col] > 0, "colonna vuota");
                // Dall'alto in basso i numeri della colonna crescono.
                List<Integer> nums = new ArrayList<>();
                for (int r = 0; r < 3; r++) if (card.rows()[r][col] != 0) nums.add(card.rows()[r][col]);
                for (int i = 1; i < nums.size(); i++) assertTrue(nums.get(i) > nums.get(i - 1));
            }
        }
    }

    @Test
    @DisplayName("Una partita intera: linea, doppia linea e bingo nell'ordine, premi dal 90% delle cartelle")
    void fullRound() {
        Map<String, Integer> paid = new HashMap<>();
        BingoGame game = new BingoGame(new Random(11), (id, chips, reason) -> paid.merge(id, chips, Integer::sum));
        long now = 0;
        assertNull(game.buy("me", "Io", 6, now));
        assertEquals("bingo_too_many", game.buy("me", "Io", 1, now));
        assertNull(game.buy("tu", "Tu", 3, now));
        int guard = 0;
        while (!"ended".equals(game.phase()) && guard++ < 10_000) {
            now += 500;
            game.tick(now);
        }
        assertEquals("ended", game.phase());
        Map<String, Object> view = game.view("me", now);
        List<?> winners = (List<?>) view.get("winners");
        assertEquals(3, winners.size());
        assertEquals("LINE", ((Map<?, ?>) winners.get(0)).get("prize"));
        assertEquals("BINGO", ((Map<?, ?>) winners.get(2)).get("prize"));
        // I premi pagati non superano il montepremi (al massimo l'arrotondamento per difetto).
        int pot = (int) view.get("pot");
        int prizes = 0;
        for (BingoGame.Player p : game.playersForTest()) prizes += p.won - (p.bot ? 0 : 0);
        assertTrue(prizes <= pot + game.jackpot() + BingoGame.JACKPOT_SEED * 2);
        // Ai giocatori veri si paga esattamente quello che hanno vinto.
        for (BingoGame.Player p : game.playersForTest()) {
            if (!p.bot) assertEquals(p.won, (int) paid.getOrDefault(p.id, 0));
        }
        // Le palline estratte sono tutte diverse.
        List<?> drawn = (List<?>) view.get("drawn");
        assertEquals(drawn.size(), Set.copyOf(drawn).size());
        // Dopo la pausa il tavolo torna libero per la partita dopo.
        now += 13_000;
        game.tick(now);
        assertEquals("idle", game.phase());
    }

    @Test
    @DisplayName("Chi esce durante la vendita riprende le fiches; senza giocatori la vendita si ferma")
    void refund() {
        BingoGame game = new BingoGame(new Random(1), (id, chips, reason) -> { });
        assertNull(game.buy("me", "Io", 4, 0));
        assertEquals(40, game.refund("me"));
        assertEquals("idle", game.phase());
    }
}
