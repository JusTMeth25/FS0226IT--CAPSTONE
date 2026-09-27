package com.capstone.vinyldex.hotel;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Classifiche della gara rock: il miglior voto di ogni giocatore per canzone, difficolta' e
 * strumento. Il voto arriva con il risultato del minigioco, gia' controllato dalla stanza.
 */
@Service
public class RockScoreService {

    /** Canzoni e difficolta' che esistono (src/hotel/ui/rockSongs.js). */
    static final Set<String> SONGS = Set.of("vinile", "autostrada", "neon", "metallo", "ballata",
            "sultani", "viale", "giungla", "uragano", "rosa");
    static final Set<String> DIFFICULTIES = Set.of("easy", "medium", "hard");
    static final Set<String> INSTRUMENTS = Set.of("guitar", "drums");

    private final JdbcTemplate jdbc;

    public RockScoreService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    static boolean valid(String song, String difficulty, String instrument) {
        return SONGS.contains(song) && DIFFICULTIES.contains(difficulty) && INSTRUMENTS.contains(instrument);
    }

    public void record(UUID userId, String song, String difficulty, String instrument, int score) {
        if (!valid(song, difficulty, instrument) || score <= 0) return;
        jdbc.update("INSERT INTO rock_scores (user_id, song, difficulty, instrument, score) VALUES (?, ?, ?, ?, ?)",
                userId, song, difficulty, instrument, Math.min(1000, score));
    }

    /** I dieci migliori (un voto per giocatore, il piu' alto). */
    public List<Map<String, Object>> top(String song, String difficulty, String instrument) {
        if (!valid(song, difficulty, instrument)) return List.of();
        return jdbc.queryForList(
                "SELECT u.username, MAX(r.score) AS score FROM rock_scores r JOIN users u ON u.id = r.user_id "
                        + "WHERE r.song = ? AND r.difficulty = ? AND r.instrument = ? "
                        + "GROUP BY u.username ORDER BY score DESC, u.username LIMIT 10",
                song, difficulty, instrument);
    }
}
