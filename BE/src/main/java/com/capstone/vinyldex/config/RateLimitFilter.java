package com.capstone.vinyldex.config;

import com.capstone.vinyldex.security.ClientIp;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limit per indirizzo IP: un numero massimo di richieste ogni 60 secondi con finestra
 * fissa; oltre il limite la risposta e' 429.
 *
 * Le immagini delle carte (il proxy /cards/{id}/image e le carte disegnate dal server) hanno un
 * contatore a parte e molto piu' largo: il raccoglitore 3D ne chiede centinaia mentre si sfoglia,
 * e se contassero come le altre richieste esaurirebbero il limite e bloccherebbero tutto il resto
 * (pagina della carta, hotel, collezione) fino alla finestra successiva.
 *
 * Il contatore vive in memoria, quindi vale per singola istanza. Va bene per un deploy
 * a istanza unica come questo; con piu' repliche servirebbe un contatore condiviso (Redis).
 */
@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final int maxRequests;
    private final int maxImageRequests;
    private final long windowMillis;

    public RateLimitFilter(ObjectMapper objectMapper,
                           @Value("${vinyldex.rate-limit.enabled:true}") boolean enabled,
                           @Value("${vinyldex.rate-limit.requests:600}") int maxRequests,
                           @Value("${vinyldex.rate-limit.image-requests:3000}") int maxImageRequests,
                           @Value("${vinyldex.rate-limit.window-seconds:60}") long windowSeconds) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.maxRequests = maxRequests;
        this.maxImageRequests = maxImageRequests;
        this.windowMillis = windowSeconds * 1000L;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean image = isCardImage(request);
        int limit = image ? maxImageRequests : maxRequests;
        String clientKey = ClientIp.of(request) + (image ? "|img" : "");
        long now = System.currentTimeMillis();

        Window window = windows.compute(clientKey, (key, existing) -> {
            if (existing == null || now - existing.startedAt >= windowMillis) {
                return new Window(now);
            }
            return existing;
        });

        int used = window.counter.incrementAndGet();
        long resetSeconds = Math.max(0, (window.startedAt + windowMillis - now) / 1000);

        response.setHeader("RateLimit-Limit", String.valueOf(limit));
        response.setHeader("RateLimit-Remaining", String.valueOf(Math.max(0, limit - used)));
        response.setHeader("RateLimit-Reset", String.valueOf(resetSeconds));

        if (used > limit) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), Map.of("error", "too_many_requests"));
            return;
        }

        filterChain.doFilter(request, response);
    }

    /** Immagine di una carta: GET /api/cards/{id}/image, /fc-card.svg o /nba-card.svg. */
    static boolean isCardImage(HttpServletRequest request) {
        if (!"GET".equals(request.getMethod())) return false;
        String path = request.getRequestURI();
        return path.startsWith("/api/cards/")
                && (path.endsWith("/image") || path.endsWith("/fc-card.svg") || path.endsWith("/nba-card.svg"));
    }

    /**
     * Pulizia periodica: senza questa, ogni IP visto una volta resterebbe in memoria per sempre.
     * Gira dentro il filtro invece che su uno scheduler perche' la mappa e' piccola e il costo
     * si paga solo quando serve.
     */
    @Override
    protected void initFilterBean() {
        Thread cleaner = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(windowMillis * 5);
                    long cutoff = System.currentTimeMillis() - windowMillis * 2;
                    windows.entrySet().removeIf(entry -> entry.getValue().startedAt < cutoff);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "rate-limit-cleaner");
        cleaner.setDaemon(true);
        cleaner.start();
    }

    private static final class Window {
        private final long startedAt;
        private final AtomicInteger counter = new AtomicInteger();

        private Window(long startedAt) {
            this.startedAt = startedAt;
        }
    }
}
