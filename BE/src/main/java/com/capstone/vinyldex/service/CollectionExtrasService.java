package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.NpcRoster;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Funzioni della collezione attorno alle carte: lista dei desideri con gli avvisi, squadre da
 * battaglia salvate, confronto fra due collezioni, statistiche e prima edizione numerata.
 */
@Service
public class CollectionExtrasService {

    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    public static final int MAX_TEAMS = 3;
    public static final int TEAM_SIZE = 3;
    public static final int MAX_WISHES = 50;
    public static final int FIRST_EDITION_SIZE = 10;
    /** Una copia di prima edizione vale una volta e mezza una copia normale. */
    public static final double FIRST_EDITION_MULTIPLIER = 1.5;
    static final Map<String, Integer> RARITY_POINTS = Map.of("common", 1, "uncommon", 2, "rare", 3, "epic", 4, "legendary", 5);

    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbc;

    public CollectionExtrasService(CardRepository cardRepository, UserCardRepository userCardRepository,
                                   UserRepository userRepository, JdbcTemplate jdbc) {
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
        this.userRepository = userRepository;
        this.jdbc = jdbc;
    }

    private Card card(String code) {
        return cardRepository.findByCode(code).orElseThrow(() -> ApiException.notFound("card_not_found"));
    }

    private Map<UUID, Card> cardsById(Set<UUID> ids) {
        return cardRepository.findAllById(ids).stream().collect(Collectors.toMap(Card::getId, c -> c));
    }

    // ------------------------------------------------------------------ lista dei desideri

    /**
     * Carte desiderate e dove si trovano adesso: annunci del mercato, banchetti dei giocatori e
     * vetrine degli NPC. `available` conta quelle che si possono prendere subito.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> wishlist(UUID userId) {
        List<UUID> ids = jdbc.queryForList(
                "SELECT card_id FROM user_wishlist WHERE user_id = ? ORDER BY created_at DESC", UUID.class, userId);
        Map<UUID, Card> cards = cardsById(Set.copyOf(ids));
        Set<UUID> owned = userCardRepository.findByUserId(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).map(uc -> uc.getCard().getId()).collect(Collectors.toSet());

        Map<UUID, List<Map<String, Object>>> offers = new HashMap<>();
        if (!ids.isEmpty()) {
            String in = String.join(",", ids.stream().map(id -> "?").toList());
            Object[] args = ids.toArray();
            jdbc.query("SELECT m.card_id, m.price_per_unit, m.quantity, u.username FROM market_listings m "
                    + "JOIN users u ON u.id = m.seller_id WHERE m.status = 'ACTIVE' AND m.quantity > 0 AND m.seller_id <> ? "
                    + "AND m.card_id IN (" + in + ") ORDER BY m.price_per_unit", rs -> {
                Map<String, Object> offer = new LinkedHashMap<>();
                offer.put("where", "market");
                offer.put("price", rs.getInt("price_per_unit"));
                offer.put("seller", rs.getString("username"));
                offer.put("label", "Mercato: " + rs.getString("username") + " a " + rs.getInt("price_per_unit") + " gold");
                offers.computeIfAbsent(rs.getObject("card_id", UUID.class), k -> new ArrayList<>()).add(offer);
            }, prepend(userId, args));
            jdbc.query("SELECT s.card_id, s.price, u.username, r.id AS room_id, r.name AS room_name FROM stall_items s "
                    + "JOIN users u ON u.id = s.seller_id JOIN room_items i ON i.id = s.item_id JOIN rooms r ON r.id = i.room_id "
                    + "WHERE s.seller_id <> ? AND s.card_id IN (" + in + ") ORDER BY s.price", rs -> {
                Map<String, Object> offer = new LinkedHashMap<>();
                offer.put("where", "stall");
                offer.put("price", rs.getInt("price"));
                offer.put("seller", rs.getString("username"));
                offer.put("roomId", rs.getObject("room_id", UUID.class));
                offer.put("label", "Banchetto di " + rs.getString("username") + " (" + rs.getString("room_name") + ") a " + rs.getInt("price") + " gold");
                offers.computeIfAbsent(rs.getObject("card_id", UUID.class), k -> new ArrayList<>()).add(offer);
            }, prepend(userId, args));
            jdbc.query("SELECT card_id, npc_id FROM hotel_npc_found_cards WHERE card_id IN (" + in + ")", rs -> {
                UUID cardId = rs.getObject("card_id", UUID.class);
                NpcRoster.byId(rs.getObject("npc_id", UUID.class)).ifPresent(npc -> {
                    Map<String, Object> offer = new LinkedHashMap<>();
                    offer.put("where", "npc");
                    offer.put("seller", npc.spec().name());
                    offer.put("roomId", npc.roomId());
                    offer.put("label", npc.spec().name() + " nell'hotel: chiedigli uno scambio");
                    offers.computeIfAbsent(cardId, k -> new ArrayList<>()).add(offer);
                });
            }, args);
        }

        List<Map<String, Object>> entries = new ArrayList<>();
        int available = 0;
        for (UUID id : ids) {
            Card card = cards.get(id);
            if (card == null) continue;
            List<Map<String, Object>> where = offers.getOrDefault(id, List.of());
            if (!where.isEmpty()) available++;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("card", CardDto.from(card));
            entry.put("owned", owned.contains(id));
            entry.put("offers", where);
            entries.add(entry);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("wishes", entries);
        result.put("available", available);
        return result;
    }

    private static Object[] prepend(Object first, Object[] rest) {
        Object[] all = new Object[rest.length + 1];
        all[0] = first;
        System.arraycopy(rest, 0, all, 1, rest.length);
        return all;
    }

    /** Codici delle carte desiderate (per il cuoricino sulle carte). */
    @Transactional(readOnly = true)
    public List<String> wishCodes(UUID userId) {
        return jdbc.queryForList("SELECT c.code FROM user_wishlist w JOIN cards c ON c.id = w.card_id WHERE w.user_id = ?",
                String.class, userId);
    }

