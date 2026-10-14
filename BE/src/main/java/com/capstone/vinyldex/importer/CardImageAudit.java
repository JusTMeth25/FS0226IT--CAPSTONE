package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.config.CacheConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

/**
 * Immagini rotte delle carte importate.
 *
 * Alcune fonti pubblicano carte la cui immagine non esiste (TCGplayer risponde 403 a parecchie
 * promo di Dragon Ball). Una carta cosi' nei pacchetti, nel mercato e nei set sarebbe un riquadro
 * vuoto, quindi si disattiva. L'esito si salva per URL in card_image_checks:
 *
 * - un controllo periodico passa a poco a poco tutte le immagini attive (BATCH ogni 10 minuti) e
 *   ricontrolla quelle rotte dopo una settimana, riattivando le carte se l'immagine e' tornata;
 * - il proxy delle immagini (CardImageController) segnala subito un 403/404 visto da un giocatore;
 * - l'import (CardImportWriter) non riattiva le carte con un'immagine nota come rotta.
 *
 * Solo 403, 404, 410 o una risposta che non e' un'immagine contano come "rotta": timeout ed errori
 * del server (5xx, 429) non cambiano niente, si riprova al giro dopo.
 */
@Component
public class CardImageAudit {

    private static final Logger log = LoggerFactory.getLogger(CardImageAudit.class);

    /** Esito di un controllo: OK, BROKEN oppure UNKNOWN (rete o server in difficolta': non si decide). */
    public enum Result { OK, BROKEN, UNKNOWN }

    private final JdbcTemplate jdbc;
    private final CacheManager cacheManager;
    private final boolean enabled;
    private final int batch;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public CardImageAudit(JdbcTemplate jdbc, CacheManager cacheManager,
                          @Value("${vinyldex.images.audit.enabled:true}") boolean enabled,
                          @Value("${vinyldex.images.audit.batch:600}") int batch) {
        this.jdbc = jdbc;
        this.cacheManager = cacheManager;
        this.enabled = enabled;
        this.batch = batch;
    }

    /** Classifica una risposta HTTP: lo usano il controllo periodico e il proxy delle immagini. */
    public static Result classify(int status, String contentType) {
        if (status == 403 || status == 404 || status == 410) return Result.BROKEN;
        if (status == 200 || status == 206) {
            return contentType != null && contentType.startsWith("image/") ? Result.OK : Result.BROKEN;
        }
        return Result.UNKNOWN;
    }

    /** Scarica solo il primo KB dell'immagine per vedere se esiste. */
    Result probe(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .header("User-Agent", "VinylDex/1.0 (capstone project)")
                    .header("Accept", "image/*")
                    .header("Range", "bytes=0-1023")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                body.readNBytes(1024);
            }
            return classify(response.statusCode(), response.headers().firstValue("Content-Type").orElse(null));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.UNKNOWN;
        } catch (Exception e) {
            return Result.UNKNOWN;
        }
    }

    /** URL delle immagini note come rotte (per l'import). */
    public Set<String> brokenUrls() {
        return new HashSet<>(jdbc.queryForList("SELECT img_url FROM card_image_checks WHERE broken", String.class));
    }

    /** Immagine rotta: si salva l'esito e si disattivano le carte che la usano. Restituisce quante. */
    public int markBroken(String url, Integer status) {
        int off = saveBroken(url, status);
        if (off > 0) clearCatalog();
        return off;
    }

    private int saveBroken(String url, Integer status) {
        jdbc.update("""
                INSERT INTO card_image_checks (img_url, broken, status, checked_at) VALUES (?, true, ?, now())
                ON CONFLICT (img_url) DO UPDATE SET broken = true, status = EXCLUDED.status, checked_at = now()
                """, url, status);
        return jdbc.update("UPDATE cards SET is_active = false WHERE img_url = ? AND is_active", url);
    }

    /** Immagine buona: se era segnata come rotta le sue carte tornano attive. Restituisce quante. */
    public int markOk(String url) {
        int on = saveOk(url);
        if (on > 0) clearCatalog();
        return on;
    }

    private int saveOk(String url) {
        Boolean wasBroken = jdbc.query("SELECT broken FROM card_image_checks WHERE img_url = ?",
                rs -> rs.next() ? rs.getBoolean(1) : null, url);
        jdbc.update("""
                INSERT INTO card_image_checks (img_url, broken, status, checked_at) VALUES (?, false, 200, now())
                ON CONFLICT (img_url) DO UPDATE SET broken = false, status = 200, checked_at = now()
                """, url);
        if (!Boolean.TRUE.equals(wasBroken)) return 0;
        return jdbc.update("UPDATE cards SET is_active = true WHERE img_url = ? AND NOT is_active", url);
    }

    /** Ogni 10 minuti: un po' di immagini mai controllate (o vecchie di un mese) e le rotte da riprovare. */
    @Scheduled(initialDelay = 300_000, fixedDelay = 600_000)
    public void scheduled() {
        if (!enabled) return;
        List<String> urls = jdbc.queryForList("""
                SELECT u FROM (
                    SELECT DISTINCT c.img_url AS u FROM cards c
                    LEFT JOIN card_image_checks k ON k.img_url = c.img_url
                    WHERE c.is_active AND c.img_url LIKE 'http%'
                      AND (k.img_url IS NULL OR k.checked_at < now() - interval '30 days')
                    LIMIT ?
                ) todo
                UNION
                SELECT img_url FROM (
                    SELECT img_url FROM card_image_checks
                    WHERE broken AND checked_at < now() - interval '7 days' ORDER BY checked_at LIMIT 100
                ) retry
                """, String.class, batch);
        if (urls.isEmpty()) return;
        int[] counts = new int[3];
        int[] changed = new int[2];
        Semaphore parallel = new Semaphore(8);
        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
            for (String url : urls) {
                pool.submit(() -> {
                    parallel.acquireUninterruptibly();
                    try {
                        Result result = probe(url);
                        synchronized (counts) {
                            counts[result.ordinal()]++;
                        }
                        if (result == Result.BROKEN) {
                            int off = saveBroken(url, null);
                            synchronized (changed) { changed[0] += off; }
                        } else if (result == Result.OK) {
                            int on = saveOk(url);
                            synchronized (changed) { changed[1] += on; }
                        }
                    } finally {
                        parallel.release();
                    }
                });
            }
        }
        // Il catalogo in memoria si rilegge una volta sola, alla fine del giro.
        if (changed[0] + changed[1] > 0) clearCatalog();
        log.info("Immagini delle carte: {} ok, {} rotte, {} da riprovare; carte disattivate {}, riattivate {}",
                counts[0], counts[1], counts[2], changed[0], changed[1]);
    }

    private void clearCatalog() {
        Cache cache = cacheManager.getCache(CacheConfig.ACTIVE_CARDS);
        if (cache != null) cache.clear();
    }
}
