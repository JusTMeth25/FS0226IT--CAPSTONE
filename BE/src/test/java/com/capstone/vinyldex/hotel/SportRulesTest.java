package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Regole delle gare di go-kart, dei tornei e della stagione sportiva. */
class SportRulesTest {

    private final UUID a = UUID.randomUUID();
    private final UUID b = UUID.randomUUID();
    private final UUID c = UUID.randomUUID();

    @Test
    @DisplayName("Kart: chi sale entro la griglia parte con gli altri, chi arriva dopo il via corre da solo")
    void kartGrid() {
        KartRace race = new KartRace();
        long t0 = 1_000_000;
        long start = race.join(a, "anna", t0);
        assertEquals(t0 + KartRace.GATHER_MILLIS, start);
        assertEquals(start, race.join(b, "bruno", t0 + 3_000), "stessa partenza");
        assertEquals(t0 + KartRace.GATHER_MILLIS + 10 + KartRace.SOLO_START_MILLIS, race.join(c, "carla", t0 + KartRace.GATHER_MILLIS + 10));
        assertTrue(race.isRacer(a) && race.isRacer(b));
        assertTrue(!race.isRacer(c), "a cronometro, fuori dalla gara");
    }

    @Test
    @DisplayName("Kart: classifica per punti a gara finita, i ritirati in fondo; da soli nessuna classifica")
    void kartRanking() {
        KartRace race = new KartRace();
        race.join(a, "anna", 0);
        race.join(b, "bruno", 0);
        race.join(c, "carla", 0);
        race.finish(a, 200);
        assertNull(race.ended(KartRace.GATHER_MILLIS + 1), "mancano ancora due piloti");
        race.finish(b, 230);
        race.leave(c);
        List<KartRace.Placing> ranking = race.ended(KartRace.GATHER_MILLIS + 2);
        assertNotNull(ranking);
        assertEquals(List.of(b, a, c), ranking.stream().map(KartRace.Placing::id).toList());
        assertNull(race.ended(KartRace.GATHER_MILLIS + 3), "si chiude una volta sola");

        KartRace solo = new KartRace();
        solo.join(a, "anna", 0);
        solo.finish(a, 180);
        assertEquals(List.of(), solo.ended(KartRace.GATHER_MILLIS + 1));
    }

    @Test
    @DisplayName("Torneo: con 5 iscritti il tabellone e' da 8, tre passano il turno e nessuno gioca contro due vuoti")
    void bracket() {
        List<UUID> players = new ArrayList<>();
        for (int i = 0; i < 5; i++) players.add(UUID.randomUUID());
        List<UUID[]> pairs = TournamentService.firstRound(players, new Random(1));
        assertEquals(4, pairs.size());
        assertEquals(3, pairs.stream().filter(p -> p[1] == null).count());
        Set<UUID> seen = new HashSet<>();
        pairs.forEach(p -> {
            assertNotNull(p[0]);
            seen.add(p[0]);
            if (p[1] != null) seen.add(p[1]);
        });
        assertEquals(5, seen.size(), "tutti in tabellone, una volta sola");
        assertEquals(4, TournamentService.firstRound(players.subList(0, 4), new Random(1)).stream().mapToInt(p -> p[1] == null ? 1 : 2).sum());
    }

    @Test
    @DisplayName("Torneo: passa chi fa di piu', chi non gioca perde, chi passa il turno avanza")
    void decide() {
        Random random = new Random(2);
        assertEquals(a, TournamentService.decide(a, b, 90, 70, random));
        assertEquals(b, TournamentService.decide(a, b, null, 10, random));
        assertEquals(a, TournamentService.decide(a, null, null, null, random));
        UUID either = TournamentService.decide(a, b, null, null, random);
        assertTrue(either.equals(a) || either.equals(b));
    }

    @Test
    @DisplayName("Stagione: da 1 a 10 punti per partita in proporzione, niente per giochi non sportivi")
    void seasonPoints() {
        assertEquals(10, SeasonService.pointsFor("bowling", 100));
        assertEquals(5, SeasonService.pointsFor("bowling", 50));
        assertEquals(1, SeasonService.pointsFor("basket", 1));
        assertEquals(10, SeasonService.pointsFor("golf3", 6));
        assertEquals(0, SeasonService.pointsFor("claw", 3));
        assertEquals(0, SeasonService.pointsFor("pong", 0));
    }
}
