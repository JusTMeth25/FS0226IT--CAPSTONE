package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Room;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.LevelService;
import com.capstone.vinyldex.service.UserCardService;
import com.capstone.vinyldex.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Vita sociale dell'hotel: feste nelle stanze (con XP a chi partecipa), banchetti per vendere
 * carte nella propria stanza, foto dell'hotel nel profilo, posta fra amici con gold e carte.
 */
@Service
public class CommunityService {

    private static final Logger LOG = LoggerFactory.getLogger(CommunityService.class);
    static final Duration PARTY_LENGTH = Duration.ofMinutes(30);
    static final Duration PARTY_STEP = Duration.ofMinutes(5);
    static final int PARTY_XP = 15;
    static final int PARTY_REWARDS = 6;
    public static final int STALL_SLOTS = 6;
    public static final String STALL_TYPE = "card_stall";
    static final int MAX_PHOTOS = 12;
    static final int MAX_PHOTO_CHARS = 1_500_000;
    private static final Pattern PHOTO = Pattern.compile("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$");

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final CardRepository cardRepository;
    private final UserCardService userCardService;
    private final WalletService walletService;
    private final LevelService levelService;
    private final RoomRegistry registry;
    private final FriendService friendService;
    private final TransactionTemplate tx;

    public CommunityService(JdbcTemplate jdbc, UserRepository userRepository, RoomRepository roomRepository,
                            CardRepository cardRepository, UserCardService userCardService, WalletService walletService,
                            LevelService levelService, RoomRegistry registry, FriendService friendService,
                            PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.cardRepository = cardRepository;
        this.userCardService = userCardService;
        this.walletService = walletService;
        this.levelService = levelService;
        this.registry = registry;
        this.friendService = friendService;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // ------------------------------------------------------------------ feste

    /** Il proprietario lancia una festa nella sua stanza: mezz'ora in cima al navigatore. */
    /** Temi della festa: musica e luci nella stanza (RoomInstance.startParty). */
    static final java.util.Set<String> PARTY_THEMES = java.util.Set.of("classic", "disco", "rock", "neon", "lounge");

    @Transactional
    public Map<String, Object> startParty(UUID userId, UUID roomId, String rawTitle) {
        return startParty(userId, roomId, rawTitle, "classic");
    }

    @Transactional
    public Map<String, Object> startParty(UUID userId, UUID roomId, String rawTitle, String rawTheme) {
        String theme = rawTheme != null && PARTY_THEMES.contains(rawTheme) ? rawTheme : "classic";
        Room room = roomRepository.findWithOwner(roomId).orElseThrow(() -> ApiException.notFound("room_not_found"));
        if (room.getOwner() == null || !room.getOwner().getId().equals(userId)) throw ApiException.forbidden("not_your_room");
        String title = rawTitle == null || rawTitle.isBlank() ? "Festa da " + room.getOwner().getUsername() : rawTitle.trim();
        if (title.length() > 60) title = title.substring(0, 60);
        Instant ends = Instant.now().plus(PARTY_LENGTH);
        jdbc.update("INSERT INTO room_parties (room_id, host_id, title, ends_at, theme) VALUES (?, ?, ?, ?, ?) "
                + "ON CONFLICT (room_id) DO UPDATE SET title = EXCLUDED.title, starts_at = now(), ends_at = EXCLUDED.ends_at, theme = EXCLUDED.theme",
                roomId, userId, title, Timestamp.from(ends), theme);
        RoomInstance live = registry.get(roomId);
        if (live != null) live.startParty(theme, ends.toEpochMilli());
        jdbc.update("DELETE FROM party_guests WHERE room_id = ?", roomId);
        registry.broadcastAll(Map.of("type", "party", "phase", "start", "roomId", roomId, "title", title,
                "host", room.getOwner().getUsername(), "endsAt", ends.toString(), "theme", theme));
        return Map.of("roomId", roomId, "title", title, "endsAt", ends, "theme", theme);
    }

    /**
     * Stanza appena caricata in memoria (nessuno c'era dentro quando la festa e' cominciata):
     * se la festa e' ancora in corso ripartono tema, luci e musica.
     */
    public void resumeParty(UUID roomId) {
        RoomInstance live = registry.get(roomId);
        if (live == null) return;
        jdbc.queryForList("SELECT theme, ends_at FROM room_parties WHERE room_id = ? AND ends_at > now()", roomId)
                .forEach(row -> live.startParty(row.get("theme") == null ? "classic" : (String) row.get("theme"),
                        ((Timestamp) row.get("ends_at")).getTime()));
    }

    @Transactional
    public void stopParty(UUID userId, UUID roomId) {
        int removed = jdbc.update("DELETE FROM room_parties WHERE room_id = ? AND host_id = ?", roomId, userId);
        RoomInstance live = registry.get(roomId);
        if (removed > 0 && live != null) live.stopParty();
    }

    /** Feste in corso, per il navigatore (le piu' affollate prima). */
    public List<Map<String, Object>> parties() {
        List<Map<String, Object>> list = jdbc.queryForList("SELECT p.room_id AS \"roomId\", p.title, p.ends_at AS \"endsAt\", u.username AS host, r.name AS \"roomName\" "
                + "FROM room_parties p JOIN users u ON u.id = p.host_id JOIN rooms r ON r.id = p.room_id WHERE p.ends_at > now()");
        list.forEach(p -> p.put("users", registry.userCount((UUID) p.get("roomId"))));
        list.sort((a, b) -> Integer.compare((int) b.get("users"), (int) a.get("users")));
        return list;
    }

    /** Ogni minuto: a chi e' alla festa da cinque minuti, un po' di XP (sei volte al massimo). */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void rewardParties() {
        try {
            tx.executeWithoutResult(status -> {
                jdbc.update("DELETE FROM room_parties WHERE ends_at < now() - interval '1 hour'");
                for (Map<String, Object> party : jdbc.queryForList("SELECT room_id FROM room_parties WHERE ends_at > now()")) {
                    UUID roomId = (UUID) party.get("room_id");
                    RoomInstance room = registry.get(roomId);
                    if (room == null) continue;
                    for (UUID userId : room.humanIds()) rewardGuest(roomId, userId);
                }
            });
        } catch (RuntimeException ex) {
            LOG.warn("XP delle feste non assegnati: {}", ex.getMessage());
        }
    }

    private void rewardGuest(UUID roomId, UUID userId) {
        int inserted = jdbc.update("INSERT INTO party_guests (room_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", roomId, userId);
        if (inserted > 0) return;
        int due = jdbc.update("UPDATE party_guests SET rewards = rewards + 1, last_at = now() WHERE room_id = ? AND user_id = ? "
                + "AND rewards < ? AND last_at < now() - make_interval(mins => ?)", roomId, userId, PARTY_REWARDS, (int) PARTY_STEP.toMinutes());
        if (due == 0) return;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        user.setXp(user.getXp() + PARTY_XP);
        user.setLevel(levelService.calcLevel(user.getXp()));
        userRepository.save(user);
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(Map.of("type", "party_xp", "xp", PARTY_XP));
    }

    // ------------------------------------------------------------------ banchetti

    private Map<String, Object> stallItem(UUID itemId) {
        return jdbc.queryForList("SELECT id, owner_id, room_id, furni_type FROM room_items WHERE id = ?", itemId)
                .stream().findFirst().orElseThrow(() -> ApiException.notFound("item_not_found"));
    }

    /** Carte in vendita sul banchetto. */
    @Transactional(readOnly = true)
    public Map<String, Object> stall(UUID itemId) {
        Map<String, Object> item = stallItem(itemId);
        if (!STALL_TYPE.equals(item.get("furni_type"))) throw ApiException.badRequest("not_a_stall");
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT s.id, s.price, s.card_id, u.username AS seller FROM stall_items s "
                + "JOIN users u ON u.id = s.seller_id WHERE s.item_id = ? ORDER BY s.created_at", itemId);
        rows.forEach(r -> {
            Card card = cardRepository.findById((UUID) r.remove("card_id")).orElse(null);
            r.put("card", card == null ? null : CardDto.from(card));
        });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("itemId", itemId);
        result.put("ownerId", item.get("owner_id"));
        result.put("slots", STALL_SLOTS);
        result.put("items", rows);
        return result;
    }

