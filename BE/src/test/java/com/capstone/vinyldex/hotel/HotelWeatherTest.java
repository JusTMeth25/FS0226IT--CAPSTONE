package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.EnumSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Stagioni, feste e meteo dell'hotel; nuovi minigiochi di stadio, bowling e minigolf. */
class HotelWeatherTest {

    private static Instant at(int year, int month, int day, int hour) {
        return ZonedDateTime.of(year, month, day, hour, 0, 0, 0, HotelWeather.ZONE).toInstant();
    }

    @Test
    @DisplayName("Le stagioni sono quelle meteorologiche e le feste hanno i loro giorni")
    void seasonsAndHolidays() {
        assertEquals(HotelWeather.Season.WINTER, HotelWeather.seasonOf(LocalDate.of(2026, 1, 15)));
        assertEquals(HotelWeather.Season.SPRING, HotelWeather.seasonOf(LocalDate.of(2026, 4, 1)));
        assertEquals(HotelWeather.Season.SUMMER, HotelWeather.seasonOf(LocalDate.of(2026, 8, 10)));
        assertEquals(HotelWeather.Season.AUTUMN, HotelWeather.seasonOf(LocalDate.of(2026, 9, 26)));
        assertEquals("halloween", HotelWeather.holidayOf(LocalDate.of(2026, 10, 31)));
        assertEquals("christmas", HotelWeather.holidayOf(LocalDate.of(2026, 12, 25)));
        assertEquals("christmas", HotelWeather.holidayOf(LocalDate.of(2027, 1, 6)));
        assertNull(HotelWeather.holidayOf(LocalDate.of(2027, 1, 7)));
        assertNull(HotelWeather.holidayOf(LocalDate.of(2026, 9, 26)));
    }

    @Test
    @DisplayName("Il meteo e' uguale per tutti nella stessa fascia di tre ore e cambia con la fascia")
    void sameForEveryone() {
        HotelWeather.Weather a = HotelWeather.at(at(2026, 9, 26, 10));
        HotelWeather.Weather b = HotelWeather.at(at(2026, 9, 26, 10).plusSeconds(3_000));
        assertEquals(a, b);
        assertNotEquals(a.slot(), HotelWeather.at(at(2026, 9, 26, 13)).slot());
    }

    @Test
    @DisplayName("Ogni stagione ha il suo tempo: niente neve d'estate, niente caldo afoso d'inverno")
    void climate() {
        Set<HotelWeather.Condition> summer = EnumSet.noneOf(HotelWeather.Condition.class);
        Set<HotelWeather.Condition> winter = EnumSet.noneOf(HotelWeather.Condition.class);
        for (int slot = 0; slot < 200; slot++) {
            HotelWeather.Weather july = HotelWeather.at(at(2026, 7, 1, 0).plusSeconds(slot * 3L * 3600 % (28L * 86400)));
            summer.add(july.condition());
            HotelWeather.Weather january = HotelWeather.at(at(2027, 1, 1, 0).plusSeconds(slot * 3L * 3600 % (28L * 86400)));
            winter.add(january.condition());
            if (january.condition() == HotelWeather.Condition.SNOW) assertTrue(january.temperature() <= 1);
        }
        assertTrue(summer.contains(HotelWeather.Condition.HOT) && !summer.contains(HotelWeather.Condition.SNOW), summer.toString());
        assertTrue(winter.contains(HotelWeather.Condition.SNOW) && !winter.contains(HotelWeather.Condition.HOT), winter.toString());
    }

    @Test
    @DisplayName("Canestri, piste e sei buche del minigolf sono minigiochi, ognuno con il suo record")
    void newMinigames() {
        assertEquals("basket", Minigames.forFurni("basket_hoop").orElseThrow().key());
        assertEquals("bowling", Minigames.forFurni("bowling_lane").orElseThrow().key());
        for (int hole = 1; hole <= Minigames.GOLF_HOLES; hole++) {
            Minigames.Game game = Minigames.forFurni("golf_hole_" + hole).orElseThrow();
            assertEquals("golf" + hole, game.key());
            assertEquals(6, game.maxScore());
            assertTrue(FurniCatalog.get("golf_hole_" + hole).isPresent());
        }
    }
}
