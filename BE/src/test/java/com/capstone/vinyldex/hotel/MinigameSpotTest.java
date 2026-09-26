package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Dove ci si mette per giocare e quali eventi dei minigiochi arrivano agli altri. */
class MinigameSpotTest {

    private static RoomItemView item(String type, int x, int y, int rot) {
        return new RoomItemView(UUID.randomUUID(), null, type, x, y, 0, rot, null);
    }

    @Test
    @DisplayName("Si tira dalla lunetta, si lancia dalla linea della pista, si parte dal tee")
    void spots() {
        assertArrayEquals(new int[]{6, 9}, RoomInstance.gameSpot(item("basket_hoop", 2, 9, 2)), "canestro verso est");
        assertArrayEquals(new int[]{25, 9}, RoomInstance.gameSpot(item("basket_hoop", 29, 9, 6)), "canestro verso ovest");
        assertArrayEquals(new int[]{8, 3}, RoomInstance.gameSpot(item("bowling_lane", 8, 4, 0)), "pista verso chi guarda");
        assertArrayEquals(new int[]{16, 2}, RoomInstance.gameSpot(item("bowling_lane", 17, 2, 2)), "pista lungo x");
        assertArrayEquals(new int[]{3, 3}, RoomInstance.gameSpot(item("golf_hole_1", 4, 3, 0)));
        assertNull(RoomInstance.gameSpot(item("punching_bag", 4, 3, 0)), "il sacco si usa da accanto");
    }

    @Test
    @DisplayName("Gli eventi dei minigiochi passano ripuliti: tipo noto, numeri nei limiti, birilli da 0 a 9")
    void fxSanitized() {
        JsonMapper json = JsonMapper.builder().build();
        Map<String, Object> roll = HotelSocketHandler.minigameFx(json.readTree(
                "{\"kind\":\"roll\",\"x\":1.5,\"power\":900,\"fallen\":[0,1,1,12,-1,\"a\"],\"standing\":[2,3],\"evil\":\"<script>\"}"));
        assertEquals("roll", roll.get("kind"));
        assertEquals(1.5, roll.get("x"));
        assertEquals(100.0, roll.get("power"), "numeri tagliati");
        assertEquals(List.of(0, 1), roll.get("fallen"), "birilli validi e senza doppioni");
        assertFalse(roll.containsKey("evil"));
        assertNull(HotelSocketHandler.minigameFx(json.readTree("{\"kind\":\"teleport\"}")));
        assertNull(HotelSocketHandler.minigameFx(json.readTree("\"shoot\"")));
    }
}
