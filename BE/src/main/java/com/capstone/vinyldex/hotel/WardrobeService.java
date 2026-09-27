package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
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
 * Guardaroba di lusso: i capi, gli orologi e i veicoli comprati nei negozi del quartiere.
 * Il codice aspetto li puo' indossare solo se sono nel guardaroba del giocatore.
 */
@Service
public class WardrobeService {

    private final JdbcTemplate jdbc;
    private final WalletService walletService;

    public WardrobeService(JdbcTemplate jdbc, WalletService walletService) {
        this.jdbc = jdbc;
        this.walletService = walletService;
    }

    @Transactional(readOnly = true)
    public Set<String> owned(UUID userId) {
        return new LinkedHashSet<>(jdbc.queryForList(
                "SELECT item FROM user_wardrobe WHERE user_id = ? ORDER BY bought_at", String.class, userId));
    }

    /** Catalogo dei negozi e quello che il giocatore ha gia'. */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(UUID userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", LuxuryCatalog.ITEMS);
        result.put("owned", owned(userId));
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
}
