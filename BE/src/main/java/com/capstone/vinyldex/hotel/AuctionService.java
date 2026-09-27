package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserRepository;
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
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Asta dell'hotel. Il banditore mette all'asta una carta alla volta (rara, epica o leggendaria):
 * chi offre di piu' se la porta a casa. I gold dell'offerta piu' alta restano bloccati e tornano
 * indietro se qualcuno rilancia. Un'offerta negli ultimi secondi allunga l'asta, cosi' nessuno
 * vince "rubando" all'ultimo istante.
 */
@Service
public class AuctionService {

    private static final Logger LOG = LoggerFactory.getLogger(AuctionService.class);
    public static final String AUCTIONEER = "Gerardo il banditore";
    static final Duration LENGTH = Duration.ofMinutes(5);
    static final Duration PAUSE = Duration.ofMinutes(2);
    static final Duration SNIPE_WINDOW = Duration.ofSeconds(30);
    static final Set<String> RARITIES = Set.of("rare", "epic", "legendary");

    private final JdbcTemplate jdbc;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final UserCardService userCardService;
    private final RoomRegistry registry;
    private final TransactionTemplate tx;
    private final Random random = new Random();

    public AuctionService(JdbcTemplate jdbc, CardRepository cardRepository, UserRepository userRepository,
                          WalletService walletService, UserCardService userCardService, RoomRegistry registry,
                          PlatformTransactionManager transactionManager) {
        this.tx = new TransactionTemplate(transactionManager);
        this.jdbc = jdbc;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.userCardService = userCardService;
        this.registry = registry;
    }

    /** Offerta minima dopo quella attuale: almeno 5 gold o il 5% in piu'. */
    static int minimumBid(int startBid, Integer currentBid) {
        if (currentBid == null) return startBid;
        return currentBid + Math.max(5, (int) Math.ceil(currentBid * 0.05));
    }

    /** Base d'asta: meta' del valore della carta per gli NPC, mai sotto i 20 gold. */
    static int startBid(Card card) {
        return Math.max(20, NpcDeals.value(card) / 2);
    }

    /** Nuova scadenza dopo un'offerta: se mancano meno di 30 secondi, si torna a 30. */
    static Instant extended(Instant endsAt, Instant now) {
        Instant floor = now.plus(SNIPE_WINDOW);
        return endsAt.isBefore(floor) ? floor : endsAt;
    }

    // ------------------------------------------------------------------ ciclo dell'asta

    @Scheduled(fixedDelay = 5_000, initialDelay = 25_000)
    public void tick() {
        try {
            // Chiamati da qui non passano dal proxy di Spring: la transazione si apre a mano.
            tx.executeWithoutResult(status -> closeExpired());
            tx.executeWithoutResult(status -> openIfIdle());
            tx.executeWithoutResult(status -> npcBid());
        } catch (RuntimeException ex) {
            LOG.warn("Asta dell'hotel: {}", ex.getMessage());
        }
    }

    @Transactional
    public void closeExpired() {
        List<Map<String, Object>> expired = jdbc.queryForList(
                "SELECT id FROM hotel_auctions WHERE status = 'OPEN' AND ends_at <= now() FOR UPDATE SKIP LOCKED");
        for (Map<String, Object> row : expired) close((UUID) row.get("id"));
    }

