package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.config.CacheConfig;
import com.capstone.vinyldex.service.HoloCardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ogni carta ha un prezzo di mercato: quelle che non ne hanno uno (le carte VinylDex, le carte che
 * le fonti non quotano) ricevono una stima, segnata come tale (priceSource = "stima").
 *
 * - Carte importate: il prezzo mediano delle carte dello stesso gioco e della stessa rarita'.
 * - Carte VinylDex, e quelle di giochi senza nessuna carta quotata in quella rarita': la tabella
 *   ORIGINAL_PRICES per rarita'.
 * - Olografiche: PRICE_MULTIPLIER volte la carta base (si aggiornano quando cambia la base).
 *
 * Gira all'avvio e dopo ogni import (ImportService), e tocca solo le carte senza prezzo: un
 * prezzo vero arrivato dalla fonte non viene mai sovrascritto.
 */
@Component
public class CardPriceBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CardPriceBackfill.class);

    /** Prezzo in dollari delle carte VinylDex per rarita'. */
    static final String ORIGINAL_PRICES = """
            CASE rarity WHEN 'legendary' THEN 250 WHEN 'epic' THEN 45 WHEN 'rare' THEN 10
                        WHEN 'uncommon' THEN 2 ELSE 0.5 END""";

    private final JdbcTemplate jdbc;
    private final CacheManager cacheManager;

    public CardPriceBackfill(JdbcTemplate jdbc, CacheManager cacheManager) {
        this.jdbc = jdbc;
        this.cacheManager = cacheManager;
    }

    @Override
    public void run(ApplicationArguments args) {
        fillMissing();
    }

    /** Stima i prezzi mancanti; restituisce quante carte ha toccato. */
    @Transactional
    public int fillMissing() {
        int byMedian = jdbc.update("""
                WITH med AS (
                    SELECT source, rarity,
                           percentile_cont(0.5) WITHIN GROUP (ORDER BY (metadata ->> 'marketPrice')::numeric) AS price
                    FROM cards
                    WHERE NOT holo AND source <> 'original' AND (metadata ->> 'marketPrice') IS NOT NULL
                    GROUP BY source, rarity
                )
                UPDATE cards c
                SET metadata = COALESCE(c.metadata, '{}'::jsonb)
                        || jsonb_build_object('marketPrice', round(med.price::numeric, 2), 'priceSource', 'stima')
                FROM med
                WHERE c.source = med.source AND c.rarity = med.rarity AND NOT c.holo
                  AND (c.metadata IS NULL OR (c.metadata ->> 'marketPrice') IS NULL)
                """);
        int byRarity = jdbc.update("""
                UPDATE cards
                SET metadata = COALESCE(metadata, '{}'::jsonb)
                        || jsonb_build_object('marketPrice', %s, 'priceSource', 'stima')
                WHERE NOT holo AND (metadata IS NULL OR (metadata ->> 'marketPrice') IS NULL)
                """.formatted(ORIGINAL_PRICES));
        int holo = jdbc.update("""
                UPDATE cards h
                SET metadata = COALESCE(h.metadata, '{}'::jsonb)
                        || jsonb_build_object('marketPrice', round(((b.metadata ->> 'marketPrice')::numeric) * %s, 2))
                FROM cards b
                WHERE h.holo AND b.code = h.metadata ->> 'baseCode' AND (b.metadata ->> 'marketPrice') IS NOT NULL
                  AND (h.metadata ->> 'marketPrice')::numeric IS DISTINCT FROM
                      round(((b.metadata ->> 'marketPrice')::numeric) * %s, 2)
                """.formatted(HoloCardService.PRICE_MULTIPLIER, HoloCardService.PRICE_MULTIPLIER));
        int total = byMedian + byRarity + holo;
        if (total > 0) {
            // Il catalogo in cache ha ancora i prezzi vecchi: si rilegge.
            Cache cache = cacheManager.getCache(CacheConfig.ACTIVE_CARDS);
            if (cache != null) cache.clear();
            log.info("Prezzi stimati: {} dal mediano del gioco, {} dalla rarita', {} olografiche aggiornate", byMedian, byRarity, holo);
        }
        return total;
    }
}
