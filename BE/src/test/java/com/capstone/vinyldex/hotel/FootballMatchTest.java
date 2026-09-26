package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Il pallone dello stadio: tiri, rimbalzi, parate, gol e vittoria. */
class FootballMatchTest {

    /** Campo come lo stadio: caselle da (1,1) a (35,23), porte in x=2 e x=34 sulle righe 11-13. */
    private static final class Pitch implements FootballMatch.Field {
        final Set<String> avatars = new HashSet<>();

        @Override
        public boolean ballCanEnter(int x, int y) {
            if (x < 1 || y < 1 || x > 35 || y > 23) return false;
            return !((x == 2 || x == 34) && y >= 11 && y <= 13);
        }

        @Override
        public boolean hasAvatar(int x, int y) {
            return avatars.contains(x + "," + y);
        }
    }

    private static RoomItemView goal(int x) {
        return new RoomItemView(UUID.randomUUID(), null, FootballMatch.GOAL_TYPE, x, 11, 0, 0, null);
    }

    /** Linee del campo come nello stadio: colonne da 3 a 33, righe da 3 a 21. */
    private static final int[] PITCH = {3, 3, 33, 21};

    private static FootballMatch match() {
        return FootballMatch.create(List.of(goal(2), goal(34),
                new RoomItemView(UUID.randomUUID(), null, "bench", 5, 1, 0, 0, null)), PITCH);
    }

    /** Porta il pallone in (x, y) con tiri corti, partendo dal centrocampo (18, 12). */
    private static void placeBall(FootballMatch match, Pitch pitch, int x, int y) {
        // Prima in verticale, poi in orizzontale: lungo la riga delle porte si segnerebbe.
        while (match.ballY() != y) match.kick(match.ballY() < y ? 4 : 0, 1, pitch);
        while (match.ballX() != x) match.kick(match.ballX() < x ? 2 : 6, 1, pitch);
    }

    @Test
    @DisplayName("Senza due porte non c'e' partita; con due porte il pallone parte a centrocampo")
    void create() {
        assertNull(FootballMatch.create(List.of(goal(2)), PITCH));
        FootballMatch match = match();
        assertEquals(18, match.ballX());
        assertEquals(12, match.ballY());
    }

    @Test
    @DisplayName("Il pallone rotola nella direzione del calcio per tante caselle quanta e' la forza")
    void rolls() {
        FootballMatch match = match();
        FootballMatch.Kick kick = match.kick(2, FootballMatch.RUN_POWER, new Pitch());
        assertEquals(6, kick.path().size());
        assertArrayEquals(new int[]{24, 12}, kick.path().get(5));
        assertEquals(24, match.ballX());
        assertNull(kick.scored());
    }

    @Test
    @DisplayName("Sulla linea del campo il pallone torna indietro, in diagonale rimbalza")
    void bounces() {
        Pitch pitch = new Pitch();
        FootballMatch straight = match();
        placeBall(straight, pitch, 18, 4);
        straight.kick(0, 4, pitch);
        assertEquals(18, straight.ballX());
        assertEquals(5, straight.ballY(), "su di uno fino alla linea, rimbalzo, giu' di due");

        FootballMatch diagonal = match();
        placeBall(diagonal, pitch, 18, 4);
        diagonal.kick(1, 4, pitch);
        assertEquals(21, diagonal.ballX(), "verso est continua");
        assertEquals(5, diagonal.ballY(), "verso nord rimbalza e torna giu'");
    }

    @Test
    @DisplayName("Il pallone non esce mai dalle linee del campo, anche con la pista libera intorno")
    void staysInside() {
        Pitch pitch = new Pitch();
        FootballMatch match = match();
        for (int dir = 0; dir < 8; dir++) {
            for (int i = 0; i < 12; i++) {
                match.kick(dir, FootballMatch.RUN_POWER, pitch);
                if (match.inNet()) match.kickOff();
                assertTrue(match.ballX() >= 3 && match.ballX() <= 33 && match.ballY() >= 3 && match.ballY() <= 21,
                        match.ballX() + "," + match.ballY());
            }
        }
    }

    @Test
    @DisplayName("Un avatar sulla traiettoria respinge il pallone con meta' della forza rimasta")
    void save() {
        Pitch pitch = new Pitch();
        pitch.avatars.add("21,12");
        FootballMatch match = match();
        match.kick(2, FootballMatch.RUN_POWER, pitch);
        assertEquals(18, match.ballX(), "19, 20, respinta, 19, 18");

        Pitch crowded = new Pitch();
        crowded.avatars.add("19,12");
        crowded.avatars.add("17,12");
        FootballMatch stuck = match();
        stuck.kick(2, FootballMatch.RUN_POWER, crowded);
        assertEquals(18, stuck.ballX(), "chiuso fra due giocatori resta dov'e'");
    }

    @Test
    @DisplayName("Nella porta est segnano i Blu, poi il pallone torna a centrocampo")
    void goal() {
        Pitch pitch = new Pitch();
        FootballMatch match = match();
        placeBall(match, pitch, 30, 12);
        FootballMatch.Kick kick = match.kick(2, FootballMatch.RUN_POWER, pitch);
        assertEquals(FootballMatch.Team.BLUE, kick.scored());
        assertArrayEquals(new int[]{34, 12}, kick.path().get(kick.path().size() - 1));
        assertEquals(1, match.score(FootballMatch.Team.BLUE));
        assertTrue(match.inNet(), "in rete non si calcia");
        match.kickOff();
        assertFalse(match.inNet());
        assertEquals(18, match.ballX());
        assertEquals(1, match.score(FootballMatch.Team.BLUE), "il punteggio resta");
    }

    @Test
    @DisplayName("Da dietro o di lato la porta e' un palo: niente gol")
    void noGoalFromBehind() {
        Pitch pitch = new Pitch();
        FootballMatch match = match();
        placeBall(match, pitch, 33, 10);
        FootballMatch.Kick kick = match.kick(2, 3, pitch);
        assertNull(kick.scored());
        assertEquals(0, match.score(FootballMatch.Team.BLUE));
    }

    @Test
    @DisplayName("A cinque gol si vince e alla ripresa il punteggio riparte da zero")
    void winner() {
        Pitch pitch = new Pitch();
        FootballMatch match = match();
        for (int i = 0; i < FootballMatch.WINNING_SCORE; i++) {
            placeBall(match, pitch, 5, 12);
            FootballMatch.Kick kick = match.kick(6, FootballMatch.RUN_POWER, pitch);
            assertEquals(FootballMatch.Team.RED, kick.scored());
            if (i < FootballMatch.WINNING_SCORE - 1) assertNull(match.winner());
            match.kickOff();
        }
        assertEquals(0, match.score(FootballMatch.Team.RED), "dopo la vittoria si riparte da 0");
    }

    @Test
    @DisplayName("I calciatori NPC si mettono dietro al pallone rispetto alla porta da attaccare")
    void kickSpot() {
        FootballMatch match = match();
        assertArrayEquals(new int[]{17, 12}, match.kickSpot(FootballMatch.Team.BLUE));
        assertArrayEquals(new int[]{19, 12}, match.kickSpot(FootballMatch.Team.RED));
        assertEquals(FootballMatch.Team.BLUE, match.teamStartingAt(12));
        assertEquals(FootballMatch.Team.RED, match.teamStartingAt(24));
    }
}
