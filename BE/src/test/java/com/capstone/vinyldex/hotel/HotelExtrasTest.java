package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Calendario degli eventi, regole dell'asta, settimana della mostra, carte della pesca. */
class HotelExtrasTest {

    private static Instant rome(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute).atZone(HotelEventService.ZONE).toInstant();
    }

    private static List<String> activeKeys(Instant at) {
        return HotelEventService.active(at).stream().map(e -> e.def().key()).toList();
    }

    @Test
    @DisplayName("Eventi: il torneo alle 21 ogni giorno, il bowling solo il sabato alle 18")
    void calendar() {
        // 26 settembre 2026 e' un sabato.
        assertEquals(List.of("torneo-calcio"), activeKeys(rome(2026, 9, 26, 21, 10)));
        assertTrue(activeKeys(rome(2026, 9, 26, 18, 30)).contains("bowling-sabato"));
        assertFalse(activeKeys(rome(2026, 9, 25, 18, 30)).contains("bowling-sabato"), "venerdi' niente bowling");
        assertTrue(activeKeys(rome(2026, 9, 26, 21, 30)).isEmpty(), "alle 21:30 il torneo e' finito");

        List<HotelEventService.Edition> next = HotelEventService.upcoming(rome(2026, 9, 26, 19, 30), 3);
        assertEquals("torneo-calcio", next.get(0).def().key());
        assertTrue(next.get(0).startsAt().isBefore(next.get(1).startsAt()));

        List<String> ended = HotelEventService.recentlyEnded(rome(2026, 9, 26, 21, 31)).stream().map(e -> e.def().key()).toList();
        assertTrue(ended.containsAll(List.of("torneo-calcio", "bowling-sabato", "tiri-pranzo")));
    }

    @Test
    @DisplayName("Asta: rilancio minimo, e un'offerta all'ultimo allunga a 30 secondi")
    void auctionRules() {
        assertEquals(40, AuctionService.minimumBid(40, null));
        assertEquals(105, AuctionService.minimumBid(40, 100));
        assertEquals(210, AuctionService.minimumBid(40, 200));
        Instant now = Instant.parse("2026-09-26T10:00:00Z");
        assertEquals(now.plusSeconds(30), AuctionService.extended(now.plusSeconds(5), now));
        assertEquals(now.plusSeconds(90), AuctionService.extended(now.plusSeconds(90), now));
    }

    @Test
    @DisplayName("Mostra: la settimana parte il lunedi'")
    void galleryWeek() {
        assertEquals(LocalDate.of(2026, 9, 21), GalleryService.weekOf(LocalDate.of(2026, 9, 26)));
        assertEquals(LocalDate.of(2026, 9, 21), GalleryService.weekOf(LocalDate.of(2026, 9, 21)));
    }

    @Test
    @DisplayName("Pesca: sotto i 95 punti mai un'epica, sotto gli 85 mai una rara")
    void fishingRarity() {
        Random random = new Random(7);
        for (int i = 0; i < 500; i++) {
            assertFalse(FishingService.rarityFor(80, random).matches("rare|epic"));
            assertFalse("epic".equals(FishingService.rarityFor(90, random)));
        }
        boolean epic = false;
        for (int i = 0; i < 500 && !epic; i++) epic = "epic".equals(FishingService.rarityFor(99, random));
        assertTrue(epic, "con un pesce enorme ogni tanto esce un'epica");
    }
}
