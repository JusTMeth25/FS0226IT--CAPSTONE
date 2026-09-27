package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Guardaroba di lusso: i capi, gli orologi, i gioielli, le chitarre e i veicoli comprati nei
 * negozi del quartiere. Il codice aspetto li puo' indossare solo se sono nel guardaroba.
 *
 * Qui stanno anche le edizioni limitate (numerate, vinte all'asta), il mercato dell'usato fra
 * giocatori e l'auto da esporre in casa sulla pedana girevole.
 */
@Service
public class WardrobeService {

    /** Commissione del mercato dell'usato: al venditore va il 95%. */
    static final double MARKET_FEE = 0.05;
    /** Copie numerate di ogni pezzo in edizione limitata. */
    public static final int LIMITED_COPIES = 10;

    private final JdbcTemplate jdbc;
    private final WalletService walletService;
    private UserRepository userRepository;
    private FurniService furniService;

    public WardrobeService(JdbcTemplate jdbc, WalletService walletService) {
        this.jdbc = jdbc;
        this.walletService = walletService;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setFurniService(@org.springframework.context.annotation.Lazy FurniService furniService) {
        this.furniService = furniService;
    }

    @Transactional(readOnly = true)
    public Set<String> owned(UUID userId) {
        return new LinkedHashSet<>(jdbc.queryForList(
                "SELECT item FROM user_wardrobe WHERE user_id = ? ORDER BY bought_at", String.class, userId));
    }

    /** Catalogo dei negozi, quello che il giocatore ha gia' e i numeri di serie delle sue edizioni limitate. */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(UUID userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", LuxuryCatalog.ITEMS);
        result.put("owned", owned(userId));
        Map<String, Object> serials = new LinkedHashMap<>();
        jdbc.queryForList("SELECT item, serial FROM user_wardrobe WHERE user_id = ? AND serial IS NOT NULL", userId)
                .forEach(row -> serials.put((String) row.get("item"), row.get("serial")));
        result.put("serials", serials);
        result.put("limitedCopies", LIMITED_COPIES);
        return result;
    }

    @Transactional
    public Map<String, Object> buy(UUID userId, String key) {
        LuxuryCatalog.Item item = LuxuryCatalog.get(key).orElseThrow(() -> ApiException.badRequest("unknown_item"));
        if (owned(userId).contains(item.key())) throw ApiException.badRequest("already_owned");
        walletService.adjustGold(userId, -item.price(), WalletTransactionType.LUXURY, "luxury:" + item.key(),
                item.brand() + " " + item.name());
        jdbc.update("INSERT INTO user_wardrobe (user_id, item) VALUES (?, ?) ON CONFLICT DO NOTHING", userId, item.key());
        return summary(userId);
    }

    /** Il codice aspetto indossa solo pezzi comprati? Altrimenti errore. */
    public void requireOwned(UUID userId, String look) {
        List<String> worn = HotelLook.luxuryItems(look);
        if (worn.isEmpty()) return;
        Set<String> mine = owned(userId);
        for (String item : worn) {
            if (!mine.contains(item)) throw ApiException.badRequest("item_not_owned");
        }
    }

    // ------------------------------------------------------------------ edizioni limitate

    /** Prossimo numero di serie libero per il pezzo, o null se le dieci copie sono gia' uscite. */
    @Transactional(readOnly = true)
    public Integer nextSerial(String item) {
        Integer used = jdbc.queryForObject("SELECT count(*) FROM user_wardrobe WHERE item = ? AND serial IS NOT NULL", Integer.class, item);
        Integer listed = jdbc.queryForObject("SELECT count(*) FROM luxury_listings WHERE item = ? AND serial IS NOT NULL", Integer.class, item);
        Integer auctioned = jdbc.queryForObject("SELECT count(*) FROM hotel_auctions WHERE luxury_item = ? AND status = 'OPEN'", Integer.class, item);
        int taken = (used == null ? 0 : used) + (listed == null ? 0 : listed) + (auctioned == null ? 0 : auctioned);
        return taken >= LIMITED_COPIES ? null : taken + 1;
    }

    /** Pezzo vinto all'asta: entra nel guardaroba con il suo numero (se lo aveva gia', diventa l'edizione limitata). */
    @Transactional
    public void grantLimited(UUID userId, String item, Integer serial) {
        jdbc.update("INSERT INTO user_wardrobe (user_id, item, serial) VALUES (?, ?, ?) "
                + "ON CONFLICT (user_id, item) DO UPDATE SET serial = COALESCE(EXCLUDED.serial, user_wardrobe.serial)", userId, item, serial);
    }

    // ------------------------------------------------------------------ mercato dell'usato

    @Transactional(readOnly = true)
    public Map<String, Object> market(UUID userId, String shop) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT l.id, l.item, l.serial, l.price, l.created_at AS \"createdAt\", l.seller_id AS \"sellerId\", u.username AS seller "
                        + "FROM luxury_listings l JOIN users u ON u.id = l.seller_id ORDER BY l.created_at DESC LIMIT 200");
        List<Map<String, Object>> listings = rows.stream()
                .filter(row -> shop == null || LuxuryCatalog.get((String) row.get("item")).map(i -> i.shop().equals(shop)).orElse(false))
                .peek(row -> row.put("mine", userId.equals(row.get("sellerId"))))
                .toList();
        return Map.of("listings", listings);
    }

    /** Messa in vendita: il pezzo esce dal guardaroba (non si puo' indossare mentre e' in vendita). */
    @Transactional
    public Map<String, Object> sell(UUID userId, String key, int price) {
        LuxuryCatalog.Item item = LuxuryCatalog.get(key).orElseThrow(() -> ApiException.badRequest("unknown_item"));
        if (price < Math.max(10, item.price() / 10) || price > item.price() * 5) throw ApiException.badRequest("invalid_price");
        Map<String, Object> row = jdbc.queryForList("SELECT serial FROM user_wardrobe WHERE user_id = ? AND item = ? FOR UPDATE", userId, key)
                .stream().findFirst().orElseThrow(() -> ApiException.badRequest("item_not_owned"));
        if (userRepository != null) {
            String look = userRepository.findById(userId).map(u -> HotelLook.orDefault(u.getHotelLook())).orElse(HotelLook.DEFAULT);
            if (HotelLook.luxuryItems(look).contains(key)) throw ApiException.badRequest("item_worn");
        }
        jdbc.update("DELETE FROM user_wardrobe WHERE user_id = ? AND item = ?", userId, key);
        jdbc.update("INSERT INTO luxury_listings (seller_id, item, serial, price) VALUES (?, ?, ?, ?)", userId, key, row.get("serial"), price);
        return market(userId, item.shop());
    }

    /** Ritiro dalla vendita: il pezzo torna nel guardaroba. */
    @Transactional
    public Map<String, Object> withdraw(UUID userId, UUID listingId) {
        Map<String, Object> listing = listing(listingId);
        if (!userId.equals(listing.get("seller_id"))) throw ApiException.forbidden("not_your_listing");
        jdbc.update("DELETE FROM luxury_listings WHERE id = ?", listingId);
        grantLimited(userId, (String) listing.get("item"), toInt(listing.get("serial")));
        return market(userId, LuxuryCatalog.get((String) listing.get("item")).map(LuxuryCatalog.Item::shop).orElse(null));
    }

    /** Acquisto dall'usato: il compratore paga, al venditore va il 95%, il pezzo cambia guardaroba. */
    @Transactional
    public Map<String, Object> buyListing(UUID userId, UUID listingId) {
        Map<String, Object> listing = listing(listingId);
        UUID seller = (UUID) listing.get("seller_id");
        String key = (String) listing.get("item");
        if (userId.equals(seller)) throw ApiException.badRequest("own_listing");
        if (owned(userId).contains(key)) throw ApiException.badRequest("already_owned");
        int price = (Integer) listing.get("price");
        String name = LuxuryCatalog.get(key).map(i -> i.brand() + " " + i.name()).orElse(key);
        walletService.adjustGold(userId, -price, WalletTransactionType.LUXURY, "market:" + listingId, "Usato: " + name);
        walletService.adjustGold(seller, (int) Math.round(price * (1 - MARKET_FEE)), WalletTransactionType.LUXURY, "market:" + listingId,
                "Venduto all'usato: " + name);
        jdbc.update("DELETE FROM luxury_listings WHERE id = ?", listingId);
        grantLimited(userId, key, toInt(listing.get("serial")));
        return summary(userId);
    }

    private Map<String, Object> listing(UUID listingId) {
        return jdbc.queryForList("SELECT * FROM luxury_listings WHERE id = ? FOR UPDATE", listingId).stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("listing_not_found"));
    }

    private static Integer toInt(Object value) {
        return value == null ? null : ((Number) value).intValue();
    }

    // ------------------------------------------------------------------ garage

    /** Auto comprata da esporre in casa: una pedana girevole con quell'auto nella borsa dei mobili. */
    @Transactional
    public RoomItemView showcase(UUID userId, String key) {
        if (!key.matches("r[5-9]")) throw ApiException.badRequest("not_a_car");
        if (!owned(userId).contains(key)) throw ApiException.badRequest("item_not_owned");
        String type = "showcar_" + key.substring(1);
        Integer have = jdbc.queryForObject("SELECT count(*) FROM room_items WHERE owner_id = ? AND furni_type = ?", Integer.class, userId, type);
        if (have != null && have > 0) throw ApiException.badRequest("already_showcased");
        if (furniService == null) throw ApiException.badRequest("unavailable");
        return furniService.grant(userId, type);
    }
}
