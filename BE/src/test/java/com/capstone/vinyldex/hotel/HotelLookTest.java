package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HotelLookTest {

    @Test
    @DisplayName("I codici della prima versione restano validi, quelli nuovi hanno tipo di maglia, scarpe e accessorio")
    void oldAndNewCodes() {
        assertTrue(HotelLook.isValid("s1.h1.hc0.sh0.p0"));
        assertTrue(HotelLook.isValid("s5.h9.hc9.sh11.p7.t4.f5.a6"));
        assertFalse(HotelLook.isValid("s6.h1.hc0.sh0.p0"), "carnagione che non esiste");
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh12.p0"), "colore di maglia che non esiste");
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh0.p0.t6.f0.a0"), "tipo di maglia che non esiste");
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh0.p0.t0"), "le parti nuove vanno tutte insieme");
        assertEquals(HotelLook.DEFAULT, HotelLook.orDefault("<script>"));
    }

    @Test
    @DisplayName("Corporatura facoltativa; il petto nudo e' solo per la corporatura da uomo")
    void bodyAndBareChest() {
        assertTrue(HotelLook.isValid("s1.h1.hc0.sh0.p0.t0.f0.a0.b1"));
        assertTrue(HotelLook.isValid("s1.h1.hc0.sh0.p0.t5.f0.a0"), "senza corporatura vale uomo");
        assertTrue(HotelLook.isValid("s1.h1.hc0.sh0.p0.t5.f0.a0.b0"));
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh0.p0.t5.f0.a0.b1"), "petto nudo con corporatura da donna");
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh0.p0.t0.f0.a0.b2"), "corporatura che non esiste");
        assertTrue(HotelLook.isValid(HotelLook.DEFAULT));
    }
}
