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

import java.sql.Date;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Eventi a orario dell'hotel: il torneo di calcio della sera, la gara di tiri a pranzo, il bowling
 * del sabato e la finale di basket della domenica. Mentre un evento e' in corso i gol e i punteggi
 * dei minigiochi finiscono in classifica; alla fine i primi tre vincono gold e tutti lo sanno.
 */
@Service
public class HotelEventService {

    private static final Logger LOG = LoggerFactory.getLogger(HotelEventService.class);
    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    static final int[] PRIZES = {300, 150, 75};
    /** Gioco speciale: i gol segnati allo stadio. */
    static final String GOALS = "goals";

    /**
     * Un evento: `game` e' il minigioco (o i gol), `sum` somma i punti invece di tenere il migliore,
     * `day` null vuol dire tutti i giorni.
     */
    public record EventDef(String key, String title, String icon, String room, String game, boolean sum,
                           DayOfWeek day, LocalTime start, Duration length, String rules) {

        boolean on(LocalDate date) {
            return day == null || date.getDayOfWeek() == day;
        }

        ZonedDateTime startOn(LocalDate date) {
            return date.atTime(start).atZone(ZONE);
        }
    }

    public static final List<EventDef> EVENTS = List.of(
            new EventDef("torneo-calcio", "Torneo di calcio", "soccer-ball", "Stadio", GOALS, true, null,
                    LocalTime.of(21, 0), Duration.ofMinutes(30), "Chi segna piu' gol allo stadio in mezz'ora."),
            new EventDef("tiri-pranzo", "Gara di tiri a pranzo", "basketball", "Palazzetto", "basket", false, null,
                    LocalTime.of(13, 0), Duration.ofMinutes(30), "Miglior punteggio ai tiri liberi."),
            new EventDef("bowling-sabato", "Sabato al bowling", "bowling-ball", "Bowling", "bowling", false, DayOfWeek.SATURDAY,
                    LocalTime.of(18, 0), Duration.ofHours(1), "Miglior partita di bowling della serata."),
            new EventDef("basket-domenica", "Finale di basket", "trophy", "Palazzetto", "basket", false, DayOfWeek.SUNDAY,
                    LocalTime.of(18, 0), Duration.ofHours(1), "Miglior punteggio ai tiri liberi: la sfida della domenica."));

    /** Edizione di un evento: il giorno, l'inizio e la fine. */
    public record Edition(EventDef def, LocalDate date, Instant startsAt, Instant endsAt) {
    }

    private final JdbcTemplate jdbc;
    private final WalletService walletService;
    private final RoomRegistry registry;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;
    /** Edizioni gia' annunciate da questo processo (dopo un riavvio si riannunciano, pazienza). */
    private final Set<String> announced = ConcurrentHashMap.newKeySet();

