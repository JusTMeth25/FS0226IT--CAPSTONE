package com.capstone.vinyldex.security;

import com.capstone.vinyldex.exception.ApiException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class LoginThrottleTest {

    /** Orologio che si sposta a mano. */
    private static final class MovingClock extends Clock {
        private Instant now = Instant.parse("2026-10-19T10:00:00Z");

        void advance(Duration d) { now = now.plus(d); }
        @Override public Instant instant() { return now; }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private final MovingClock clock = new MovingClock();
    private final LoginThrottle throttle = new LoginThrottle(clock, true);

    private static void assertBlocked(Runnable call) {
        ApiException ex = assertThrows(ApiException.class, call::run);
        assertEquals("too_many_attempts", ex.getCode());
    }

    @Test
    @DisplayName("Per IP: dieci accessi al minuto, l'undicesimo no; il minuto dopo si riparte")
    void perIpLimit() {
        for (int i = 0; i < LoginThrottle.IP_LIMIT; i++) throttle.checkIp("1.1.1.1");
        assertBlocked(() -> throttle.checkIp("1.1.1.1"));
        throttle.checkIp("2.2.2.2");
        clock.advance(Duration.ofMinutes(1));
        throttle.checkIp("1.1.1.1");
    }

    @Test
    @DisplayName("Cinque password sbagliate dallo stesso IP sulla stessa email: ferma 15 minuti")
    void pairLock() {
        for (int i = 0; i < LoginThrottle.PAIR_FAILURES; i++) {
            throttle.checkLogin("1.1.1.1", "a@b.it");
            throttle.failure("1.1.1.1", "a@b.it");
        }
        assertBlocked(() -> throttle.checkLogin("1.1.1.1", "A@B.it "));
        // Un altro IP sulla stessa email non e' ancora fermo (servono 20 errori).
        throttle.checkLogin("9.9.9.9", "a@b.it");
        clock.advance(LoginThrottle.LOCK);
        throttle.checkLogin("1.1.1.1", "a@b.it");
    }

    @Test
    @DisplayName("Venti errori sulla stessa email da IP diversi: l'email resta ferma da qualsiasi IP")
    void emailLock() {
        for (int i = 0; i < LoginThrottle.EMAIL_FAILURES; i++) throttle.failure("10.0.0." + i, "vittima@b.it");
        assertBlocked(() -> throttle.checkLogin("8.8.8.8", "vittima@b.it"));
        throttle.checkLogin("8.8.8.8", "altra@b.it");
    }

    @Test
    @DisplayName("L'accesso riuscito azzera gli errori della coppia IP + email")
    void successResets() {
        for (int i = 0; i < LoginThrottle.PAIR_FAILURES - 1; i++) throttle.failure("1.1.1.1", "a@b.it");
        throttle.success("1.1.1.1", "a@b.it");
        throttle.failure("1.1.1.1", "a@b.it");
        throttle.checkLogin("1.1.1.1", "a@b.it");
    }

    @Test
    @DisplayName("Spento da configurazione non blocca niente")
    void disabled() {
        LoginThrottle off = new LoginThrottle(clock, false);
        for (int i = 0; i < 50; i++) {
            off.checkIp("1.1.1.1");
            off.failure("1.1.1.1", "a@b.it");
        }
        off.checkLogin("1.1.1.1", "a@b.it");
    }
}
