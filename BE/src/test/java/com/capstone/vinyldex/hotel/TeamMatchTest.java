package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Partita a squadre allo stadio: squadre, tempo, supplementari e sconfitta a tavolino. */
class TeamMatchTest {

    private final UUID a = UUID.randomUUID();
    private final UUID b = UUID.randomUUID();
    private final UUID c = UUID.randomUUID();
    private final UUID d = UUID.randomUUID();

    @Test
    @DisplayName("Al massimo due per squadra, si parte con almeno uno per parte, in partita non si cambia squadra")
    void teams() {
        TeamMatch match = new TeamMatch();
        assertNull(match.join(a, "A", FootballMatch.Team.BLUE));
        assertNull(match.join(b, "B", FootballMatch.Team.BLUE));
        assertEquals("match_team_full", match.join(c, "C", FootballMatch.Team.BLUE));
        assertFalse(match.canStart(), "manca l'avversario");
        assertNull(match.join(c, "C", FootballMatch.Team.RED));
        assertTrue(match.canStart());
        match.start(0);
        assertEquals("match_running", match.join(d, "D", FootballMatch.Team.RED));
        assertEquals(List.of(c), match.players(FootballMatch.Team.RED));
    }

    @Test
    @DisplayName("Pari allo scadere: supplementari, e il primo gol chiude la partita")
    void goldenGoal() {
        TeamMatch match = new TeamMatch();
        match.join(a, "A", FootballMatch.Team.BLUE);
        match.join(b, "B", FootballMatch.Team.RED);
        match.start(0);
        assertEquals(TeamMatch.Outcome.NONE, match.onTick(TeamMatch.LENGTH_MILLIS - 1, 1, 1));
        assertEquals(TeamMatch.Outcome.EXTRA_TIME, match.onTick(TeamMatch.LENGTH_MILLIS, 1, 1));
        assertEquals(TeamMatch.Phase.GOLDEN, match.phase());
        assertEquals(TeamMatch.Outcome.END, match.afterGoal(2, 1));
        assertEquals(FootballMatch.Team.BLUE, match.winner(2, 1));
        match.finish();
        assertFalse(match.playing());
        assertTrue(match.isPlayer(a), "le squadre restano per la rivincita");
    }

    @Test
    @DisplayName("Fine del tempo con un vincitore; supplementari senza gol = pareggio; cinque gol chiudono subito")
    void endings() {
        TeamMatch match = new TeamMatch();
        match.join(a, "A", FootballMatch.Team.BLUE);
        match.join(b, "B", FootballMatch.Team.RED);
        match.start(0);
        assertEquals(TeamMatch.Outcome.NONE, match.afterGoal(4, 0));
        assertEquals(TeamMatch.Outcome.END, match.afterGoal(5, 0));
        assertEquals(TeamMatch.Outcome.END, match.onTick(TeamMatch.LENGTH_MILLIS, 3, 2));

        match.finish();
        match.start(0);
        match.onTick(TeamMatch.LENGTH_MILLIS, 0, 0);
        assertEquals(TeamMatch.Outcome.END, match.onTick(TeamMatch.LENGTH_MILLIS + TeamMatch.GOLDEN_MILLIS, 0, 0));
        assertNull(match.winner(0, 0));
    }

    @Test
    @DisplayName("Una squadra rimasta vuota perde a tavolino")
    void forfeit() {
        TeamMatch match = new TeamMatch();
        match.join(a, "A", FootballMatch.Team.BLUE);
        match.join(b, "B", FootballMatch.Team.RED);
        match.join(c, "C", FootballMatch.Team.RED);
        match.start(0);
        assertEquals(TeamMatch.Outcome.NONE, match.onLeave(b), "resta C nei Rossi");
        assertEquals(TeamMatch.Outcome.END, match.onLeave(a));
        assertEquals(FootballMatch.Team.RED, match.winner(3, 0), "vince chi e' rimasto, anche se perdeva");
    }
}
