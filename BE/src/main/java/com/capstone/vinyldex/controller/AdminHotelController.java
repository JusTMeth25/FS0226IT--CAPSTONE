package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.AuctionService;
import com.capstone.vinyldex.hotel.HotelEventService;
import com.capstone.vinyldex.hotel.HotelSession;
import com.capstone.vinyldex.hotel.RoomRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Pannello admin dell'hotel (solo ruolo ADMIN, come tutto /api/admin): eventi a orario creati
 * senza toccare il codice, asta a comando, moderazione della chat e annunci.
 */
@RestController
@RequestMapping("/api/admin/hotel")
public class AdminHotelController {

    static final Set<String> GAMES = Set.of("goals", "basket", "bowling", "pool", "kart", "pong", "darts", "sing", "fish", "disco", "hockey", "rock",
            "bench", "run", "box", "curl", "rhythm", "claw", "golf1", "golf2", "golf3", "golf4", "golf5", "golf6");

    private final JdbcTemplate jdbc;
    private final HotelEventService events;
    private final AuctionService auctions;
    private final RoomRegistry registry;

    public AdminHotelController(JdbcTemplate jdbc, HotelEventService events, AuctionService auctions, RoomRegistry registry) {
        this.jdbc = jdbc;
        this.events = events;
        this.auctions = auctions;
        this.registry = registry;
    }

    public record EventDto(String title, String game, boolean sum, Integer dayOfWeek, String start, int minutes,
                           String room, String rules, int prize1, int prize2, int prize3) {
    }

    public record AuctionDto(String card, Integer startBid, Integer minutes) {
    }

    public record MuteDto(int minutes) {
    }

    public record AnnounceDto(String text) {
    }

    // ---- eventi

    @GetMapping("/events")
    public Map<String, Object> listEvents() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("custom", jdbc.queryForList("SELECT id, title, game, sum_scores AS \"sum\", day_of_week AS \"dayOfWeek\", "
                + "start_time::text AS start, minutes, room, rules, prize1, prize2, prize3, active FROM hotel_custom_events ORDER BY created_at"));
        result.put("fixed", HotelEventService.EVENTS.stream().map(e -> Map.of("key", e.key(), "title", e.title(), "game", e.game(),
                "start", e.start().toString(), "minutes", e.length().toMinutes(), "day", e.day() == null ? "ogni giorno" : e.day().toString())).toList());
        result.put("games", GAMES.stream().sorted().toList());
        return result;
    }

    @PostMapping("/events")
    @Transactional
    public Map<String, Object> createEvent(@RequestBody EventDto body) {
        if (body.title() == null || body.title().isBlank() || body.title().length() > 60) throw ApiException.badRequest("event_title");
        if (!GAMES.contains(body.game())) throw ApiException.badRequest("event_game");
        if (body.minutes() < 5 || body.minutes() > 240) throw ApiException.badRequest("event_minutes");
        if (body.dayOfWeek() != null && (body.dayOfWeek() < 1 || body.dayOfWeek() > 7)) throw ApiException.badRequest("event_day");
        LocalTime start;
        try {
            start = LocalTime.parse(body.start());
        } catch (RuntimeException ex) {
            throw ApiException.badRequest("event_start");
        }
        jdbc.update("INSERT INTO hotel_custom_events (title, game, sum_scores, day_of_week, start_time, minutes, room, rules, prize1, prize2, prize3) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                body.title().trim(), body.game(), body.sum(), body.dayOfWeek(), java.sql.Time.valueOf(start), body.minutes(),
                body.room() == null || body.room().isBlank() ? "Hotel" : body.room().trim(),
                body.rules() == null ? "" : body.rules().trim(),
                Math.max(0, body.prize1()), Math.max(0, body.prize2()), Math.max(0, body.prize3()));
        events.reload();
        return listEvents();
    }

    @PostMapping("/events/{id}/toggle")
    public Map<String, Object> toggleEvent(@PathVariable UUID id) {
        jdbc.update("UPDATE hotel_custom_events SET active = NOT active WHERE id = ?", id);
        events.reload();
        return listEvents();
    }

    @DeleteMapping("/events/{id}")
    public Map<String, Object> deleteEvent(@PathVariable UUID id) {
        jdbc.update("DELETE FROM hotel_custom_events WHERE id = ?", id);
        events.reload();
        return listEvents();
    }

    // ---- asta

    @GetMapping("/auction")
    public Map<String, Object> auction() {
        return auctions.overview();
    }

    @PostMapping("/auction")
    public Map<String, Object> startAuction(@RequestBody AuctionDto body) {
        return auctions.startNow(body.card(), body.startBid(), body.minutes());
    }

    @PostMapping("/auction/cancel")
    public Map<String, Object> cancelAuction() {
        return auctions.cancel();
    }

    // ---- moderazione

    @GetMapping("/chat")
    public Map<String, Object> chat() {
        List<Map<String, Object>> muted = registry.muted().entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", e.getKey());
            m.put("username", jdbc.query("SELECT username FROM users WHERE id = ?", rs -> rs.next() ? rs.getString(1) : "?", e.getKey()));
            m.put("until", java.time.Instant.ofEpochMilli(e.getValue()).toString());
            return m;
        }).toList();
        return Map.of("messages", registry.recentChat(), "muted", muted);
    }

    @PostMapping("/users/{userId}/mute")
    public Map<String, Object> mute(@PathVariable UUID userId, @RequestBody MuteDto body) {
        int minutes = Math.max(1, Math.min(24 * 60, body.minutes()));
        registry.mute(userId, minutes);
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(Map.of("type", "moderation", "muted", true, "minutes", minutes));
        return chat();
    }

    @PostMapping("/users/{userId}/unmute")
    public Map<String, Object> unmute(@PathVariable UUID userId) {
        registry.unmute(userId);
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(Map.of("type", "moderation", "muted", false));
        return chat();
    }

    /** Annuncio a tutto l'hotel (compare a tutti come avviso). */
    @PostMapping("/announce")
    public Map<String, Object> announce(@RequestBody AnnounceDto body) {
        if (body.text() == null || body.text().isBlank()) throw ApiException.badRequest("announce_empty");
        String text = body.text().trim();
        registry.broadcastAll(Map.of("type", "announcement", "text", text.length() > 200 ? text.substring(0, 200) : text));
        return Map.of("sent", true);
    }
}
