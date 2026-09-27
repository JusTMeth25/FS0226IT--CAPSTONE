package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Funzioni della collezione: la carta del giorno con la sua sfida, lo storico dei prezzi e la
 * fusione di tre doppioni in una carta della rarita' successiva.
 */
@Service
public class CardExtrasService {

    private static final Logger LOG = LoggerFactory.getLogger(CardExtrasService.class);
    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    public static final int DAILY_REWARD = 75;
    public static final List<String> RARITY_ORDER = List.of("common", "uncommon", "rare", "epic", "legendary");
    public static final int FUSION_SIZE = 3;

    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;
    private final UserRepository userRepository;
    private final UserCardService userCardService;
    private final WalletService walletService;
    private final JdbcTemplate jdbc;
    private final Random random = new Random();

    public CardExtrasService(CardRepository cardRepository, UserCardRepository userCardRepository, UserRepository userRepository,
                             UserCardService userCardService, WalletService walletService, JdbcTemplate jdbc) {
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
        this.userRepository = userRepository;
        this.userCardService = userCardService;
        this.walletService = walletService;
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ carta del giorno

    /** La carta del giorno: la stessa per tutti, scelta fra le carte con un'immagine. */
    static Card pickDaily(List<Card> cards, LocalDate day) {
        List<Card> pool = cards.stream()
                .filter(c -> c.getImgUrl() != null && !c.getImgUrl().isBlank() && !"common".equals(c.getRarity()))
                .sorted(Comparator.comparing(Card::getCode))
                .toList();
        if (pool.isEmpty()) return null;
        long seed = day.toEpochDay() * 2_654_435_761L;
        return pool.get((int) Math.floorMod(seed ^ (seed >>> 17), (long) pool.size()));
    }

    private Card today() {
        return pickDaily(cardRepository.findAllActiveWithArtistClass(), LocalDate.now(ZONE));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> daily(UUID userId) {
        Card card = today();
        Map<String, Object> result = new LinkedHashMap<>();
        if (card == null) return result;
        result.put("card", CardDto.from(card));
        result.put("reward", DAILY_REWARD);
        result.put("challenge", "Vinci una battaglia con " + card.getName() + " in squadra.");
        if (userId != null) {
            result.put("owned", userCardRepository.findByUserIdAndCardId(userId, card.getId()).map(uc -> uc.getQuantity() > 0).orElse(false));
            result.put("claimed", claimedToday(userId));
        }
        return result;
    }

    private boolean claimedToday(UUID userId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM daily_card_claims WHERE user_id = ? AND day = ?", Integer.class,
                userId, Date.valueOf(LocalDate.now(ZONE)));
        return n != null && n > 0;
    }

    /** Dopo una battaglia: se l'ha vinta con la carta del giorno in squadra, premio (una volta al giorno). */
    @Transactional
    public int onBattle(UUID userId, List<String> team, boolean won) {
        if (!won || team == null || team.isEmpty()) return 0;
        Card card = today();
        if (card == null || !team.contains(card.getCode())) return 0;
        int inserted = jdbc.update("INSERT INTO daily_card_claims (user_id, day, card_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                userId, Date.valueOf(LocalDate.now(ZONE)), card.getId());
        if (inserted == 0) return 0;
        walletService.adjustGold(userId, DAILY_REWARD, WalletTransactionType.DAILY_CARD, card.getCode(), "Carta del giorno: " + card.getName());
        return DAILY_REWARD;
    }

    // ------------------------------------------------------------------ storico prezzi

    /** Ogni giorno si salva il valore di mercato di ogni carta (per il grafico). */
    @Scheduled(fixedDelay = 6 * 60 * 60_000L, initialDelay = 90_000)
    public void snapshotPrices() {
        try {
            jdbc.update("INSERT INTO card_price_history (card_id, day, price) "
                    + "SELECT id, ?, (metadata ->> 'marketPrice')::numeric FROM cards "
                    + "WHERE is_active AND metadata ->> 'marketPrice' ~ '^[0-9]+(\\.[0-9]+)?$' AND (metadata ->> 'marketPrice')::numeric > 0 "
                    + "ON CONFLICT (card_id, day) DO UPDATE SET price = EXCLUDED.price", Date.valueOf(LocalDate.now(ZONE)));
        } catch (RuntimeException ex) {
            LOG.warn("Storico prezzi non aggiornato: {}", ex.getMessage());
        }
    }

    /** Valore di mercato (dollari) negli ultimi 180 giorni e vendite fra giocatori (gold). */
    @Transactional(readOnly = true)
    public Map<String, Object> priceHistory(String code) {
        Card card = cardRepository.findByCode(code).orElseThrow(() -> ApiException.notFound("card_not_found"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("market", jdbc.queryForList("SELECT day::text AS day, price::float8 AS price FROM card_price_history "
                + "WHERE card_id = ? AND day > CURRENT_DATE - 180 ORDER BY day", card.getId()));
        // Borsa del mercato: vendite fra giocatori, al mercato e sui banchetti dell'hotel.
        result.put("sales", jdbc.queryForList("SELECT sold_at AS at, price, channel FROM market_sales WHERE card_id = ? "
                + "ORDER BY sold_at DESC LIMIT 30", card.getId()));
        result.put("playerAverage", jdbc.queryForObject("SELECT ROUND(SUM(price * quantity)::numeric / NULLIF(SUM(quantity), 0), 0)::int "
                + "FROM market_sales WHERE card_id = ?", Integer.class, card.getId()));
        result.put("playerSales", jdbc.queryForObject("SELECT COALESCE(SUM(quantity), 0)::int FROM market_sales WHERE card_id = ?",
                Integer.class, card.getId()));
        result.put("current", card.getMarketPrice());
        return result;
    }

    // ------------------------------------------------------------------ fusione

    /** Rarita' successiva, o null per le leggendarie. */
    static String nextRarity(String rarity) {
        int i = RARITY_ORDER.indexOf(rarity);
        return i < 0 || i == RARITY_ORDER.size() - 1 ? null : RARITY_ORDER.get(i + 1);
    }

    /** Doppioni utilizzabili, raggruppati per rarita': di ogni carta resta sempre almeno una copia. */
    @Transactional(readOnly = true)
    public Map<String, Object> fusionCandidates(UUID userId) {
        Map<String, List<Map<String, Object>>> byRarity = new LinkedHashMap<>();
        RARITY_ORDER.forEach(r -> byRarity.put(r, new ArrayList<>()));
        for (UserCard uc : userCardRepository.findByUserIdWithCard(userId)) {
            int spare = uc.getQuantity() - 1;
            String rarity = uc.getCard().getRarity();
            if (spare <= 0 || nextRarity(rarity) == null) continue;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("card", CardDto.from(uc.getCard()));
            entry.put("spare", spare);
            byRarity.get(rarity).add(entry);
        }
        byRarity.remove("legendary");
        return Map.of("groups", byRarity, "size", FUSION_SIZE);
    }

    /** Fonde tre doppioni della stessa rarita' in una carta a caso della rarita' successiva. */
    @Transactional
    public Map<String, Object> fuse(UUID userId, List<String> codes) {
        if (codes == null || codes.size() != FUSION_SIZE) throw ApiException.badRequest("fusion_size");
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        Map<String, Integer> wanted = new HashMap<>();
        codes.forEach(c -> wanted.merge(c, 1, Integer::sum));
        String rarity = null;
        List<Card> used = new ArrayList<>();
        for (Map.Entry<String, Integer> e : wanted.entrySet()) {
            Card card = cardRepository.findByCode(e.getKey()).orElseThrow(() -> ApiException.notFound("card_not_found"));
            if (rarity == null) rarity = card.getRarity();
            if (!rarity.equals(card.getRarity())) throw ApiException.badRequest("fusion_mixed_rarity");
            int quantity = userCardRepository.findByUserIdAndCardId(userId, card.getId()).map(UserCard::getQuantity).orElse(0);
            // Si fondono solo i doppioni: una copia di ogni carta resta sempre.
            if (quantity - e.getValue() < 1) throw ApiException.badRequest("fusion_not_duplicate");
            used.add(card);
        }
        String target = nextRarity(rarity);
        if (target == null) throw ApiException.badRequest("fusion_max_rarity");
        List<Card> pool = cardRepository.findAllActiveWithArtistClass().stream()
                .filter(c -> target.equals(c.getRarity()) && c.getImgUrl() != null && !c.getImgUrl().isBlank())
                .toList();
        if (pool.isEmpty()) throw ApiException.badRequest("fusion_no_cards");
        for (Map.Entry<String, Integer> e : wanted.entrySet()) {
            Card card = used.stream().filter(c -> c.getCode().equals(e.getKey())).findFirst().orElseThrow();
            userCardService.remove(user, card, e.getValue());
        }
        Card result = pool.get(random.nextInt(pool.size()));
        userCardService.add(user, result, 1);
        return Map.of("card", CardDto.from(result), "from", rarity, "to", target);
    }
}
