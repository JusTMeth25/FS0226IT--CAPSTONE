package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Tornei a eliminazione diretta dell'hotel, a bowling o a biliardo, fino a otto giocatori.
 *
 * C'e' sempre un torneo con le iscrizioni aperte. Si parte quando ci sono otto iscritti, o allo
 * scadere delle iscrizioni se sono almeno quattro (i posti vuoti passano il turno). In ogni
 * turno i due avversari giocano il minigioco del torneo dove vogliono nell'hotel: conta la prima
 * partita finita dopo l'inizio del turno. Chi fa di piu' passa; allo scadere del turno passa chi
 * ha giocato (se nessuno ha giocato, si tira a sorte). Il tabellone avanza da solo.
 */
@Service
public class TournamentService {

    private static final Logger LOG = LoggerFactory.getLogger(TournamentService.class);
    public static final int SIZE = 8;
    static final int MIN_PLAYERS = 4;
    static final Duration SIGNUP = Duration.ofMinutes(20);
    static final Duration ROUND = Duration.ofMinutes(15);
    static final int[] PRIZES = {400, 150};
    static final List<String> GAMES = List.of("bowling", "pool", "rock");
    static final Map<String, String> TITLES = Map.of("bowling", "Torneo di bowling", "pool", "Torneo di biliardo", "rock", "Torneo rock");

    /** Torneo vinto: per i punti della stagione sportiva. */
    public record TournamentWon(UUID winner, UUID runnerUp) {
    }

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final RoomRegistry registry;
    private final ApplicationEventPublisher publisher;
    private final TransactionTemplate tx;
    private final Random random = new Random();

    public TournamentService(JdbcTemplate jdbc, UserRepository userRepository, WalletService walletService, RoomRegistry registry,
                             ApplicationEventPublisher publisher, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.registry = registry;
        this.publisher = publisher;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // ------------------------------------------------------------------ tabellone (logica pura)

    /** Accoppiamenti del primo turno: giocatori mescolati, posti vuoti = passano il turno. */
    static List<UUID[]> firstRound(List<UUID> players, Random random) {
        List<UUID> shuffled = new ArrayList<>(players);
        Collections.shuffle(shuffled, random);
        List<UUID[]> pairs = new ArrayList<>();
        int size = 1;
        while (size < shuffled.size()) size *= 2;
        int byes = size - shuffled.size();
        // Chi passa il turno gioca contro "nessuno": uno per coppia, cosi' nessuno si scontra con due vuoti.
        int i = 0;
        for (int slot = 0; slot < size / 2; slot++) {
            UUID a = shuffled.get(i++);
            UUID b = slot < byes ? null : shuffled.get(i++);
            pairs.add(new UUID[]{a, b});
        }
        return pairs;
    }

    /** Chi passa: il punteggio piu' alto; chi non ha giocato perde; nessuno ha giocato = a sorte. */
    static UUID decide(UUID a, UUID b, Integer aScore, Integer bScore, Random random) {
        if (b == null) return a;
        if (a == null) return b;
        if (aScore == null && bScore == null) return random.nextBoolean() ? a : b;
        if (bScore == null) return a;
        if (aScore == null) return b;
        if (aScore.equals(bScore)) return random.nextBoolean() ? a : b;
        return aScore > bScore ? a : b;
    }

    // ------------------------------------------------------------------ iscrizioni

    private Map<String, Object> current() {
        return jdbc.queryForList("SELECT * FROM tournaments WHERE status IN ('SIGNUP', 'RUNNING') ORDER BY created_at DESC LIMIT 1")
                .stream().findFirst().orElse(null);
    }

    /**
     * Se non c'e' un torneo aperto, se ne apre uno: una volta a settimana il torneo rock (gara di
     * chitarre), per il resto a turno bowling e biliardo.
     */
    private void ensureOpen() {
        if (current() != null) return;
        Boolean rockThisWeek = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM tournaments WHERE game = 'rock' AND created_at > now() - interval '7 days')", Boolean.class);
        String last = jdbc.query("SELECT game FROM tournaments WHERE game <> 'rock' ORDER BY created_at DESC LIMIT 1",
                rs -> rs.next() ? rs.getString(1) : null);
        String game = !Boolean.TRUE.equals(rockThisWeek) ? "rock" : "bowling".equals(last) ? "pool" : "bowling";
        jdbc.update("INSERT INTO tournaments (game, signup_ends) VALUES (?, ?)", game, Timestamp.from(Instant.now().plus(SIGNUP)));
    }

