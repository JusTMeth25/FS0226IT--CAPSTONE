package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.repository.RoomItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Vetrine dell'edicola: le carte esposte su piedistalli e cornici cambiano ogni tot ore (di base
 * quattro), pescate fra tutte le carte attive con un'immagine, di ogni gioco.
 *
 * Ogni vetrina ha la sua rarita' (in prima fila le leggendarie, poi epiche, rare e cosi' via),
 * cosi' l'edicola resta una vetrina "di lusso" anche cambiando. La scelta dipende solo dalla
 * finestra di tempo: riavviando il server nella stessa finestra escono le stesse carte, e alla
 * finestra dopo cambiano per tutti insieme. Chi e' in edicola le vede cambiare subito.
 */
@Service
public class NewsstandShowcaseService {

    private static final Logger LOG = LoggerFactory.getLogger(NewsstandShowcaseService.class);

    /** Piedistalli e cornici dell'edicola (V12/V20), con la rarita' della carta che espongono. */
    static final Map<UUID, String> SLOTS = slots();

    private final JdbcTemplate jdbc;
    private final RoomItemRepository itemRepository;
    private final RoomRegistry registry;
    private final long windowMillis;
    private volatile long shownWindow = -1;

    public NewsstandShowcaseService(JdbcTemplate jdbc, RoomItemRepository itemRepository, RoomRegistry registry,
                                    @Value("${vinyldex.newsstand.rotate-hours:4}") int rotateHours) {
        this.jdbc = jdbc;
        this.itemRepository = itemRepository;
        this.registry = registry;
        this.windowMillis = Math.max(1, rotateHours) * 3_600_000L;
    }

    private static Map<UUID, String> slots() {
        Map<UUID, String> slots = new LinkedHashMap<>();
        String[] rarities = {"legendary", "legendary", "legendary", "legendary", "epic", "epic", "rare", "uncommon",
                "uncommon", "common", "common"};
        for (int i = 0; i < rarities.length; i++) {
            slots.put(UUID.fromString(String.format("00000000-0000-0000-0000-c00c%08x", 0x1c + i)), rarities[i]);
        }
        return slots;
    }

    /** Finestra di tempo corrente: cambia ogni rotate-hours ore. */
    long window(long nowMillis) {
        return nowMillis / windowMillis;
    }

    /** All'avvio e poi ogni dieci minuti: se la finestra e' cambiata, nuove carte in vetrina. */
    @Scheduled(initialDelay = 20_000, fixedDelay = 600_000)
    public void rotateIfDue() {
        long window = window(System.currentTimeMillis());
        if (window == shownWindow) return;
        try {
            rotate(window);
            shownWindow = window;
        } catch (RuntimeException ex) {
            LOG.warn("Vetrine dell'edicola non aggiornate: {}", ex.getMessage());
        }
    }

    @Transactional
    public void rotate(long window) {
        Map<String, List<UUID>> pool = new LinkedHashMap<>();
        for (String rarity : new HashSet<>(SLOTS.values())) {
            pool.put(rarity, jdbc.queryForList("SELECT id FROM cards WHERE is_active AND rarity = ? AND img_url IS NOT NULL "
                    + "AND img_url <> '' ORDER BY code", UUID.class, rarity));
        }
        Map<UUID, UUID> chosen = choose(window, pool);
        RoomInstance live = registry.get(NpcRoster.NEWSSTAND);
        chosen.forEach((itemId, cardId) -> {
            if (jdbc.update("UPDATE room_items SET card_id = ? WHERE id = ?", cardId, itemId) == 0) return;
            if (live != null) itemRepository.findWithDetails(itemId).map(RoomItemView::from).ifPresent(live::putItem);
        });
        LOG.info("Edicola: {} carte nuove in vetrina", chosen.size());
    }

    /**
     * Carta per ogni vetrina: a caso fra quelle della sua rarita', senza ripetizioni, con un seme
     * che dipende solo dalla finestra di tempo. Le vetrine senza carte di quella rarita' restano come sono.
     */
    static Map<UUID, UUID> choose(long window, Map<String, List<UUID>> pool) {
        Random random = new Random(window * 7_919L + 17);
        Set<UUID> used = new HashSet<>();
        Map<UUID, UUID> chosen = new LinkedHashMap<>();
        SLOTS.forEach((itemId, rarity) -> {
            List<UUID> candidates = new ArrayList<>(pool.getOrDefault(rarity, List.of()));
            candidates.removeAll(used);
            if (candidates.isEmpty()) return;
            UUID card = candidates.get(random.nextInt(candidates.size()));
            used.add(card);
            chosen.put(itemId, card);
        });
        return chosen;
    }
}
