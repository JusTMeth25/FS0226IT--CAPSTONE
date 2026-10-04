package com.capstone.vinyldex.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TotpTest {

    /** Segreto dei vettori di prova dell'RFC 6238 ("12345678901234567890") in Base32. */
    private static final String RFC_SECRET = Totp.base32("12345678901234567890".getBytes(StandardCharsets.US_ASCII));

    @Test
    @DisplayName("I codici sono quelli dell'RFC 6238 (ultime 6 cifre), come nelle app di autenticazione")
    void rfcVectors() {
        assertEquals("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", RFC_SECRET);
        assertEquals("287082", Totp.code(RFC_SECRET, Totp.stepAt(59)));
        assertEquals("081804", Totp.code(RFC_SECRET, Totp.stepAt(1111111109)));
        assertEquals("005924", Totp.code(RFC_SECRET, Totp.stepAt(1234567890)));
        assertEquals("279037", Totp.code(RFC_SECRET, Totp.stepAt(2000000000)));
    }

    @Test
    @DisplayName("Vale anche il codice di 30 secondi prima o dopo, ma non quello gia' usato")
    void windowAndReplay() {
        long now = Totp.stepAt(1234567890);
        String before = Totp.code(RFC_SECRET, now - 1);
        assertEquals(now - 1, Totp.matchingStep(RFC_SECRET, before, now, 0));
        assertEquals(-1, Totp.matchingStep(RFC_SECRET, before, now, now - 1));
        assertEquals(-1, Totp.matchingStep(RFC_SECRET, Totp.code(RFC_SECRET, now - 2), now, 0));
        assertEquals(now, Totp.matchingStep(RFC_SECRET, "005 924", now, 0));
        assertEquals(-1, Totp.matchingStep(RFC_SECRET, "abcdef", now, 0));
    }

    @Test
    @DisplayName("Base32 va e torna, e l'indirizzo del QR ha emittente, account e segreto")
    void base32AndUri() {
        String secret = Totp.newSecret();
        assertEquals(32, secret.length());
        assertArrayEquals(Totp.base32Decode(secret), Totp.base32Decode(Totp.base32(Totp.base32Decode(secret))));
        String uri = Totp.uri("VinylDex", "io@example.com", secret);
        assertTrue(uri.startsWith("otpauth://totp/VinylDex:io%40example.com?secret=" + secret));
        assertTrue(uri.contains("issuer=VinylDex"));
    }

    @Test
    @DisplayName("I segreti cifrati si rileggono solo con la stessa chiave")
    void secretBox() {
        SecretBox box = new SecretBox("una-chiave-di-prova-lunga-abbastanza-per-i-test");
        String sealed = box.encrypt("JBSWY3DPEHPK3PXP");
        assertTrue(!sealed.contains("JBSWY3DPEHPK3PXP"));
        assertEquals("JBSWY3DPEHPK3PXP", box.decrypt(sealed));
        try {
            new SecretBox("un'altra-chiave-diversa-da-quella-di-prima").decrypt(sealed);
            throw new AssertionError("decifrato con la chiave sbagliata");
        } catch (IllegalStateException expected) {
            // ok
        }
    }
}
