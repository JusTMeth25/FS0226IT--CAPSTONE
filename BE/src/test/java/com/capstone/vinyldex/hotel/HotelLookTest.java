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

    @Test
    @DisplayName("Capo firmato, orologio e veicolo dei negozi del quartiere: in coda, tutti e tre insieme")
    void luxuryParts() {
        String look = "s1.h1.hc0.sh0.p0.t0.f0.a0.b0.o2.w3.r5";
        assertTrue(HotelLook.isValid(look));
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh0.p0.t0.f0.a0.b0.o2"), "le parti del quartiere vanno insieme");
        assertFalse(HotelLook.isValid("s1.h1.hc0.sh0.p0.t0.f0.a0.b0.o9.w0.r0"), "capo che non esiste");
        assertEquals(2, HotelLook.part(look, "o"));
        assertEquals(0, HotelLook.part(look, "x"));
        assertEquals(java.util.List.of("o2", "w3", "r5"), HotelLook.luxuryItems(look));
        assertEquals(java.util.List.of(), HotelLook.luxuryItems(HotelLook.DEFAULT));
        // A piedi si fa una casella per passo; con l'auto quattro.
        assertEquals(1, LuxuryCatalog.speedOf(HotelLook.DEFAULT));
        assertEquals(4, LuxuryCatalog.speedOf(look));
        assertEquals(LuxuryCatalog.OUTFITS - 1, LuxuryCatalog.ITEMS.stream().filter(i -> i.part().equals("o")).count());
        assertEquals(LuxuryCatalog.WATCH_COUNT - 1, LuxuryCatalog.ITEMS.stream().filter(i -> i.part().equals("w")).count());
        assertEquals(LuxuryCatalog.RIDES - 1, LuxuryCatalog.ITEMS.stream().filter(i -> i.part().equals("r")).count());
    }
}