    /** Il proprietario del banchetto mette in vendita una sua carta. */
    @Transactional
    public Map<String, Object> stallAdd(UUID userId, UUID itemId, String cardCode, int price) {
        Map<String, Object> item = stallItem(itemId);
        if (!STALL_TYPE.equals(item.get("furni_type"))) throw ApiException.badRequest("not_a_stall");
        if (!userId.equals(item.get("owner_id"))) throw ApiException.forbidden("not_your_stall");
        if (price < 1 || price > 100_000) throw ApiException.badRequest("stall_price");
        Integer used = jdbc.queryForObject("SELECT count(*) FROM stall_items WHERE item_id = ?", Integer.class, itemId);
        if (used != null && used >= STALL_SLOTS) throw ApiException.badRequest("stall_full");
        Card card = cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        User user = userRepository.findById(userId).orElseThrow();
        Integer listed = jdbc.queryForObject("SELECT count(*) FROM stall_items WHERE seller_id = ? AND card_id = ?", Integer.class, userId, card.getId());
        if (!userCardService.owns(user, card, (listed == null ? 0 : listed) + 1)) throw ApiException.badRequest("card_not_owned");
        jdbc.update("INSERT INTO stall_items (item_id, seller_id, card_id, price) VALUES (?, ?, ?, ?)", itemId, userId, card.getId(), price);
        return stall(itemId);
    }

