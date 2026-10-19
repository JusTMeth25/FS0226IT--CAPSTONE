package com.capstone.vinyldex.security;

import com.capstone.vinyldex.exception.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Freno contro chi prova password a raffica (brute force). Tre contatori, tutti in memoria come
 * quelli di RateLimitFilter (istanza unica):
 *
 * - per IP: al massimo {@value #IP_LIMIT} richieste di accesso al minuto (login, registrazione,
 *   recupero password, secondo passaggio);
 * - per IP + email: dopo {@value #PAIR_FAILURES} password sbagliate in 15 minuti quella coppia
 *   resta ferma 15 minuti;
 * - per email, da qualsiasi IP: dopo {@value #EMAIL_FAILURES} errori in 15 minuti l'email resta
 *   ferma 15 minuti. Ferma chi distribuisce i tentativi su tanti IP; chi volesse bloccare un
 *   account altrui ci riesce solo per poco.
 *
 * I contatori usano l'email scritta, non l'account: un'email inesistente si blocca come una vera,
 * quindi il blocco non dice se l'email e' registrata.
 *
 * vinyldex.login-throttle.enabled=false lo spegne (solo per le prove automatiche in locale).
 */
@Component
public class LoginThrottle {

    static final int IP_LIMIT = 10;
    static final Duration IP_WINDOW = Duration.ofMinutes(1);
    static final int PAIR_FAILURES = 5;
    static final int EMAIL_FAILURES = 20;
    static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    static final Duration LOCK = Duration.ofMinutes(15);

    private final Map<String, Counter> byIp = new ConcurrentHashMap<>();
    private final Map<String, Counter> failures = new ConcurrentHashMap<>();
    private final Clock clock;
    private final boolean enabled;

    @Autowired
    public LoginThrottle(@Value("${vinyldex.login-throttle.enabled:true}") boolean enabled) {
        this(Clock.systemUTC(), enabled);
    }

    LoginThrottle(Clock clock, boolean enabled) {
        this.clock = clock;
        this.enabled = enabled;
    }

    /** Una richiesta di accesso da questo IP: oltre il limite al minuto, 429. */
    public void checkIp(String ip) {
        if (!enabled) return;
        Instant now = clock.instant();
        Counter counter = byIp.compute(key("ip", ip), (k, c) -> c == null || c.expired(now, IP_WINDOW) ? new Counter(now) : c);
        synchronized (counter) {
            counter.count++;
            if (counter.count > IP_LIMIT) throw tooMany();
        }
    }

    /** Prima di controllare la password: coppia IP + email o email ferme, 429. */
    public void checkLogin(String ip, String email) {
        if (!enabled) return;
        Instant now = clock.instant();
        if (locked(key("pair", ip + "|" + normalize(email)), now) || locked(key("email", normalize(email)), now)) {
            throw tooMany();
        }
    }

    /** Password sbagliata: conta per la coppia e per l'email. */
    public void failure(String ip, String email) {
        if (!enabled) return;
        Instant now = clock.instant();
        count(key("pair", ip + "|" + normalize(email)), PAIR_FAILURES, now);
        count(key("email", normalize(email)), EMAIL_FAILURES, now);
    }

    /** Accesso riuscito: si azzera la coppia (l'email no, per non premiare chi attacca da tanti IP). */
    public void success(String ip, String email) {
        failures.remove(key("pair", ip + "|" + normalize(email)));
    }

    private void count(String key, int limit, Instant now) {
        Counter counter = failures.compute(key, (k, c) -> c == null || (c.expired(now, FAILURE_WINDOW) && !c.lockedAt(now)) ? new Counter(now) : c);
        synchronized (counter) {
            counter.count++;
            if (counter.count >= limit && counter.lockedUntil == null) counter.lockedUntil = now.plus(LOCK);
        }
    }

    private boolean locked(String key, Instant now) {
        Counter counter = failures.get(key);
        return counter != null && counter.lockedAt(now);
    }

    /** Pulizia: senza, ogni IP ed email visti una volta resterebbero in memoria per sempre. */
    @Scheduled(fixedDelay = 600_000, initialDelay = 600_000)
    void cleanup() {
        Instant now = clock.instant();
        byIp.values().removeIf(c -> c.expired(now, IP_WINDOW));
        failures.values().removeIf(c -> c.expired(now, FAILURE_WINDOW) && !c.lockedAt(now));
    }

    private static String key(String kind, String value) {
        return kind + ":" + (value == null ? "" : value);
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException tooMany() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "too_many_attempts");
    }

    private static final class Counter {
        private final Instant startedAt;
        private int count;
        private Instant lockedUntil;

        private Counter(Instant startedAt) {
            this.startedAt = startedAt;
        }

        private boolean expired(Instant now, Duration window) {
            return !now.isBefore(startedAt.plus(window));
        }

        private boolean lockedAt(Instant now) {
            return lockedUntil != null && now.isBefore(lockedUntil);
        }
    }
}