    private void close(UUID id) {
        Map<String, Object> lot = jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE id = ?", id);
        UUID bidderId = (UUID) lot.get("bidder_id");
        Card card = cardRepository.findById((UUID) lot.get("card_id")).orElse(null);
        if (bidderId == null || card == null) {
            // Nessuno ha offerto: la carta resta al banditore.
            jdbc.update("UPDATE hotel_auctions SET status = 'UNSOLD' WHERE id = ?", id);
            registry.broadcastAll(Map.of("type", "auction", "phase", "unsold", "lot", view(jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE id = ?", id))));
            return;
        }
        User winner = userRepository.findById(bidderId).orElseThrow();
        userCardService.add(winner, card, 1);
        // Vinta da un NPC: la carta finisce anche nella sua vetrina degli scambi, cosi' si puo' provare a prenderla.
        if (npcPlayers != null) npcPlayers.bot(bidderId).ifPresent(bot -> jdbc.update(
                "INSERT INTO hotel_npc_found_cards (id, npc_id, card_id) VALUES (gen_random_uuid(), ?, ?) ON CONFLICT DO NOTHING",
                bot.npcId(), card.getId()));
        jdbc.update("UPDATE hotel_auctions SET status = 'SOLD' WHERE id = ?", id);
        registry.broadcastAll(Map.of("type", "auction", "phase", "sold", "lot", view(jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE id = ?", id))));
    }

    @Transactional
    public void openIfIdle() {
        Integer open = jdbc.queryForObject("SELECT count(*) FROM hotel_auctions WHERE status = 'OPEN'", Integer.class);
        if (open != null && open > 0) return;
        Timestamp last = jdbc.query("SELECT max(ends_at) FROM hotel_auctions", rs -> rs.next() ? rs.getTimestamp(1) : null);
        if (last != null && last.toInstant().plus(PAUSE).isAfter(Instant.now())) return;
        List<Card> pool = cardRepository.findAllActiveWithArtistClass().stream()
                .filter(c -> RARITIES.contains(c.getRarity()) && c.getImgUrl() != null && !c.getImgUrl().isBlank())
                .toList();
        if (pool.isEmpty()) return;
        // Le leggendarie escono piu' di rado.
        Card card = pool.get(random.nextInt(pool.size()));
        if ("legendary".equals(card.getRarity()) && random.nextInt(3) != 0) card = pool.get(random.nextInt(pool.size()));
        Instant ends = Instant.now().plus(LENGTH);
        jdbc.update("INSERT INTO hotel_auctions (card_id, start_bid, ends_at) VALUES (?, ?, ?)",
                card.getId(), startBid(card), Timestamp.from(ends));
        Map<String, Object> lot = jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE status = 'OPEN' ORDER BY starts_at DESC LIMIT 1");
        registry.broadcastAll(Map.of("type", "auction", "phase", "lot", "lot", view(lot)));
    }

    // ------------------------------------------------------------------ offerte degli NPC

    private NpcPlayers npcPlayers;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setNpcPlayers(@org.springframework.context.annotation.Lazy NpcPlayers npcPlayers) {
        this.npcPlayers = npcPlayers;
    }

    /**
     * Quanto un NPC e' disposto a spendere per un lotto: fra il 90% e il 130% del valore della carta,
     * sempre lo stesso per lo stesso lotto (cosi' non rilancia all'infinito).
     */
    static int npcCap(Card card, UUID lotId) {
        double factor = 0.9 + Math.floorMod(lotId.hashCode(), 41) / 100.0;
        return (int) Math.round(Math.max(20, NpcDeals.value(card)) * factor);
    }

    /**
     * Ogni tanto un NPC rilancia: mai contro se' stesso o un altro NPC appena passato in testa,
     * mai oltre il suo tetto. I giocatori veri possono sempre superarlo.
     */
    @Transactional
    public void npcBid() {
        if (npcPlayers == null || npcPlayers.bots().isEmpty() || random.nextInt(100) >= 12) return;
        Map<String, Object> lot = jdbc.queryForList("SELECT * FROM hotel_auctions WHERE status = 'OPEN' AND ends_at > now() "
                + "ORDER BY starts_at DESC LIMIT 1").stream().findFirst().orElse(null);
        if (lot == null) return;
        UUID top = (UUID) lot.get("bidder_id");
        if (npcPlayers.isBot(top)) return;
        Card card = cardRepository.findById((UUID) lot.get("card_id")).orElse(null);
        if (card == null) return;
        int next = minimumBid((Integer) lot.get("start_bid"), (Integer) lot.get("current_bid"));
        if (next > npcCap(card, (UUID) lot.get("id"))) return;
        NpcPlayers.Bot bot = npcPlayers.randomBot();
        User user = userRepository.findById(bot.userId()).orElse(null);
        if (user == null) return;
        // Gli NPC hanno sempre abbastanza gold per giocare.
        if (user.getGold() < next + 1_000) {
            walletService.adjustGold(bot.userId(), 10_000, WalletTransactionType.AUCTION, "npc", "Fondi dell'NPC per l'asta");
        }
        bid(bot.userId(), next);
    }

    // ------------------------------------------------------------------ offerte

    /** Offerta di un giocatore: blocca i suoi gold e restituisce quelli di chi aveva offerto prima. */
    @Transactional
    public Map<String, Object> bid(UUID userId, int amount) {
        Map<String, Object> lot = jdbc.queryForList("SELECT * FROM hotel_auctions WHERE status = 'OPEN' AND ends_at > now() "
                        + "ORDER BY starts_at DESC LIMIT 1 FOR UPDATE").stream().findFirst().orElse(null);
        if (lot == null) throw ApiException.badRequest("auction_closed");
        UUID id = (UUID) lot.get("id");
        Integer current = (Integer) lot.get("current_bid");
        UUID previous = (UUID) lot.get("bidder_id");
        if (userId.equals(previous)) throw ApiException.badRequest("auction_already_top");
        int minimum = minimumBid((Integer) lot.get("start_bid"), current);
        if (amount < minimum) throw ApiException.badRequest("auction_bid_low");
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        walletService.adjustGold(userId, -amount, WalletTransactionType.AUCTION, "auction:" + id, "Offerta all'asta");
        if (previous != null && current != null) {
            walletService.adjustGold(previous, current, WalletTransactionType.AUCTION, "auction:" + id, "Offerta superata: gold restituiti");
            HotelSession outbid = registry.sessionOf(previous);
            if (outbid != null) outbid.send(Map.of("type", "auction", "phase", "outbid", "by", user.getUsername(), "amount", amount));
        }
        Instant endsAt = ((Timestamp) lot.get("ends_at")).toInstant();
        jdbc.update("UPDATE hotel_auctions SET current_bid = ?, bidder_id = ?, bidder_name = ?, bids = bids + 1, ends_at = ? WHERE id = ?",
                amount, userId, user.getUsername(), Timestamp.from(extended(endsAt, Instant.now())), id);
        Map<String, Object> updated = view(jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE id = ?", id));
        registry.broadcastAll(Map.of("type", "auction", "phase", "bid", "lot", updated));
        return updated;
    }

    // ------------------------------------------------------------------ admin

    /** L'admin mette all'asta subito una carta a scelta. */
    @Transactional
    public Map<String, Object> startNow(String cardCode, Integer startBid, Integer minutes) {
        Integer open = jdbc.queryForObject("SELECT count(*) FROM hotel_auctions WHERE status = 'OPEN'", Integer.class);
        if (open != null && open > 0) throw ApiException.badRequest("auction_open");
        Card card = cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        int base = startBid == null || startBid < 1 ? startBid(card) : startBid;
        int length = minutes == null || minutes < 1 || minutes > 120 ? (int) LENGTH.toMinutes() : minutes;
        jdbc.update("INSERT INTO hotel_auctions (card_id, start_bid, ends_at) VALUES (?, ?, ?)",
                card.getId(), base, Timestamp.from(Instant.now().plus(Duration.ofMinutes(length))));
        Map<String, Object> lot = jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE status = 'OPEN' ORDER BY starts_at DESC LIMIT 1");
        registry.broadcastAll(Map.of("type", "auction", "phase", "lot", "lot", view(lot)));
        return overview();
    }

    /** L'admin annulla l'asta in corso: i gold bloccati tornano a chi aveva offerto. */
    @Transactional
    public Map<String, Object> cancel() {
        Map<String, Object> lot = jdbc.queryForList("SELECT * FROM hotel_auctions WHERE status = 'OPEN' FOR UPDATE").stream().findFirst().orElse(null);
        if (lot == null) throw ApiException.badRequest("auction_closed");
        UUID bidder = (UUID) lot.get("bidder_id");
        Integer current = (Integer) lot.get("current_bid");
        if (bidder != null && current != null) {
            walletService.adjustGold(bidder, current, WalletTransactionType.AUCTION, "auction:" + lot.get("id"), "Asta annullata: gold restituiti");
        }
        jdbc.update("UPDATE hotel_auctions SET status = 'UNSOLD', ends_at = now() WHERE id = ?", lot.get("id"));
        registry.broadcastAll(Map.of("type", "auction", "phase", "unsold", "lot", view(jdbc.queryForMap("SELECT * FROM hotel_auctions WHERE id = ?", lot.get("id")))));
        return overview();
    }

    // ------------------------------------------------------------------ vista

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("auctioneer", AUCTIONEER);
        Map<String, Object> open = jdbc.queryForList("SELECT * FROM hotel_auctions WHERE status = 'OPEN' ORDER BY starts_at DESC LIMIT 1").stream().findFirst().orElse(null);
        result.put("lot", open == null ? null : view(open));
        Timestamp last = jdbc.query("SELECT max(ends_at) FROM hotel_auctions", rs -> rs.next() ? rs.getTimestamp(1) : null);
        result.put("nextAt", open != null || last == null ? null : last.toInstant().plus(PAUSE));
        result.put("recent", jdbc.queryForList("SELECT * FROM hotel_auctions WHERE status <> 'OPEN' ORDER BY ends_at DESC LIMIT 5")
                .stream().map(this::view).toList());
        return result;
    }

    private Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", row.get("id"));
        Card card = cardRepository.findById((UUID) row.get("card_id")).orElse(null);
        view.put("card", card == null ? null : CardDto.from(card));
        Integer current = (Integer) row.get("current_bid");
        view.put("startBid", row.get("start_bid"));
        view.put("currentBid", current);
        view.put("minimumBid", minimumBid((Integer) row.get("start_bid"), current));
        view.put("bidderId", row.get("bidder_id"));
        view.put("bidderName", row.get("bidder_name"));
        view.put("bids", row.get("bids"));
        view.put("endsAt", ((Timestamp) row.get("ends_at")).toInstant());
        view.put("status", row.get("status"));
        return view;
    }
}
