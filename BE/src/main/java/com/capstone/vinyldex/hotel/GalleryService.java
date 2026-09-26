package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.sql.Array;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Mostra delle collezioni: ogni settimana (da lunedi' a domenica) ogni giocatore espone fino a
 * cinque carte sue. Gli altri votano la mostra che preferiscono, un voto a testa a settimana e mai
 * per se stessi. Il lunedi' dopo i primi tre vincono gold e il podio resta nella pagina.
 */
@Service
public class GalleryService {

    private static final Logger LOG = LoggerFactory.getLogger(GalleryService.class);
    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    public static final int MAX_CARDS = 5;
    static final int[] PRIZES = {500, 250, 100};

    private final JdbcTemplate jdbc;
    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;
    private final WalletService walletService;
    private final RoomRegistry registry;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;

    public GalleryService(JdbcTemplate jdbc, CardRepository cardRepository, UserCardRepository userCardRepository,
                          WalletService walletService, RoomRegistry registry, ObjectMapper objectMapper,
                          PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
        this.walletService = walletService;
        this.registry = registry;
        this.objectMapper = objectMapper;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** Lunedi' della settimana di `day`. */
    static LocalDate weekOf(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    static LocalDate thisWeek() {
        return weekOf(LocalDate.now(ZONE));
    }

    // ------------------------------------------------------------------ esposizione e voti

    /** Sceglie le carte da esporre questa settimana (solo carte possedute, al massimo cinque). */
    @Transactional
    public Map<String, Object> exhibit(UUID userId, List<String> codes) {
        List<String> unique = new ArrayList<>(new LinkedHashSet<>(codes == null ? List.of() : codes));
        if (unique.size() > MAX_CARDS) throw ApiException.badRequest("gallery_too_many");
        Set<UUID> owned = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).map(uc -> uc.getCard().getId()).collect(Collectors.toSet());
        List<UUID> ids = new ArrayList<>();
        for (String code : unique) {
            Card card = cardRepository.findByCode(code).orElseThrow(() -> ApiException.notFound("card_not_found"));
            if (!owned.contains(card.getId())) throw ApiException.badRequest("card_not_owned");
            ids.add(card.getId());
        }
        Date week = Date.valueOf(thisWeek());
        if (ids.isEmpty()) {
            jdbc.update("DELETE FROM gallery_entries WHERE user_id = ? AND week = ?", userId, week);
            jdbc.update("DELETE FROM gallery_votes WHERE target_id = ? AND week = ?", userId, week);
        } else {
            jdbc.update(con -> {
                var ps = con.prepareStatement("INSERT INTO gallery_entries (user_id, week, card_ids) VALUES (?, ?, ?) "
                        + "ON CONFLICT (user_id, week) DO UPDATE SET card_ids = EXCLUDED.card_ids, updated_at = now()");
                ps.setObject(1, userId);
                ps.setDate(2, week);
                ps.setArray(3, con.createArrayOf("uuid", ids.toArray()));
                return ps;
            });
        }
        return overview(userId);
    }

    /** Vota la mostra di un altro giocatore; si puo' cambiare idea finche' la settimana non finisce. */
    @Transactional
    public Map<String, Object> vote(UUID voterId, UUID targetId) {
        if (voterId.equals(targetId)) throw ApiException.badRequest("gallery_self_vote");
        Date week = Date.valueOf(thisWeek());
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM gallery_entries WHERE user_id = ? AND week = ?",
                Integer.class, targetId, week);
        if (exists == null || exists == 0) throw ApiException.notFound("gallery_not_found");
        jdbc.update("INSERT INTO gallery_votes (voter_id, week, target_id) VALUES (?, ?, ?) "
                + "ON CONFLICT (voter_id, week) DO UPDATE SET target_id = EXCLUDED.target_id, voted_at = now()", voterId, week, targetId);
        return overview(voterId);
    }

    // ------------------------------------------------------------------ premi

    @Scheduled(fixedDelay = 10 * 60_000, initialDelay = 60_000)
    public void tick() {
        LocalDate last = thisWeek().minusWeeks(1);
        try {
            tx.executeWithoutResult(status -> award(last));
        } catch (RuntimeException ex) {
            LOG.warn("Premi della mostra non consegnati: {}", ex.getMessage());
        }
    }

    /** Premia i primi tre della settimana, una volta sola. */
    @Transactional
    public List<Map<String, Object>> award(LocalDate weekStart) {
        Date week = Date.valueOf(weekStart);
        int claimed = jdbc.update("INSERT INTO gallery_weeks (week) VALUES (?) ON CONFLICT DO NOTHING", week);
        if (claimed == 0) return List.of();
        List<Map<String, Object>> ranking = ranking(week, PRIZES.length);
        List<Map<String, Object>> winners = new ArrayList<>();
        for (int i = 0; i < ranking.size(); i++) {
            Map<String, Object> row = ranking.get(i);
            long votes = ((Number) row.get("votes")).longValue();
            if (votes == 0) break;
            UUID userId = (UUID) row.get("userId");
            walletService.adjustGold(userId, PRIZES[i], WalletTransactionType.GALLERY_REWARD, "gallery:" + weekStart,
                    "Mostra delle collezioni: " + (i + 1) + "° posto");
            Map<String, Object> winner = new LinkedHashMap<>();
            winner.put("username", row.get("username"));
            winner.put("votes", votes);
            winner.put("prize", PRIZES[i]);
            winners.add(winner);
        }
        jdbc.update("UPDATE gallery_weeks SET winners = ?::jsonb WHERE week = ?", objectMapper.writeValueAsString(winners), week);
        if (!winners.isEmpty()) {
            registry.broadcastAll(Map.of("type", "gallery", "phase", "end", "winners", winners));
        }
        return winners;
    }

    private List<Map<String, Object>> ranking(Date week, int limit) {
        return jdbc.queryForList("SELECT e.user_id AS \"userId\", u.username, e.card_ids AS \"cardIds\", "
                + "(SELECT count(*) FROM gallery_votes v WHERE v.week = e.week AND v.target_id = e.user_id) AS votes "
                + "FROM gallery_entries e JOIN users u ON u.id = e.user_id WHERE e.week = ? "
                + "ORDER BY votes DESC, e.updated_at ASC LIMIT ?", week, limit);
    }

    // ------------------------------------------------------------------ vista

    @Transactional(readOnly = true)
    public Map<String, Object> overview(UUID userId) {
        LocalDate weekStart = thisWeek();
        Date week = Date.valueOf(weekStart);
        List<Map<String, Object>> rows = ranking(week, 50);
        Set<UUID> cardIds = rows.stream().flatMap(r -> Arrays.stream(uuids(r.get("cardIds")))).collect(Collectors.toSet());
        Map<UUID, Card> cards = cardRepository.findAllById(cardIds).stream().collect(Collectors.toMap(Card::getId, Function.identity()));
        UUID myVote = jdbc.query("SELECT target_id FROM gallery_votes WHERE voter_id = ? AND week = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, userId, week);

        List<Map<String, Object>> entries = new ArrayList<>();
        Map<String, Object> mine = null;
        for (Map<String, Object> row : rows) {
            Map<String, Object> entry = new LinkedHashMap<>();
            UUID owner = (UUID) row.get("userId");
            entry.put("userId", owner);
            entry.put("username", row.get("username"));
            entry.put("votes", row.get("votes"));
            entry.put("cards", Arrays.stream(uuids(row.get("cardIds"))).map(cards::get).filter(c -> c != null).map(CardDto::from).toList());
            entries.add(entry);
            if (owner.equals(userId)) mine = entry;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("week", weekStart.toString());
        result.put("endsAt", weekStart.plusWeeks(1).atStartOfDay(ZONE).toInstant());
        result.put("maxCards", MAX_CARDS);
        result.put("prizes", PRIZES);
        result.put("entries", entries);
        result.put("mine", mine);
        result.put("myVote", myVote);
        result.put("lastWinners", jdbc.query("SELECT week, winners::text FROM gallery_weeks ORDER BY week DESC LIMIT 1",
                rs -> {
                    if (!rs.next()) return null;
                    Map<String, Object> last = new LinkedHashMap<>();
                    last.put("week", rs.getDate(1).toString());
                    last.put("winners", objectMapper.readValue(rs.getString(2), List.class));
                    return last;
                }));
        return result;
    }

    private static UUID[] uuids(Object raw) {
        try {
            if (raw instanceof Array array) return (UUID[]) array.getArray();
            if (raw instanceof UUID[] ids) return ids;
        } catch (java.sql.SQLException ex) {
            LOG.warn("Carte della mostra illeggibili: {}", ex.getMessage());
        }
        return new UUID[0];
    }
}