    public HotelEventService(JdbcTemplate jdbc, WalletService walletService, RoomRegistry registry, ObjectMapper objectMapper,
                             PlatformTransactionManager transactionManager) {
        this.tx = new TransactionTemplate(transactionManager);
        this.jdbc = jdbc;
        this.walletService = walletService;
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------------ calendario

    static List<Edition> active(Instant now) {
        LocalDate today = now.atZone(ZONE).toLocalDate();
        List<Edition> result = new ArrayList<>();
        for (EventDef def : EVENTS) {
            for (LocalDate date : List.of(today.minusDays(1), today)) {
                if (!def.on(date)) continue;
                Instant start = def.startOn(date).toInstant();
                Instant end = start.plus(def.length());
                if (!now.isBefore(start) && now.isBefore(end)) result.add(new Edition(def, date, start, end));
            }
        }
        return result;
    }

    /** Le prossime edizioni, in ordine di inizio. */
    static List<Edition> upcoming(Instant now, int limit) {
        LocalDate today = now.atZone(ZONE).toLocalDate();
        List<Edition> result = new ArrayList<>();
        for (int d = 0; d < 8; d++) {
            LocalDate date = today.plusDays(d);
            for (EventDef def : EVENTS) {
                if (!def.on(date)) continue;
                Instant start = def.startOn(date).toInstant();
                if (start.isAfter(now)) result.add(new Edition(def, date, start, start.plus(def.length())));
            }
        }
        result.sort(Comparator.comparing(Edition::startsAt));
        return result.subList(0, Math.min(limit, result.size()));
    }

    /** Edizioni finite nelle ultime 24 ore (quelle da premiare). */
    static List<Edition> recentlyEnded(Instant now) {
        LocalDate today = now.atZone(ZONE).toLocalDate();
        List<Edition> result = new ArrayList<>();
        for (EventDef def : EVENTS) {
            for (LocalDate date : List.of(today.minusDays(1), today)) {
                if (!def.on(date)) continue;
                Instant end = def.startOn(date).toInstant().plus(def.length());
                if (!end.isAfter(now) && end.isAfter(now.minus(Duration.ofHours(24)))) {
                    result.add(new Edition(def, date, end.minus(def.length()), end));
                }
            }
        }
        return result;
    }

    static boolean counts(EventDef def, String game) {
        return def.game().equals(game);
    }

    // ------------------------------------------------------------------ punti

    @EventListener
    public void onGoal(HotelGameEvents.GoalScored event) {
        record(GOALS, event.userId(), event.username(), 1);
    }

    @EventListener
    public void onMinigame(HotelGameEvents.MinigamePlayed event) {
        record(event.game(), event.userId(), event.username(), event.score());
    }

    void record(String game, UUID userId, String username, int score) {
        if (userId == null || score <= 0) return;
        for (Edition edition : active(Instant.now())) {
            if (!counts(edition.def(), game)) continue;
            String update = edition.def().sum()
                    ? "hotel_event_scores.score + EXCLUDED.score"
                    : "GREATEST(hotel_event_scores.score, EXCLUDED.score)";
            jdbc.update("INSERT INTO hotel_event_scores (event_key, edition, user_id, username, score) VALUES (?, ?, ?, ?, ?) "
                            + "ON CONFLICT (event_key, edition, user_id) DO UPDATE SET score = " + update + ", updated_at = now()",
                    edition.def().key(), Date.valueOf(edition.date()), userId, username, score);
            registry.broadcastAll(Map.of("type", "hotel_event", "phase", "score", "key", edition.def().key()));
        }
    }

    public List<Map<String, Object>> leaderboard(String key, LocalDate edition, int limit) {
        return jdbc.queryForList("SELECT user_id AS \"userId\", username, score FROM hotel_event_scores "
                + "WHERE event_key = ? AND edition = ? ORDER BY score DESC, updated_at ASC LIMIT ?", key, Date.valueOf(edition), limit);
    }

    // ------------------------------------------------------------------ annunci e premi

    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void tick() {
        Instant now = Instant.now();
        for (Edition edition : active(now)) {
            String id = edition.def().key() + ":" + edition.date();
            if (announced.add(id)) {
                registry.broadcastAll(Map.of("type", "hotel_event", "phase", "start", "key", edition.def().key(),
                        "title", edition.def().title(), "room", edition.def().room(), "endsAt", edition.endsAt().toString()));
            }
        }
        for (Edition edition : recentlyEnded(now)) {
            try {
                // Da qui la chiamata non passa dal proxy di Spring: la transazione si apre a mano.
                tx.executeWithoutResult(status -> award(edition));
            } catch (RuntimeException ex) {
                LOG.warn("Premi dell'evento {} non consegnati: {}", edition.def().key(), ex.getMessage());
            }
        }
    }

    /** Premia i primi tre di un'edizione finita, una volta sola. */
    @Transactional
    public List<Map<String, Object>> award(Edition edition) {
        String key = edition.def().key();
        Date date = Date.valueOf(edition.date());
        int claimed = jdbc.update("INSERT INTO hotel_event_editions (event_key, edition) VALUES (?, ?) ON CONFLICT DO NOTHING", key, date);
        if (claimed == 0) return List.of();
        List<Map<String, Object>> top = leaderboard(key, edition.date(), PRIZES.length);
        List<Map<String, Object>> winners = new ArrayList<>();
        for (int i = 0; i < top.size(); i++) {
            Map<String, Object> row = top.get(i);
            UUID userId = (UUID) row.get("userId");
            walletService.adjustGold(userId, PRIZES[i], WalletTransactionType.EVENT_REWARD, "event:" + key + ":" + edition.date(),
                    edition.def().title() + ": " + (i + 1) + "° posto");
            Map<String, Object> winner = new LinkedHashMap<>();
            winner.put("username", row.get("username"));
            winner.put("score", row.get("score"));
            winner.put("prize", PRIZES[i]);
            winners.add(winner);
        }
        jdbc.update("UPDATE hotel_event_editions SET winners = ?::jsonb WHERE event_key = ? AND edition = ?",
                objectMapper.writeValueAsString(winners), key, date);
        if (!winners.isEmpty()) {
            registry.broadcastAll(Map.of("type", "hotel_event", "phase", "end", "key", key,
                    "title", edition.def().title(), "winners", winners));
        }
        return winners;
    }

    // ------------------------------------------------------------------ vista

    /** Eventi in corso con classifica, prossimi eventi e ultimi vincitori. */
    public Map<String, Object> overview(UUID userId) {
        Instant now = Instant.now();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("now", now);
        result.put("current", active(now).stream().map(edition -> {
            Map<String, Object> view = view(edition);
            List<Map<String, Object>> board = leaderboard(edition.def().key(), edition.date(), 10);
            view.put("leaderboard", board);
            view.put("myScore", jdbc.query("SELECT score FROM hotel_event_scores WHERE event_key = ? AND edition = ? AND user_id = ?",
                    rs -> rs.next() ? rs.getInt(1) : 0, edition.def().key(), Date.valueOf(edition.date()), userId));
            return view;
        }).toList());
        result.put("upcoming", upcoming(now, 5).stream().map(HotelEventService::view).toList());
        result.put("recent", jdbc.queryForList("SELECT event_key AS \"key\", edition, winners::text AS winners FROM hotel_event_editions "
                + "ORDER BY awarded_at DESC LIMIT 5").stream().map(row -> {
                    Map<String, Object> view = new LinkedHashMap<>();
                    String key = (String) row.get("key");
                    view.put("key", key);
                    view.put("title", EVENTS.stream().filter(e -> e.key().equals(key)).map(EventDef::title).findFirst().orElse(key));
                    view.put("edition", row.get("edition").toString());
                    view.put("winners", objectMapper.readValue((String) row.get("winners"), List.class));
                    return view;
                }).toList());
        result.put("prizes", PRIZES);
        return result;
    }

    private static Map<String, Object> view(Edition edition) {
        EventDef def = edition.def();
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("key", def.key());
        view.put("title", def.title());
        view.put("icon", def.icon());
        view.put("room", def.room());
        view.put("rules", def.rules());
        view.put("startsAt", edition.startsAt());
        view.put("endsAt", edition.endsAt());
        return view;
    }
}
