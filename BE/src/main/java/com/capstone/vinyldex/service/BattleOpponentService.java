package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CollectionEntryDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelSession;
import com.capstone.vinyldex.hotel.PvpService;
import com.capstone.vinyldex.hotel.RoomInstance;
import com.capstone.vinyldex.hotel.RoomRegistry;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Avversari delle battaglie fuori dall'hotel (pagina Battaglie):
 *
 * - giocatori con almeno tre carte, da affrontare anche offline: si gioca contro la loro squadra
 *   salvata piu' recente (se hanno ancora quelle carte) o contro le loro tre carte piu' forti;
 * - giocatori collegati in questo momento (hotel o Battaglie), da sfidare in tempo reale con la
 *   PvP del server (PvpService.challengeOnline).
 */
@Service
public class BattleOpponentService {

    static final int TEAM_SIZE = 3;
    private static final int LIST_LIMIT = 30;

    private final UserRepository users;
    private final UserCardRepository userCards;
    private final JdbcTemplate jdbc;
    private final RoomRegistry registry;
    private final PvpService pvp;

    public BattleOpponentService(UserRepository users, UserCardRepository userCards, JdbcTemplate jdbc,
                                 RoomRegistry registry, PvpService pvp) {
        this.users = users;
        this.userCards = userCards;
        this.jdbc = jdbc;
        this.registry = registry;
        this.pvp = pvp;
    }

    /** Giocatori da affrontare con la loro squadra: i piu' vittoriosi, o quelli che corrispondono a q. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> opponents(UUID me, String q) {
        String query = q == null ? "" : q.trim().toLowerCase();
        return jdbc.query("""
                SELECT u.id, u.username, u.level, u.battles_won, u.avatar, count(uc.id) AS cards
                FROM users u JOIN user_cards uc ON uc.user_id = u.id AND uc.quantity > 0
                WHERE u.id <> ? AND NOT u.is_npc AND NOT u.banned
                  AND (? = '' OR lower(u.username) LIKE '%' || ? || '%')
                GROUP BY u.id, u.username, u.level, u.battles_won, u.avatar
                HAVING count(uc.id) >= ?
                ORDER BY u.battles_won DESC, u.level DESC, u.username
                LIMIT ?""", (rs, i) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", rs.getObject("id", UUID.class));
            row.put("username", rs.getString("username"));
            row.put("level", rs.getInt("level"));
            row.put("battlesWon", rs.getInt("battles_won"));
            row.put("avatar", rs.getString("avatar"));
            row.put("cards", rs.getInt("cards"));
            row.put("online", registry.sessionOf(rs.getObject("id", UUID.class)) != null);
            return row;
        }, me, query, query, TEAM_SIZE, LIST_LIMIT);
    }

    /**
     * La squadra con cui l'avversario si difende: l'ultima salvata, se ha ancora tutte quelle
     * carte, altrimenti le sue tre carte piu' forti (somma delle statistiche).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> team(UUID me, UUID opponentId) {
        if (opponentId == null || opponentId.equals(me)) throw ApiException.badRequest("cannot_challenge_yourself");
        User opponent = users.findById(opponentId).filter(u -> !u.isNpc() && !u.isBanned())
                .orElseThrow(() -> ApiException.notFound("user_not_found"));
        List<UserCard> owned = userCards.findByUserIdWithCard(opponentId).stream().filter(uc -> uc.getQuantity() > 0).toList();
        Map<String, UserCard> byCode = owned.stream()
                .collect(Collectors.toMap(uc -> uc.getCard().getCode(), Function.identity(), (a, b) -> a));

        List<UserCard> team = new ArrayList<>();
        String source = "best";
        List<String> saved = jdbc.query("SELECT cards FROM user_battle_teams WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                (rs, i) -> rs.getString(1), opponentId);
        if (!saved.isEmpty() && saved.getFirst() != null) {
            List<UserCard> fromSaved = Arrays.stream(saved.getFirst().split(",")).map(String::trim)
                    .map(byCode::get).filter(java.util.Objects::nonNull).distinct().limit(TEAM_SIZE).toList();
            if (fromSaved.size() == TEAM_SIZE) {
                team.addAll(fromSaved);
                source = "saved";
            }
        }
        if (team.isEmpty()) {
            owned.stream()
                    .sorted(Comparator.comparingInt((UserCard uc) -> total(uc.getCard())).reversed())
                    .map(uc -> uc.getCard().getCode()).distinct().limit(TEAM_SIZE)
                    .forEach(code -> team.add(byCode.get(code)));
        }
        if (team.size() < TEAM_SIZE) throw ApiException.badRequest("opponent_no_team");

        Map<String, Object> view = new LinkedHashMap<>();
        view.put("opponent", Map.of("id", opponent.getId(), "username", opponent.getUsername(), "level", opponent.getLevel()));
        view.put("source", source);
        view.put("team", team.stream().map(uc -> CollectionEntryDto.from(uc.getCard(), uc)).toList());
        return view;
    }

    /** Giocatori collegati adesso (hotel o Battaglie), da sfidare in tempo reale. */
    public List<Map<String, Object>> online(UUID me) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (HotelSession session : registry.onlineSessions()) {
            if (session.user() == null || session.user().id().equals(me)) continue;
            RoomInstance room = registry.get(session.roomId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", session.user().id());
            row.put("username", session.user().username());
            row.put("look", session.user().look());
            row.put("where", room == null ? "Battaglie" : room.data().name());
            row.put("busy", pvp.isBusy(session.user().id()));
            list.add(row);
        }
        list.sort(Comparator.comparing((Map<String, Object> r) -> (Boolean) r.get("busy"))
                .thenComparing(r -> String.valueOf(r.get("username")), String.CASE_INSENSITIVE_ORDER));
        return list;
    }

    private static int total(Card card) {
        return card.getFans() + card.getStyle() + card.getInfluence() + card.getEnergy();
    }
}