    @Transactional
    public Map<String, Object> addWish(UUID userId, String code) {
        Card card = card(code);
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM user_wishlist WHERE user_id = ?", Integer.class, userId);
        if (count != null && count >= MAX_WISHES) throw ApiException.badRequest("wishlist_full");
        jdbc.update("INSERT INTO user_wishlist (user_id, card_id) VALUES (?, ?) ON CONFLICT DO NOTHING", userId, card.getId());
        return Map.of("code", code, "wished", true);
    }

    @Transactional
    public Map<String, Object> removeWish(UUID userId, String code) {
        Card card = card(code);
        jdbc.update("DELETE FROM user_wishlist WHERE user_id = ? AND card_id = ?", userId, card.getId());
        return Map.of("code", code, "wished", false);
    }

    // ------------------------------------------------------------------ squadre salvate

    @Transactional(readOnly = true)
    public List<Map<String, Object>> teams(UUID userId) {
        return jdbc.query("SELECT id, name, cards FROM user_battle_teams WHERE user_id = ? ORDER BY created_at", (rs, i) -> {
            Map<String, Object> team = new LinkedHashMap<>();
            team.put("id", rs.getObject("id", UUID.class));
            team.put("name", rs.getString("name"));
            team.put("cards", Arrays.asList(rs.getString("cards").split(",")));
            return team;
        }, userId);
    }

