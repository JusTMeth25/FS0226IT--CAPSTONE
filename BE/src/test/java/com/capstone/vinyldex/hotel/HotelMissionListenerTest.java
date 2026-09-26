package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Mission;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Quali partite ai minigiochi fanno avanzare le missioni dell'hotel. */
class HotelMissionListenerTest {

    private static Mission mission(Map<String, Object> metadata) {
        Mission mission = new Mission();
        mission.setMetadata(metadata == null ? null : new HashMap<>(metadata));
        return mission;
    }

    @Test
    @DisplayName("Conta il gioco giusto con il punteggio minimo; golf vale per tutte le buche; senza gioco vale ogni partita")
    void matches() {
        Mission bowling = mission(Map.of("game", "bowling", "minScore", 40));
        assertTrue(HotelMissionListener.matches(bowling, "bowling", 45));
        assertFalse(HotelMissionListener.matches(bowling, "bowling", 39), "sotto il minimo");
        assertFalse(HotelMissionListener.matches(bowling, "basket", 50), "gioco sbagliato");

        Mission golf = mission(Map.of("game", "golf", "minScore", 4));
        assertTrue(HotelMissionListener.matches(golf, "golf3", 5));
        assertFalse(HotelMissionListener.matches(golf, "golf3", 2));

        Mission any = mission(Map.of("minScore", 0));
        assertTrue(HotelMissionListener.matches(any, "curl", 0));
        assertTrue(HotelMissionListener.matches(mission(null), "pool", 3), "senza metadati vale tutto");
    }
}