    @Transactional
    public Map<String, Object> signup(UUID userId) {
        ensureOpen();
        Map<String, Object> t = current();
        if (t == null || !"SIGNUP".equals(t.get("status"))) throw ApiException.badRequest("tournament_running");
        UUID id = (UUID) t.get("id");
        Integer count = jdbc.queryForObject("SELECT count(*) FROM tournament_players WHERE tournament_id = ?", Integer.class, id);
        if (count != null && count >= SIZE) throw ApiException.badRequest("tournament_full");
        String name = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found")).getUsername();
        jdbc.update("INSERT INTO tournament_players (tournament_id, user_id, username) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", id, userId, name);
        if (count != null && count + 1 >= SIZE) start(id);
        return view(userId);
    }

    @Transactional
    public Map<String, Object> withdraw(UUID userId) {
        Map<String, Object> t = current();
        if (t != null && "SIGNUP".equals(t.get("status"))) {
            jdbc.update("DELETE FROM tournament_players WHERE tournament_id = ? AND user_id = ?", t.get("id"), userId);
        }
        return view(userId);
    }

    // ------------------------------------------------------------------ svolgimento

    private void start(UUID id) {
        List<UUID> players = jdbc.queryForList("SELECT user_id FROM tournament_players WHERE tournament_id = ?", UUID.class, id);
        Instant deadline = Instant.now().plus(ROUND);
        List<UUID[]> pairs = firstRound(players, random);
        for (int slot = 0; slot < pairs.size(); slot++) {
            UUID[] p = pairs.get(slot);
            jdbc.update("INSERT INTO tournament_matches (tournament_id, round, slot, a_id, b_id, winner_id, deadline) VALUES (?, 1, ?, ?, ?, ?, ?)",
                    id, slot, p[0], p[1], p[1] == null ? p[0] : null, Timestamp.from(deadline));
        }
        jdbc.update("UPDATE tournaments SET status = 'RUNNING', round = 1 WHERE id = ?", id);
        announce(id, "start");
    }

    @Scheduled(fixedDelay = 20_000, initialDelay = 30_000)
    public void tick() {
        try {
            tx.executeWithoutResult(status -> advance());
        } catch (RuntimeException ex) {
            LOG.warn("Torneo non aggiornato: {}", ex.getMessage());
        }
    }

    void advance() {
        ensureOpen();
        Map<String, Object> t = current();
        if (t == null) return;
        UUID id = (UUID) t.get("id");
        if ("SIGNUP".equals(t.get("status"))) {
            if (((Timestamp) t.get("signup_ends")).toInstant().isAfter(Instant.now())) return;
            Integer count = jdbc.queryForObject("SELECT count(*) FROM tournament_players WHERE tournament_id = ?", Integer.class, id);
            if (count != null && count >= MIN_PLAYERS) {
                start(id);
            } else {
                // Pochi iscritti: si riapre con le iscrizioni allungate (chi c'era resta iscritto).
                jdbc.update("UPDATE tournaments SET signup_ends = ? WHERE id = ?", Timestamp.from(Instant.now().plus(SIGNUP)), id);
            }
            return;
        }
        int round = (Integer) t.get("round");
        List<Map<String, Object>> matches = jdbc.queryForList(
                "SELECT * FROM tournament_matches WHERE tournament_id = ? AND round = ? ORDER BY slot", id, round);
        Instant now = Instant.now();
        boolean allDone = true;
        for (Map<String, Object> m : matches) {
            if (m.get("winner_id") != null) continue;
            boolean bothPlayed = m.get("a_score") != null && m.get("b_score") != null;
            if (bothPlayed || ((Timestamp) m.get("deadline")).toInstant().isBefore(now)) {
                UUID winner = decide((UUID) m.get("a_id"), (UUID) m.get("b_id"), (Integer) m.get("a_score"), (Integer) m.get("b_score"), random);
                jdbc.update("UPDATE tournament_matches SET winner_id = ? WHERE id = ?", winner, m.get("id"));
                m.put("winner_id", winner);
            } else {
                allDone = false;
            }
        }
        if (!allDone) return;
        List<UUID> winners = matches.stream().map(m -> (UUID) m.get("winner_id")).toList();
        if (winners.size() == 1) {
            finish(id, matches.get(0));
            return;
        }
        Instant deadline = now.plus(ROUND);
        for (int slot = 0; slot < winners.size() / 2; slot++) {
            jdbc.update("INSERT INTO tournament_matches (tournament_id, round, slot, a_id, b_id, deadline) VALUES (?, ?, ?, ?, ?, ?)",
                    id, round + 1, slot, winners.get(slot * 2), winners.get(slot * 2 + 1), Timestamp.from(deadline));
        }
        jdbc.update("UPDATE tournaments SET round = ? WHERE id = ?", round + 1, id);
        announce(id, "round");
    }

