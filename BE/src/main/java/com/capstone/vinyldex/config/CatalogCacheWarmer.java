package com.capstone.vinyldex.config;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.repository.CardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.interceptor.SimpleKey;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tiene pronto il catalogo delle carte attive nella cache (CacheConfig): lo legge all'avvio, lo
 * rilegge entro un minuto quando un salvataggio lo butta, e lo rinfresca ogni dieci minuti. La
 * versione vecchia resta in uso finche' la nuova non e' pronta, cosi' nessuna richiesta aspetta.
 */
@Component
public class CatalogCacheWarmer {

    private static final Logger LOG = LoggerFactory.getLogger(CatalogCacheWarmer.class);
    private static final long REFRESH_MILLIS = 600_000;

    private final CardRepository cardRepository;
    private final CacheManager cacheManager;
    private volatile long loadedAt;

    public CatalogCacheWarmer(CardRepository cardRepository, CacheManager cacheManager) {
        this.cardRepository = cardRepository;
        this.cacheManager = cacheManager;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmOnStartup() {
        refresh();
    }

    /** Ogni minuto: ricarica se la cache e' vuota (una carta salvata) o se e' vecchia. */
    @Scheduled(initialDelay = 60_000, fixedDelay = 60_000)
    public void keepWarm() {
        Cache cache = cacheManager.getCache(CacheConfig.ACTIVE_CARDS);
        boolean empty = cache == null || cache.get(SimpleKey.EMPTY) == null;
        if (empty || System.currentTimeMillis() - loadedAt > REFRESH_MILLIS) refresh();
    }

    public void refresh() {
        try {
            long start = System.currentTimeMillis();
            List<Card> cards = cardRepository.loadAllActiveWithArtistClass();
            Cache cache = cacheManager.getCache(CacheConfig.ACTIVE_CARDS);
            if (cache != null) cache.put(SimpleKey.EMPTY, cards);
            loadedAt = System.currentTimeMillis();
            LOG.info("Catalogo in cache: {} carte attive in {} ms", cards.size(), loadedAt - start);
        } catch (RuntimeException ex) {
            LOG.warn("Catalogo non caricato in cache: {}", ex.getMessage());
        }
    }
}
