package com.capstone.vinyldex.config;

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
 * Rate limit per indirizzo IP, equivalente a express-rate-limit nel backend Node:
 * 200 richieste ogni 60 secondi con finestra fissa.
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
    private final long windowMillis;

    public RateLimitFilter(ObjectMapper objectMapper,
                           @Value("${vinyldex.rate-limit.enabled:true}") boolean enabled,
                           @Value("${vinyldex.rate-limit.requests:200}") int maxRequests,
                           @Value("${vinyldex.rate-limit.window-seconds:60}") long windowSeconds) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.maxRequests = maxRequests;
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

        String clientKey = resolveClientKey(request);
        long now = System.currentTimeMillis();

        Window window = windows.compute(clientKey, (key, existing) -> {
            if (existing == null || now - existing.startedAt >= windowMillis) {
                return new Window(now);
            }
            return existing;
        });

        int used = window.counter.incrementAndGet();
        long resetSeconds = Math.max(0, (window.startedAt + windowMillis - now) / 1000);

        response.setHeader("RateLimit-Limit", String.valueOf(maxRequests));
        response.setHeader("RateLimit-Remaining", String.valueOf(Math.max(0, maxRequests - used)));
        response.setHeader("RateLimit-Reset", String.valueOf(resetSeconds));

        if (used > maxRequests) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), Map.of("error", "too_many_requests"));
            return;
        }

        filterChain.doFilter(request, response);
    }

    /** X-Forwarded-For e' il primo IP della catena quando l'app sta dietro a un proxy. */
    private String resolveClientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
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
