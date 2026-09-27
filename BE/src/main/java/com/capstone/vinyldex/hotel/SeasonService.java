package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Stagione sportiva: un mese di sport nell'hotel. Ogni partita ai giochi sportivi, ogni gol,
 * ogni partita a squadre vinta, ogni podio nelle gare di go-kart e nei tornei vale punti. A fine
 * mese i primi tre vincono gold e la stagione riparte.
 */
@Service
public class SeasonService {

    private static final Logger LOG = LoggerFactory.getLogger(SeasonService.class);
    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    static final int[] PRIZES = {1000, 500, 250};
    /** Giochi sportivi e il loro punteggio massimo (per dare punti in proporzione). */
    static final Map<String, Integer> SPORTS = Map.ofEntries(
            Map.entry("basket", 60), Map.entry("bowling", 100), Map.entry("pool", 15), Map.entry("kart", 260),
            Map.entry("pong", 11), Map.entry("darts", 450), Map.entry("bench", 30), Map.entry("run", 200),
            Map.entry("box", 80), Map.entry("curl", 40), Map.entry("hockey", 50));

    private final JdbcTemplate jdbc;
    private final WalletService walletService;
    private final RoomRegistry registry;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;

    public SeasonService(JdbcTemplate jdbc, WalletService walletService, RoomRegistry registry, ObjectMapper objectMapper,
                         PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.walletService = walletService;
        this.registry = registry;
        this.objectMapper = objectMapper;
        this.tx = new TransactionTemplate(transactionManager);
    }

    static String seasonOf(YearMonth month) {
        return month.toString();
    }

    static String currentSeason() {
        return seasonOf(YearMonth.now(ZONE));
    }

    /** Punti di una partita a un gioco sportivo: da 1 a 10 in proporzione al punteggio. */
    static int pointsFor(String game, int score) {
        Integer max = SPORTS.get(game);
        if (max == null && game.startsWith("golf")) max = 6;
        if (max == null || score <= 0) return 0;
        return Math.max(1, Math.min(10, Math.round(score * 10f / max)));
    }

    void add(UUID userId, int points) {
        if (userId == null || points <= 0) return;
        String name = jdbc.query("SELECT username FROM users WHERE id = ?", rs -> rs.next() ? rs.getString(1) : null, userId);
        if (name == null) return;
        jdbc.update("INSERT INTO season_points (season, user_id, username, points) VALUES (?, ?, ?, ?) "
                + "ON CONFLICT (season, user_id) DO UPDATE SET points = season_points.points + EXCLUDED.points, updated_at = now()",
                currentSeason(), userId, name, points);
    }

    private void safely(Runnable action) {
        try {
            tx.executeWithoutResult(status -> action.run());
        } catch (RuntimeException ex) {
            LOG.warn("Punti della stagione non registrati: {}", ex.getMessage());
        }
    }

    @EventListener
    public void onMinigame(HotelGameEvents.MinigamePlayed event) {
        safely(() -> add(event.userId(), pointsFor(event.game(), event.score())));
    }

    @EventListener
    public void onGoal(HotelGameEvents.GoalScored event) {
        safely(() -> add(event.userId(), 2));
    }

    @EventListener
    public void onMatch(HotelGameEvents.MatchPlayed event) {
        safely(() -> {
            event.winners().forEach(id -> add(id, event.draw() ? 5 : 10));
            event.losers().forEach(id -> add(id, 2));
        });
    }

    @EventListener
    public void onKartRace(HotelGameEvents.KartRaceFinished event) {
        int[] points = {10, 6, 3};
        safely(() -> {
            for (int i = 0; i < event.order().size() && i < points.length; i++) add(event.order().get(i), points[i]);
        });
    }

    @EventListener
    public void onTournament(TournamentService.TournamentWon event) {
        safely(() -> {
            add(event.winner(), 30);
            add(event.runnerUp(), 15);
        });
    }

    /** A inizio mese si premiano i primi tre della stagione appena finita. */
    @Scheduled(fixedDelay = 60 * 60_000L, initialDelay = 120_000)
    public void awardPrevious() {
        safely(() -> award(seasonOf(YearMonth.now(ZONE).minusMonths(1))));
    }

    @Transactional
    public List<Map<String, Object>> award(String season) {
        int claimed = jdbc.update("INSERT INTO seasons_awarded (season) VALUES (?) ON CONFLICT DO NOTHING", season);
        if (claimed == 0) return List.of();
        List<Map<String, Object>> top = jdbc.queryForList("SELECT user_id, username, points FROM season_points WHERE season = ? "
                + "ORDER BY points DESC, updated_at ASC LIMIT ?", season, PRIZES.length);
        List<Map<String, Object>> winners = new ArrayList<>();
        for (int i = 0; i < top.size(); i++) {
            Map<String, Object> row = top.get(i);
            walletService.adjustGold((UUID) row.get("user_id"), PRIZES[i], WalletTransactionType.SEASON_REWARD, season,
                    "Stagione sportiva " + season + ": " + (i + 1) + "° posto");
            winners.add(Map.of("username", row.get("username"), "points", row.get("points"), "prize", PRIZES[i]));
        }
        jdbc.update("UPDATE seasons_awarded SET winners = ?::jsonb WHERE season = ?", objectMapper.writeValueAsString(winners), season);
        if (!winners.isEmpty()) registry.broadcastAll(Map.of("type", "season", "phase", "end", "season", season, "winners", winners));
        return winners;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> view(UUID userId) {
        String season = currentSeason();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("season", season);
        result.put("endsAt", YearMonth.now(ZONE).plusMonths(1).atDay(1).atStartOfDay(ZONE).toInstant());
        result.put("prizes", PRIZES);
        result.put("ranking", jdbc.queryForList("SELECT user_id AS \"id\", username, points FROM season_points WHERE season = ? "
                + "ORDER BY points DESC, updated_at ASC LIMIT 20", season));
        Map<String, Object> mine = jdbc.queryForList("SELECT points, (SELECT count(*) + 1 FROM season_points o WHERE o.season = s.season "
                + "AND o.points > s.points) AS rank FROM season_points s WHERE season = ? AND user_id = ?", season, userId)
                .stream().findFirst().orElse(null);
        result.put("mine", mine);
        result.put("last", jdbc.query("SELECT season, winners::text FROM seasons_awarded ORDER BY season DESC LIMIT 1", rs -> {
            if (!rs.next()) return null;
            return Map.of("season", rs.getString(1), "winners", objectMapper.readValue(rs.getString(2), List.class));
        }));
        return result;
    }
}
