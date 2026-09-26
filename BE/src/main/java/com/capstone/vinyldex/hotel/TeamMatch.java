package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Partita vera allo stadio, fino a due contro due. I giocatori scelgono la squadra, poi uno avvia
 * la partita: tre minuti, e durante la partita calciano solo loro (gli NPC si fanno da parte).
 * Se allo scadere e' pari si va ai supplementari con il golden goal: il primo gol vince. Se una
 * squadra resta senza giocatori perde a tavolino. Arrivare a cinque gol chiude subito la partita.
 */
final class TeamMatch {

    static final int PER_TEAM = 2;
    static final long LENGTH_MILLIS = 180_000;
    static final long GOLDEN_MILLIS = 60_000;

    enum Phase { LOBBY, PLAYING, GOLDEN }

    enum Outcome { NONE, EXTRA_TIME, END }

    private final Map<UUID, FootballMatch.Team> teams = new LinkedHashMap<>();
    private final Map<UUID, String> names = new LinkedHashMap<>();
    private Phase phase = Phase.LOBBY;
    private long endsAt;
    /** Squadra che ha vinto a tavolino (l'altra e' rimasta vuota). */
    private FootballMatch.Team forfeitWinner;

    Phase phase() {
        return phase;
    }

    boolean playing() {
        return phase != Phase.LOBBY;
    }

    long endsAt() {
        return endsAt;
    }

    boolean isPlayer(UUID id) {
        return teams.containsKey(id);
    }

    FootballMatch.Team teamOf(UUID id) {
        return teams.get(id);
    }

    List<UUID> players(FootballMatch.Team team) {
        List<UUID> result = new ArrayList<>();
        teams.forEach((id, t) -> {
            if (t == team) result.add(id);
        });
        return result;
    }

    /**
     * Entra in una squadra (team null = esce). Durante la partita non si cambia squadra.
     *
     * @return null se va bene, altrimenti il codice dell'errore
     */
    String join(UUID id, String name, FootballMatch.Team team) {
        if (playing()) return "match_running";
        if (team == null) {
            teams.remove(id);
            names.remove(id);
            return null;
        }
        if (team != teams.get(id) && players(team).size() >= PER_TEAM) return "match_team_full";
        teams.put(id, team);
        names.put(id, name);
        return null;
    }

    boolean canStart() {
        return !playing() && !players(FootballMatch.Team.BLUE).isEmpty() && !players(FootballMatch.Team.RED).isEmpty();
    }

    void start(long now) {
        phase = Phase.PLAYING;
        endsAt = now + LENGTH_MILLIS;
        forfeitWinner = null;
    }

    /** Dopo un gol: nei supplementari chiude la partita, e cosi' a cinque gol. */
    Outcome afterGoal(int blue, int red) {
        if (!playing()) return Outcome.NONE;
        if (phase == Phase.GOLDEN || blue >= FootballMatch.WINNING_SCORE || red >= FootballMatch.WINNING_SCORE) return Outcome.END;
        return Outcome.NONE;
    }

    /** Controllo del tempo: allo scadere supplementari se e' pari, altrimenti fine. */
    Outcome onTick(long now, int blue, int red) {
        if (!playing() || now < endsAt) return Outcome.NONE;
        if (phase == Phase.PLAYING && blue == red) {
            phase = Phase.GOLDEN;
            endsAt = now + GOLDEN_MILLIS;
            return Outcome.EXTRA_TIME;
        }
        return Outcome.END;
    }

    /** Un giocatore se ne va: se la sua squadra resta vuota a partita in corso, vince l'altra. */
    Outcome onLeave(UUID id) {
        FootballMatch.Team team = teams.remove(id);
        names.remove(id);
        if (team == null || !playing()) return Outcome.NONE;
        if (players(team).isEmpty()) {
            forfeitWinner = team == FootballMatch.Team.BLUE ? FootballMatch.Team.RED : FootballMatch.Team.BLUE;
            return Outcome.END;
        }
        return Outcome.NONE;
    }

    /** Chi ha vinto (null = pareggio). */
    FootballMatch.Team winner(int blue, int red) {
        if (forfeitWinner != null) return forfeitWinner;
        if (blue == red) return null;
        return blue > red ? FootballMatch.Team.BLUE : FootballMatch.Team.RED;
    }

    /** Fine partita: si torna in attesa, le squadre restano per la rivincita. */
    void finish() {
        phase = Phase.LOBBY;
        endsAt = 0;
        forfeitWinner = null;
    }

    Map<String, Object> view() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("type", "match");
        view.put("phase", phase.name().toLowerCase());
        view.put("endsAt", endsAt);
        view.put("perTeam", PER_TEAM);
        for (FootballMatch.Team team : FootballMatch.Team.values()) {
            view.put(team.key(), players(team).stream().map(id -> Map.of("id", id, "name", names.get(id))).toList());
        }
        return view;
    }
}
