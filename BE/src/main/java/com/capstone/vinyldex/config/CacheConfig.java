package com.capstone.vinyldex.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cache del catalogo delle carte attive.
 *
 * Con i cataloghi importati per intero le carte sono decine di migliaia: rileggerle tutte dal
 * database a ogni pacchetto aperto, quiz, scambio con gli NPC o pagina dei set costerebbe secondi.
 * Il catalogo si tiene in memoria (CardRepository.findAllActiveWithArtistClass) e si butta quando
 * una carta viene salvata (import, pannello admin). CatalogCacheWarmer lo prepara all'avvio, lo
 * ricarica appena viene buttato e comunque ogni dieci minuti (prezzi e attivazioni cambiati
 * direttamente sul database), senza far aspettare i giocatori: leggerlo tutto costa qualche secondo.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String ACTIVE_CARDS = "activeCards";

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager(ACTIVE_CARDS);
    }
}