    /** Salva una squadra di tre carte possedute; con lo stesso nome la sostituisce. */
    @Transactional
    public List<Map<String, Object>> saveTeam(UUID userId, String name, List<String> codes) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty() || clean.length() > 40) throw ApiException.badRequest("team_name_invalid");
        if (codes == null || codes.size() != TEAM_SIZE || Set.copyOf(codes).size() != TEAM_SIZE) {
            throw ApiException.badRequest("team_invalid");
        }
        Set<String> owned = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).map(uc -> uc.getCard().getCode()).collect(Collectors.toSet());
        if (!owned.containsAll(codes)) throw ApiException.badRequest("card_not_owned");
        int replaced = jdbc.update("UPDATE user_battle_teams SET cards = ? WHERE user_id = ? AND lower(name) = lower(?)",
                String.join(",", codes), userId, clean);
        if (replaced == 0) {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM user_battle_teams WHERE user_id = ?", Integer.class, userId);
            if (count != null && count >= MAX_TEAMS) throw ApiException.badRequest("teams_full");
            jdbc.update("INSERT INTO user_battle_teams (user_id, name, cards) VALUES (?, ?, ?)", userId, clean, String.join(",", codes));
        }
        return teams(userId);
    }

    @Transactional
    public List<Map<String, Object>> deleteTeam(UUID userId, UUID teamId) {
        jdbc.update("DELETE FROM user_battle_teams WHERE id = ? AND user_id = ?", teamId, userId);
        return teams(userId);
    }

    // ------------------------------------------------------------------ confronto collezioni

    /** Carte che ha l'altro e non tu, e quelle che hai tu e non lui: la base per uno scambio. */
    @Transactional(readOnly = true)
    public Map<String, Object> compare(UUID viewerId, UUID otherId) {
        User other = userRepository.findById(otherId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        Map<UUID, UserCard> mine = ownedMap(viewerId);
        Map<UUID, UserCard> theirs = ownedMap(otherId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("username", other.getUsername());
        result.put("theyHave", diff(theirs, mine));
        result.put("youHave", diff(mine, theirs));
        result.put("common", mine.keySet().stream().filter(theirs::containsKey).count());
        return result;
    }

    private Map<UUID, UserCard> ownedMap(UUID userId) {
        return userCardRepository.findByUserIdWithCard(userId).stream().filter(uc -> uc.getQuantity() > 0)
                .collect(Collectors.toMap(uc -> uc.getCard().getId(), uc -> uc, (a, b) -> a));
    }

    private static List<CardDto> diff(Map<UUID, UserCard> from, Map<UUID, UserCard> without) {
        return from.values().stream().filter(uc -> !without.containsKey(uc.getCard().getId()))
                .map(UserCard::getCard)
                .sorted(Comparator.comparingInt((Card c) -> -RARITY_POINTS.getOrDefault(c.getRarity(), 0))
                        .thenComparing(Card::getName))
                .limit(120)
                .map(CardDto::from)
                .toList();
    }

    // ------------------------------------------------------------------ statistiche

    /**
     * Numeri della collezione: carte per gioco e per rarita', valore nel tempo (le carte contate
     * dal giorno in cui sono arrivate, al prezzo di oggi), pacchetti aperti e fortuna media
     * rispetto a tutti i giocatori.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> stats(UUID userId) {
        List<UserCard> cards = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).toList();
        Map<String, Integer> bySource = new TreeMap<>();
        Map<String, Integer> byRarity = new LinkedHashMap<>();
        List.of("common", "uncommon", "rare", "epic", "legendary").forEach(r -> byRarity.put(r, 0));
        TreeMap<LocalDate, Double> added = new TreeMap<>();
        double total = 0;
        int copies = 0;
        for (UserCard uc : cards) {
            Card card = uc.getCard();
            bySource.merge(card.getSource() == null ? "original" : card.getSource(), 1, Integer::sum);
            byRarity.merge(card.getRarity(), 1, Integer::sum);
            double value = (card.getMarketPrice() == null ? 0 : card.getMarketPrice()) * uc.getQuantity();
            total += value;
            copies += uc.getQuantity();
            LocalDate day = uc.getObtainedAt() == null ? LocalDate.now(ZONE) : uc.getObtainedAt().atZone(ZONE).toLocalDate();
            added.merge(day, value, Double::sum);
        }

        // Valore cumulato giorno per giorno negli ultimi 30 giorni (prima: tutto nel primo punto).
        LocalDate today = LocalDate.now(ZONE);
        LocalDate start = today.minusDays(29);
        double running = added.headMap(start).values().stream().mapToDouble(Double::doubleValue).sum();
        List<Map<String, Object>> timeline = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(today); day = day.plusDays(1)) {
            running += added.getOrDefault(day, 0.0);
            timeline.add(Map.of("day", day.toString(), "value", Math.round(running * 100) / 100.0));
        }

        Integer packs = jdbc.queryForObject("SELECT COUNT(*) FROM pack_openings WHERE user_id = ?", Integer.class, userId);
        Double mine = luck("WHERE o.user_id = ?", userId);
        Double everyone = luck("", (Object[]) null);
        Integer legendaries = jdbc.queryForObject("SELECT COUNT(*) FROM pack_opening_cards pc JOIN pack_openings o ON o.id = pc.pack_opening_id "
                + "WHERE o.user_id = ? AND pc.rarity = 'legendary'", Integer.class, userId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("uniqueCards", cards.size());
        result.put("copies", copies);
        result.put("value", Math.round(total * 100) / 100.0);
        result.put("bySource", bySource);
        result.put("byRarity", byRarity);
        result.put("timeline", timeline);
        result.put("packsOpened", packs == null ? 0 : packs);
        result.put("legendaryPulls", legendaries == null ? 0 : legendaries);
        result.put("luck", mine);
        result.put("averageLuck", everyone);
        result.put("daysCollecting", added.isEmpty() ? 0 : ChronoUnit.DAYS.between(added.firstKey(), today) + 1);
        return result;
    }

    /** Punti rarita' medi delle carte uscite dai pacchetti (1 comune ... 5 leggendaria). */
    private Double luck(String where, Object... args) {
        String sql = "SELECT AVG(CASE pc.rarity WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 "
                + "WHEN 'epic' THEN 4 WHEN 'legendary' THEN 5 ELSE 1 END) FROM pack_opening_cards pc "
                + "JOIN pack_openings o ON o.id = pc.pack_opening_id " + where;
        Double avg = args == null ? jdbc.queryForObject(sql, Double.class) : jdbc.queryForObject(sql, Double.class, args);
        return avg == null ? null : Math.round(avg * 100) / 100.0;
    }

    // ------------------------------------------------------------------ prima edizione

    /**
     * Chi trova una carta fra i primi dieci riceve il numero seguente. Se due giocatori la
     * trovano nello stesso istante uno dei due resta senza: meglio che due numeri uguali.
     *
     * @return il numero assegnato, o null se la carta ha gia' dieci prime edizioni
     */
    @Transactional
    public Integer claimFirstEdition(UUID userId, UUID cardId) {
        List<Integer> existing = jdbc.queryForList(
                "SELECT serial FROM card_first_editions WHERE card_id = ? AND user_id = ?", Integer.class, cardId, userId);
        if (!existing.isEmpty()) return existing.get(0);
        int inserted = jdbc.update("INSERT INTO card_first_editions (card_id, serial, user_id) "
                + "SELECT ?, COALESCE(MAX(serial), 0) + 1, ? FROM card_first_editions WHERE card_id = ? "
                + "HAVING COALESCE(MAX(serial), 0) < ? ON CONFLICT DO NOTHING", cardId, userId, cardId, FIRST_EDITION_SIZE);
        if (inserted == 0) return null;
        return jdbc.queryForObject("SELECT serial FROM card_first_editions WHERE card_id = ? AND user_id = ?",
                Integer.class, cardId, userId);
    }

    /** Numeri di prima edizione del giocatore, per carta. */
    @Transactional(readOnly = true)
    public Map<UUID, Integer> firstEditions(UUID userId) {
        Map<UUID, Integer> serials = new HashMap<>();
        jdbc.query("SELECT card_id, serial FROM card_first_editions WHERE user_id = ?",
                rs -> { serials.put(rs.getObject("card_id", UUID.class), rs.getInt("serial")); }, userId);
        return serials;
    }

    public static int withFirstEdition(int gold, Integer serial) {
        return serial == null ? gold : (int) Math.round(gold * FIRST_EDITION_MULTIPLIER);
    }
}
