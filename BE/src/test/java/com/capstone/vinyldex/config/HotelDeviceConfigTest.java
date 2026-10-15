package com.capstone.vinyldex.config;

import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelSession;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Le giocate del casino valgono solo dal dispositivo collegato adesso all'hotel. */
class HotelDeviceConfigTest {

    @Test
    @DisplayName("Dispositivo attuale ok; vecchio dispositivo o richiesta senza id respinti")
    void onlyCurrentDevice() {
        HotelSession current = mock(HotelSession.class);
        when(current.id()).thenReturn("nuovo");
        assertDoesNotThrow(() -> HotelDeviceConfig.checkDevice(current, "nuovo"));
        ApiException old = assertThrows(ApiException.class, () -> HotelDeviceConfig.checkDevice(current, "vecchio"));
        assertEquals("hotel_other_device", old.getMessage());
        assertThrows(ApiException.class, () -> HotelDeviceConfig.checkDevice(current, null));
        // Senza hotel aperto decide il casino stesso (casino_not_here).
        assertDoesNotThrow(() -> HotelDeviceConfig.checkDevice(null, null));
    }
}
