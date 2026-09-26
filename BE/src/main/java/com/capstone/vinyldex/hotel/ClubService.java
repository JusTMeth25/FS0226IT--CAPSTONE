package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Room;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Club dell'hotel: un gruppo di giocatori con nome, sigla, colore e stemma, e una sede (una
 * stanza tutta loro, aperta a tutti i membri). La sigla compare accanto al nome nell'hotel e i
 * punti dei membri negli eventi fanno la classifica dei club.
 */
@Service
public class ClubService {

    public static final int FOUNDING_COST = 500;
    public static final int MAX_MEMBERS = 30;
    static final Set<String> ICONS = Set.of("vinyl-record", "star", "crown", "lightning", "fire", "heart", "music-notes",
            "soccer-ball", "rocket", "sparkle", "skull", "planet");
    private static final Pattern TAG = Pattern.compile("[A-Z0-9]{2,4}");
    private static final Pattern COLOR = Pattern.compile("#[0-9a-fA-F]{6}");

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final WalletService walletService;
    private final RoomRegistry registry;

    public ClubService(JdbcTemplate jdbc, UserRepository userRepository, RoomRepository roomRepository,
                       WalletService walletService, RoomRegistry registry) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.walletService = walletService;
        this.registry = registry;
    }

    /** Sede del club: una sala 14x12 con la porta a sinistra. */
    static String clubLayout() {
        StringBuilder s = new StringBuilder();
        for (int y = 0; y <= 12; y++) {
            for (int x = 0; x <= 14; x++) {
                boolean tile = (x >= 1 && y >= 1) || (x == 0 && y == 6);
                s.append(tile ? '0' : 'x');
            }
            if (y < 12) s.append('\n');
        }
        return s.toString();
    }

    public HotelUser.ClubBadge badgeOf(UUID userId) {
        return jdbc.query("SELECT c.tag, c.color, c.name FROM club_members m JOIN clubs c ON c.id = m.club_id WHERE m.user_id = ?",
                rs -> rs.next() ? new HotelUser.ClubBadge(rs.getString(1), rs.getString(2), rs.getString(3)) : null, userId);
    }

    private UUID clubOf(UUID userId) {
        return jdbc.query("SELECT club_id FROM club_members WHERE user_id = ?", rs -> rs.next() ? (UUID) rs.getObject(1) : null, userId);
    }

    @Transactional
    public Map<String, Object> create(UUID userId, String rawName, String rawTag, String color, String icon, String motto) {
        if (clubOf(userId) != null) throw ApiException.badRequest("club_already_member");
        String name = rawName == null ? "" : rawName.trim();
        String tag = rawTag == null ? "" : rawTag.trim().toUpperCase();
        if (name.length() < 3 || name.length() > 30) throw ApiException.badRequest("club_name");
        if (!TAG.matcher(tag).matches()) throw ApiException.badRequest("club_tag");
        if (color == null || !COLOR.matcher(color).matches()) color = "#8b5cf6";
        if (icon == null || !ICONS.contains(icon)) icon = "vinyl-record";
        Integer taken = jdbc.queryForObject("SELECT count(*) FROM clubs WHERE lower(name) = lower(?) OR tag = ?", Integer.class, name, tag);
        if (taken != null && taken > 0) throw ApiException.conflict("club_taken");
        User owner = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        walletService.adjustGold(userId, -FOUNDING_COST, WalletTransactionType.CLUB, tag, "Fondazione del club " + name);

        Room room = new Room();
        room.setOwner(owner);
        room.setName("Sede del club " + name);
        room.setDescription(motto == null || motto.isBlank() ? "La casa del club [" + tag + "]." : motto.trim());
        room.setLayout(clubLayout());
        room.setDoorX(0);
        room.setDoorY(6);
        room.setDoorDir(2);
        room.setMaxUsers(MAX_MEMBERS + 10);
        room.setFloorStyle("parquet");
        room.setWallStyle("brick");
        room = roomRepository.saveAndFlush(room);

        UUID clubId = UUID.randomUUID();
        jdbc.update("INSERT INTO clubs (id, name, tag, color, icon, motto, owner_id, room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                clubId, name, tag, color, icon, motto == null ? null : motto.trim(), userId, room.getId());
        jdbc.update("INSERT INTO club_members (user_id, club_id, role) VALUES (?, ?, 'OWNER')", userId, clubId);
        refresh(userId);
        return mine(userId);
    }

    @Transactional
    public Map<String, Object> join(UUID userId, UUID clubId) {
        if (clubOf(userId) != null) throw ApiException.badRequest("club_already_member");
        Integer members = jdbc.queryForObject("SELECT count(*) FROM club_members WHERE club_id = ?", Integer.class, clubId);
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM clubs WHERE id = ?", Integer.class, clubId);
        if (exists == null || exists == 0) throw ApiException.notFound("club_not_found");
        if (members != null && members >= MAX_MEMBERS) throw ApiException.badRequest("club_full");
        jdbc.update("INSERT INTO club_members (user_id, club_id) VALUES (?, ?)", userId, clubId);
        refresh(userId);
        return mine(userId);
    }

    /** Esce dal club. Se esce il fondatore il club passa al membro piu' anziano; se era solo, si scioglie. */
    @Transactional
    public Map<String, Object> leave(UUID userId) {
        UUID clubId = clubOf(userId);
        if (clubId == null) throw ApiException.badRequest("club_not_member");
        jdbc.update("DELETE FROM club_members WHERE user_id = ?", userId);
        UUID heir = jdbc.query("SELECT user_id FROM club_members WHERE club_id = ? ORDER BY joined_at LIMIT 1",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, clubId);
        if (heir == null) {
            jdbc.update("DELETE FROM clubs WHERE id = ?", clubId);
        } else {
            jdbc.update("UPDATE clubs SET owner_id = ? WHERE id = ? AND owner_id = ?", heir, clubId, userId);
            jdbc.update("UPDATE club_members SET role = 'OWNER' WHERE user_id = ? AND club_id = ? "
                    + "AND NOT EXISTS (SELECT 1 FROM club_members WHERE club_id = ? AND role = 'OWNER')", heir, clubId, clubId);
        }
        refresh(userId);
        return Map.of("left", true);
    }

    /** Tutti i club, con membri e punti negli eventi degli ultimi sette giorni. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        return jdbc.queryForList("SELECT c.id, c.name, c.tag, c.color, c.icon, c.motto, c.room_id AS \"roomId\", u.username AS \"ownerName\", "
                + "(SELECT count(*) FROM club_members m WHERE m.club_id = c.id) AS members, "
                + "(SELECT coalesce(sum(s.score), 0) FROM hotel_event_scores s JOIN club_members m ON m.user_id = s.user_id "
                + " WHERE m.club_id = c.id AND s.edition > CURRENT_DATE - 7) AS points "
                + "FROM clubs c JOIN users u ON u.id = c.owner_id ORDER BY points DESC, members DESC, c.created_at LIMIT 50");
    }

    /** Il club del giocatore, con i membri (chi e' online e dove). */
    @Transactional(readOnly = true)
    public Map<String, Object> mine(UUID userId) {
        UUID clubId = clubOf(userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("clubs", list());
        result.put("cost", FOUNDING_COST);
        result.put("icons", ICONS.stream().sorted().toList());
        if (clubId == null) return result;
        Map<String, Object> club = jdbc.queryForMap("SELECT id, name, tag, color, icon, motto, room_id AS \"roomId\", owner_id AS \"ownerId\" "
                + "FROM clubs WHERE id = ?", clubId);
        List<Map<String, Object>> members = jdbc.queryForList("SELECT u.id, u.username, u.hotel_look AS look, m.role "
                + "FROM club_members m JOIN users u ON u.id = m.user_id WHERE m.club_id = ? ORDER BY m.role DESC, m.joined_at", clubId);
        members.forEach(m -> {
            HotelSession session = registry.sessionOf((UUID) m.get("id"));
            m.put("online", session != null);
            RoomInstance room = session == null ? null : registry.get(session.roomId());
            m.put("roomName", room == null ? null : room.data().name());
            m.put("roomId", room == null ? null : room.data().id());
        });
        club.put("members", members);
        result.put("club", club);
        return result;
    }

    /** Punti per club in un'edizione di un evento (la classifica dei club nel pannello eventi). */
    public List<Map<String, Object>> eventBoard(String eventKey, java.time.LocalDate edition) {
        return jdbc.queryForList("SELECT c.name, c.tag, c.color, sum(s.score) AS score FROM hotel_event_scores s "
                + "JOIN club_members m ON m.user_id = s.user_id JOIN clubs c ON c.id = m.club_id "
                + "WHERE s.event_key = ? AND s.edition = ? GROUP BY c.id, c.name, c.tag, c.color ORDER BY score DESC LIMIT 5",
                eventKey, java.sql.Date.valueOf(edition));
    }

    /** Chi e' nell'hotel vede subito la sigla nuova (o nessuna). */
    private void refresh(UUID userId) {
        HotelSession session = registry.sessionOf(userId);
        if (session == null || session.user() == null) return;
        HotelUser updated = session.user().withClub(badgeOf(userId));
        session.authenticate(updated);
        RoomInstance room = registry.get(session.roomId());
        if (room != null) room.updateUser(updated);
    }
}