    @Transactional
    public Map<String, Object> stallRemove(UUID userId, UUID stallItemId) {
        UUID itemId = jdbc.query("SELECT item_id FROM stall_items WHERE id = ? AND seller_id = ?",
                rs -> rs.next() ? (UUID) rs.getObject(1) : null, stallItemId, userId);
        if (itemId == null) throw ApiException.notFound("stall_item_not_found");
        jdbc.update("DELETE FROM stall_items WHERE id = ?", stallItemId);
        return stall(itemId);
    }

    /** Un visitatore compra una carta dal banchetto: i gold al venditore, la carta a lui. */
    @Transactional
    public Map<String, Object> stallBuy(UUID buyerId, UUID stallItemId) {
        Map<String, Object> row = jdbc.queryForList("SELECT * FROM stall_items WHERE id = ? FOR UPDATE", stallItemId)
                .stream().findFirst().orElseThrow(() -> ApiException.notFound("stall_item_not_found"));
        UUID sellerId = (UUID) row.get("seller_id");
        if (buyerId.equals(sellerId)) throw ApiException.badRequest("stall_own_item");
        int price = (Integer) row.get("price");
        Card card = cardRepository.findById((UUID) row.get("card_id")).orElseThrow(() -> ApiException.notFound("card_not_found"));
        User seller = userRepository.findById(sellerId).orElseThrow();
        User buyer = userRepository.findById(buyerId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        jdbc.update("DELETE FROM stall_items WHERE id = ?", stallItemId);
        jdbc.update("INSERT INTO market_sales (card_id, price, quantity, channel) VALUES (?, ?, 1, 'stall')", card.getId(), price);
        if (!userCardService.owns(seller, card, 1)) throw ApiException.badRequest("stall_card_gone");
        walletService.adjustGold(buyerId, -price, WalletTransactionType.STALL, card.getCode(), "Banchetto di " + seller.getUsername() + ": " + card.getName());
        walletService.adjustGold(sellerId, price, WalletTransactionType.STALL, card.getCode(), "Venduta al banchetto: " + card.getName());
        userCardService.remove(seller, card, 1);
        userCardService.add(buyer, card, 1);
        HotelSession session = registry.sessionOf(sellerId);
        if (session != null) {
            session.send(Map.of("type", "stall_sold", "buyer", buyer.getUsername(), "card", card.getName(), "gold", price));
        }
        return stall((UUID) row.get("item_id"));
    }

    // ------------------------------------------------------------------ foto

    @Transactional
    public Map<String, Object> savePhoto(UUID userId, String image, String roomName) {
        if (image == null || image.length() > MAX_PHOTO_CHARS || !PHOTO.matcher(image).matches()) throw ApiException.badRequest("photo_invalid");
        jdbc.update("INSERT INTO user_photos (user_id, room_name, image) VALUES (?, ?, ?)", userId,
                roomName == null ? null : roomName.substring(0, Math.min(80, roomName.length())), image);
        // Si tengono le dodici piu' recenti.
        jdbc.update("DELETE FROM user_photos WHERE user_id = ? AND id NOT IN "
                + "(SELECT id FROM user_photos WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)", userId, userId, MAX_PHOTOS);
        return Map.of("photos", photos(userId));
    }

    public List<Map<String, Object>> photos(UUID userId) {
        return jdbc.queryForList("SELECT id, room_name AS \"roomName\", image, created_at AS \"createdAt\" FROM user_photos "
                + "WHERE user_id = ? ORDER BY created_at DESC", userId);
    }

    @Transactional
    public void deletePhoto(UUID userId, UUID photoId) {
        jdbc.update("DELETE FROM user_photos WHERE id = ? AND user_id = ?", photoId, userId);
    }

    // ------------------------------------------------------------------ posta

    /** Manda a un amico gold e/o una carta con un biglietto. Il mittente paga subito. */
    @Transactional
    public Map<String, Object> sendMail(UUID fromId, UUID toId, int gold, String cardCode, String rawNote) {
        return sendMail(fromId, toId, gold, cardCode, rawNote, null);
    }

    /**
     * Come sopra, con in piu' un mobile della borsa (non posizionato in una stanza): passa subito
     * all'amico, che lo trova nella sua borsa; la lettera dice da chi arriva.
     */
    @Transactional
    public Map<String, Object> sendMail(UUID fromId, UUID toId, int gold, String cardCode, String rawNote, UUID furniItemId) {
        if (fromId.equals(toId)) throw ApiException.badRequest("mail_self");
        if (!friendService.areFriends(fromId, toId)) throw ApiException.badRequest("not_friends");
        if (gold < 0 || gold > 10_000) throw ApiException.badRequest("mail_gold");
        Card card = cardCode == null || cardCode.isBlank() ? null
                : cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        if (gold == 0 && card == null && furniItemId == null) throw ApiException.badRequest("mail_empty");
        String note = rawNote == null || rawNote.isBlank() ? null : ChatFilter.clean(rawNote.trim());
        if (note != null && note.length() > 200) note = note.substring(0, 200);
        User from = userRepository.findById(fromId).orElseThrow();
        User to = userRepository.findById(toId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        if (gold > 0) walletService.adjustGold(fromId, -gold, WalletTransactionType.MAIL, toId.toString(), "Regalo per " + to.getUsername());
        if (card != null) userCardService.remove(from, card, 1);
        if (furniItemId != null) {
            int moved = jdbc.update("UPDATE room_items SET owner_id = ? WHERE id = ? AND owner_id = ? AND room_id IS NULL",
                    toId, furniItemId, fromId);
            if (moved == 0) throw ApiException.badRequest("mail_furni_unavailable");
        }
        jdbc.update("INSERT INTO hotel_mail (from_id, to_id, gold, card_id, note, furni_item_id) VALUES (?, ?, ?, ?, ?, ?)",
                fromId, toId, gold, card == null ? null : card.getId(), note, furniItemId);
        HotelSession session = registry.sessionOf(toId);
        if (session != null) session.send(Map.of("type", "mail", "from", from.getUsername()));
        return mailbox(fromId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mailbox(UUID userId) {
        List<Map<String, Object>> inbox = jdbc.queryForList("SELECT m.id, u.username AS \"from\", m.gold, m.card_id, m.note, "
                + "i.furni_type AS furni, m.created_at AS \"createdAt\", m.claimed_at AS \"claimedAt\" FROM hotel_mail m "
                + "LEFT JOIN users u ON u.id = m.from_id LEFT JOIN room_items i ON i.id = m.furni_item_id "
                + "WHERE m.to_id = ? ORDER BY m.claimed_at NULLS FIRST, m.created_at DESC LIMIT 40", userId);
        inbox.forEach(m -> {
            UUID cardId = (UUID) m.remove("card_id");
            Card card = cardId == null ? null : cardRepository.findById(cardId).orElse(null);
            m.put("card", card == null ? null : CardDto.from(card));
        });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inbox", inbox);
        result.put("unread", inbox.stream().filter(m -> m.get("claimedAt") == null).count());
        return result;
    }

    /** Ritira il contenuto di una lettera. */
    @Transactional
    public Map<String, Object> claimMail(UUID userId, UUID mailId) {
        Map<String, Object> mail = jdbc.queryForList("SELECT * FROM hotel_mail WHERE id = ? AND to_id = ? AND claimed_at IS NULL FOR UPDATE",
                mailId, userId).stream().findFirst().orElseThrow(() -> ApiException.notFound("mail_not_found"));
        jdbc.update("UPDATE hotel_mail SET claimed_at = now() WHERE id = ?", mailId);
        int gold = (Integer) mail.get("gold");
        if (gold > 0) walletService.adjustGold(userId, gold, WalletTransactionType.MAIL, mailId.toString(), "Regalo ricevuto per posta");
        UUID cardId = (UUID) mail.get("card_id");
        if (cardId != null) {
            Card card = cardRepository.findById(cardId).orElse(null);
            if (card != null) userCardService.add(userRepository.findById(userId).orElseThrow(), card, 1);
        }
        return mailbox(userId);
    }
}
