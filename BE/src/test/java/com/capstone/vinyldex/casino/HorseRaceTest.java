package com.capstone.vinyldex.casino;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HorseRaceTest {

    private static long run(HorseRace race, long now, String until) {
        int guard = 0;
        while (!until.equals(race.phase()) && guard++ < 100_000) {
            now += 250;
            race.tick(now);
        }
        return now;
    }

    @Test
    @DisplayName("Le probabilita' tornano: vincente somma 1, piazzato 3, accoppiate 1, trii 1")
    void probabilitiesAddUp() {
        HorseRace race = new HorseRace(new Random(4), (id, chips, reason) -> { });
        race.tick(0);
        List<HorseRace.Horse> horses = race.horsesForTest();
        double win = 0, place = 0, exacta = 0, trifecta = 0;
        for (HorseRace.Horse a : horses) {
            win += race.probability(HorseRace.Type.WIN, new int[]{a.number});
            place += race.probability(HorseRace.Type.PLACE, new int[]{a.number});
            for (HorseRace.Horse b : horses) {
                if (b == a) continue;
                exacta += race.probability(HorseRace.Type.EXACTA, new int[]{a.number, b.number});
                for (HorseRace.Horse c : horses) {
                    if (c == a || c == b) continue;
                    trifecta += race.probability(HorseRace.Type.TRIFECTA, new int[]{a.number, b.number, c.number});
                }
            }
        }
        assertEquals(1, win, 1e-9);
        assertEquals(3, place, 1e-9);
        assertEquals(1, exacta, 1e-9);
        assertEquals(1, trifecta, 1e-9);
    }

    @Test
    @DisplayName("Su 20.000 corse il favorito vince quanto dice la quota e il banco tiene circa il 12%")
    void oddsAreFair() {
        Random random = new Random(7);
        double staked = 0, returned = 0;
        int favoriteWins = 0;
        double favoriteP = 0;
        long now = 0;
        Map<String, Integer> paid = new HashMap<>();
        HorseRace race = new HorseRace(random, (id, chips, reason) -> paid.merge(id, chips, Integer::sum));
        race.tick(now);
        for (int r = 0; r < 20_000; r++) {
            now = run(race, now, "betting");
            HorseRace.Horse fav = race.horsesForTest().stream().max((a, b) -> Double.compare(a.p, b.p)).orElseThrow();
            favoriteP += fav.p;
            // Si punta sempre 10 sul favorito (vincente) e 10 su un trio a caso.
            assertNull(race.bet("me", "Io", HorseRace.Type.WIN, new int[]{fav.number}, 10));
            int a = 1 + random.nextInt(8), b, c;
            do b = 1 + random.nextInt(8); while (b == a);
            do c = 1 + random.nextInt(8); while (c == a || c == b);
            assertNull(race.bet("me", "Io", HorseRace.Type.TRIFECTA, new int[]{a, b, c}, 10));
            staked += 20;
            now = run(race, now, "result");
            if (race.order()[0] == fav.number) favoriteWins++;
        }
        returned = paid.getOrDefault("me", 0);
        assertEquals(favoriteP / 20_000, favoriteWins / 20_000.0, 0.012, "il favorito vince con la sua probabilita'");
        double rtp = returned / staked;
        assertTrue(rtp > 0.78 && rtp < 0.98, "ritorno " + rtp);
    }

    @Test
    @DisplayName("Ciclo completo: niente puntate durante la corsa, ordine d'arrivo coerente coi tempi, vincite pagate")
    void fullCycle() {
        Map<String, Integer> paid = new HashMap<>();
        HorseRace race = new HorseRace(new Random(21), (id, chips, reason) -> paid.merge(id, chips, Integer::sum));
        long now = 0;
        race.tick(now);
        assertEquals("horse_bad_stake", race.bet("me", "Io", HorseRace.Type.WIN, new int[]{1}, 1));
        assertEquals("horse_bad_bet", race.bet("me", "Io", HorseRace.Type.EXACTA, new int[]{1, 1}, 10));
        assertEquals("horse_bad_bet", race.bet("me", "Io", HorseRace.Type.WIN, new int[]{9}, 10));
        // Piazzato su tutti gli otto: tre vincono per forza.
        for (int n = 1; n <= 8; n++) assertNull(race.bet("me", "Io", HorseRace.Type.PLACE, new int[]{n}, 10));
        Map<String, Object> before = race.view("me", now);
        assertNull(((List<Map<String, Object>>) before.get("horses")).getFirst().get("finishMs"), "la corsa non si vede prima");
        now = run(race, now, "racing");
        assertEquals("horse_not_betting", race.bet("me", "Io", HorseRace.Type.WIN, new int[]{1}, 10));
        Map<String, Object> racing = race.view("me", now);
        assertNotNull(((List<Map<String, Object>>) racing.get("horses")).getFirst().get("finishMs"));
        now = run(race, now, "result");
        int[] order = race.order();
        long last = 0;
        for (int number : order) {
            long t = race.horsesForTest().stream().filter(h -> h.number == number).findFirst().orElseThrow().finishMs;
            assertTrue(t > last, "arrivano nell'ordine dei tempi");
            last = t;
        }
        int expected = 0;
        for (int i = 0; i < 3; i++) {
            int n = order[i];
            expected += (int) Math.floor(10 * race.oddsOf(HorseRace.Type.PLACE, new int[]{n}));
        }
        assertEquals(expected, paid.get("me"));
        assertEquals(expected, race.view("me", now).get("myWon"));
        // Dopo il risultato riparte da sola con un campo nuovo.
        now = run(race, now, "betting");
        assertEquals(2, race.view("me", now).get("round"));
        assertTrue(((List<?>) race.view("me", now).get("myBets")).isEmpty());
    }

    @Test
    @DisplayName("Server spento prima dell'arrivo: le poste tornano indietro")
    void refund() {
        HorseRace race = new HorseRace(new Random(2), (id, chips, reason) -> { });
        race.tick(0);
        assertNull(race.bet("me", "Io", HorseRace.Type.WIN, new int[]{3}, 50));
        assertNull(race.bet("me", "Io", HorseRace.Type.EXACTA, new int[]{3, 4}, 20));
        assertEquals(Map.of("me", 70), race.refundAll());
    }
}
