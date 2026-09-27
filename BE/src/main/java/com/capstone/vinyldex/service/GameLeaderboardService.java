package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.WalletTransactionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Classifiche per gioco: chi ha piu' carte diverse di Pokemon, Magic, FC 27... Ogni lunedi' il primo
 * di ogni gioco riceve un premio in gold (una volta sola per settimana e gioco).
 */
@Service
public class GameLeaderboardService {

    private static final Logger LOG = LoggerFactory.getLogger(GameLeaderboardService.class);
    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    public static final int TOP = 10;
    public static final int WEEKLY_PRIZE = 200;
    public static final List<String> SOURCES = List.of("original", "pokemon", "yugioh", "scryfall", "onepiece", "digimon",
            "dragonball", "lorcana", "gundam", "riftbound", "fc27");

    private final JdbcTemplate jdbc;
    private final WalletService walletService;

    public GameLeaderboardService(JdbcTemplate jdbc, WalletService walletService) {
        this.jdbc = jdbc;
        this.walletService = walletService;
    }

    private List<Map<String, Object>> top(String source, int limit) {
        return jdbc.queryForList("SELECT u.id, u.username, COUNT(*)::int AS cards FROM user_cards uc "
                + "JOIN cards c ON c.id = uc.card_id JOIN users u ON u.id = uc.user_id "
                + "WHERE uc.quantity > 0 AND c.is_active AND COALESCE(c.source, 'original') = ? AND NOT u.banned AND NOT u.is_npc "
                + "GROUP BY u.id, u.username ORDER BY cards DESC, u.username LIMIT ?", source, limit);
    }

    /** Classifica di un gioco con la percentuale di completamento e i vincitori delle ultime settimane. */
    @Transactional(readOnly = true)
    public Map<String, Object> leaderboard(String rawSource) {
        String source = SOURCES.contains(rawSource) ? rawSource : "pokemon";
        Integer total = jdbc.queryForObject("SELECT COUNT(*)::int FROM cards WHERE is_active AND COALESCE(source, 'original') = ?",
                Integer.class, source);
        List<Map<String, Object>> rows = top(source, TOP);
        rows.forEach(r -> r.put("percent", total == null || total == 0 ? 0 : Math.round(((Integer) r.get("cards")) * 1000f / total) / 10.0));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("source", source);
        result.put("total", total == null ? 0 : total);
        result.put("entries", rows);
        result.put("prize", WEEKLY_PRIZE);
        result.put("nextPrizeAt", nextMonday().atStartOfDay(ZONE).toInstant());
        result.put("winners", jdbc.queryForList("SELECT p.week::text AS week, u.username, p.cards FROM leaderboard_prizes p "
                + "JOIN users u ON u.id = p.user_id WHERE p.source = ? ORDER BY p.week DESC LIMIT 4", source));
        return result;
    }

    static LocalDate nextMonday() {
        return LocalDate.now(ZONE).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }

    /** Ogni lunedi' a mezzanotte e cinque: premio al primo di ogni gioco. */
    @Scheduled(cron = "0 5 0 * * MON", zone = "Europe/Rome")
    public void weeklyPrizes() {
        LocalDate week = LocalDate.now(ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for (String source : SOURCES) {
            try {
                payWinner(week, source);
            } catch (RuntimeException ex) {
                LOG.warn("Premio della classifica {} non pagato: {}", source, ex.getMessage());
            }
        }
    }

    /** Paga il primo della classifica di un gioco per la settimana; false se gia' pagato o nessuno. */
    @Transactional
    public boolean payWinner(LocalDate week, String source) {
        List<Map<String, Object>> first = top(source, 1);
        if (first.isEmpty()) return false;
        UUID userId = (UUID) first.get(0).get("id");
        int cards = (Integer) first.get(0).get("cards");
        int inserted = jdbc.update("INSERT INTO leaderboard_prizes (week, source, user_id, cards, gold) VALUES (?, ?, ?, ?, ?) "
                + "ON CONFLICT DO NOTHING", Date.valueOf(week), source, userId, cards, WEEKLY_PRIZE);
        if (inserted == 0) return false;
        walletService.adjustGold(userId, WEEKLY_PRIZE, WalletTransactionType.MINIGAME_REWARD, "leaderboard-" + source,
                "Primo nella classifica settimanale " + source);
        return true;
    }
}
