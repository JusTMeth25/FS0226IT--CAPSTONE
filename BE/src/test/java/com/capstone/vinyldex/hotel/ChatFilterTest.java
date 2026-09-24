package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatFilterTest {

    /** Orologio che avanza solo quando lo dice il test. */
    private static final class ManualClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T12:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    @DisplayName("Testo ripulito da a capo e spazi, e tagliato a 100 caratteri")
    void cleansAndTruncates() {
        ChatFilter filter = new ChatFilter();

        assertEquals("ciao a tutti", filter.check("  ciao\n\na   tutti\t").text());
        assertEquals(ChatFilter.MAX_LENGTH, filter.check("x".repeat(500)).text().length());
        assertEquals(ChatFilter.Verdict.EMPTY, filter.check("   \n ").verdict());
    }

    @Test
    @DisplayName("Oltre 5 messaggi in 5 secondi si resta muti per 30 secondi")
    void floodMutes() {
        ManualClock clock = new ManualClock();
        ChatFilter filter = new ChatFilter(clock);

        for (int i = 0; i < 5; i++) assertEquals(ChatFilter.Verdict.OK, filter.check("msg " + i).verdict());
        assertEquals(ChatFilter.Verdict.FLOOD, filter.check("troppo").verdict());

        clock.advance(Duration.ofSeconds(20));
        assertEquals(ChatFilter.Verdict.MUTED, filter.check("ancora").verdict());

        clock.advance(Duration.ofSeconds(11));
        assertEquals(ChatFilter.Verdict.OK, filter.check("di nuovo qui").verdict());
    }

    @Test
    @DisplayName("Messaggi distanziati non fanno mai scattare il limite")
    void slowChatIsFine() {
        ManualClock clock = new ManualClock();
        ChatFilter filter = new ChatFilter(clock);

        for (int i = 0; i < 20; i++) {
            assertEquals(ChatFilter.Verdict.OK, filter.check("msg " + i).verdict());
            clock.advance(Duration.ofMillis(1_100));
        }
    }
}