    private void finish(UUID id, Map<String, Object> finalMatch) {
        UUID winner = (UUID) finalMatch.get("winner_id");
        UUID a = (UUID) finalMatch.get("a_id");
        UUID b = (UUID) finalMatch.get("b_id");
        UUID runnerUp = winner != null && winner.equals(a) ? b : a;
        jdbc.update("UPDATE tournaments SET status = 'DONE', winner_id = ?, ended_at = now() WHERE id = ?", winner, id);
        if (winner != null) walletService.adjustGold(winner, PRIZES[0], WalletTransactionType.TOURNAMENT, id.toString(), "Torneo vinto");
        if (runnerUp != null) walletService.adjustGold(runnerUp, PRIZES[1], WalletTransactionType.TOURNAMENT, id.toString(), "Finale del torneo");
        publisher.publishEvent(new TournamentWon(winner, runnerUp));
        announce(id, "end");
    }

    private void announce(UUID id, String phase) {
        Map<String, Object> t = jdbc.queryForMap("SELECT game, round, winner_id FROM tournaments WHERE id = ?", id);
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "tournament");
        message.put("phase", phase);
        message.put("title", TITLES.getOrDefault((String) t.get("game"), "Torneo"));
        message.put("round", t.get("round"));
        if (t.get("winner_id") != null) {
            message.put("winner", jdbc.queryForObject("SELECT username FROM users WHERE id = ?", String.class, t.get("winner_id")));
        }
        registry.broadcastAll(message);
    }

    /** Partita finita a un minigioco: se e' quella del torneo in corso, vale come punteggio dell'incontro. */
    @EventListener
    public void onMinigame(HotelGameEvents.MinigamePlayed event) {
        try {
            tx.executeWithoutResult(status -> record(event.userId(), event.game(), event.score()));
        } catch (RuntimeException ex) {
            LOG.warn("Punteggio del torneo non registrato: {}", ex.getMessage());
        }
    }

    void record(UUID userId, String game, int score) {
        Map<String, Object> t = current();
        if (t == null || !"RUNNING".equals(t.get("status")) || !game.equals(t.get("game"))) return;
        UUID id = (UUID) t.get("id");
        int round = (Integer) t.get("round");
        int a = jdbc.update("UPDATE tournament_matches SET a_score = ? WHERE tournament_id = ? AND round = ? AND a_id = ? "
                + "AND a_score IS NULL AND winner_id IS NULL", score, id, round, userId);
        int b = jdbc.update("UPDATE tournament_matches SET b_score = ? WHERE tournament_id = ? AND round = ? AND b_id = ? "
                + "AND b_score IS NULL AND winner_id IS NULL", score, id, round, userId);
        if (a + b > 0) {
            HotelSession session = registry.sessionOf(userId);
            if (session != null) session.send(Map.of("type", "tournament", "phase", "score", "score", score,
                    "title", TITLES.getOrDefault(game, "Torneo")));
        }
    }

    // ------------------------------------------------------------------ vista

    @Transactional
    public Map<String, Object> view(UUID userId) {
        ensureOpen();
        Map<String, Object> t = current();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("size", SIZE);
        result.put("prizes", PRIZES);
        if (t != null) {
            UUID id = (UUID) t.get("id");
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("id", id);
            view.put("game", t.get("game"));
            view.put("title", TITLES.getOrDefault((String) t.get("game"), "Torneo"));
            view.put("status", t.get("status"));
            view.put("round", t.get("round"));
            view.put("signupEnds", ((Timestamp) t.get("signup_ends")).toInstant());
            List<Map<String, Object>> players = jdbc.queryForList("SELECT user_id AS \"id\", username FROM tournament_players WHERE tournament_id = ? ORDER BY joined_at", id);
            view.put("players", players);
            view.put("joined", players.stream().anyMatch(p -> userId.equals(p.get("id"))));
            view.put("matches", jdbc.queryForList("SELECT m.round, m.slot, m.a_id AS \"aId\", ua.username AS \"aName\", m.b_id AS \"bId\", ub.username AS \"bName\", "
                    + "m.a_score AS \"aScore\", m.b_score AS \"bScore\", m.winner_id AS \"winnerId\", m.deadline "
                    + "FROM tournament_matches m LEFT JOIN users ua ON ua.id = m.a_id LEFT JOIN users ub ON ub.id = m.b_id "
                    + "WHERE m.tournament_id = ? ORDER BY m.round, m.slot", id));
            result.put("tournament", view);
        }
        result.put("last", jdbc.queryForList("SELECT t.game, u.username AS winner, t.ended_at AS \"endedAt\" FROM tournaments t "
                + "LEFT JOIN users u ON u.id = t.winner_id WHERE t.status = 'DONE' ORDER BY t.ended_at DESC LIMIT 5"));
        return result;
    }
}
