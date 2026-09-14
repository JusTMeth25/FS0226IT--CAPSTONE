package com.capstone.vinyldex.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "un-segreto-di-test-lungo-almeno-trentadue-byte-per-hs256";

    private final JwtService jwtService = new JwtService(SECRET, "7d");

    @Test
    @DisplayName("Un token appena emesso restituisce l'id di chi lo possiede")
    void roundTrip() {
        UUID userId = UUID.randomUUID();
        String token = jwtService.generateToken(userId, "lorenzo", "lorenzo@example.com");
        assertEquals(userId, jwtService.extractUserId(token));
    }

    @Test
    @DisplayName("Un token firmato con un altro segreto viene rifiutato")
    void rejectsForeignSignature() {
        JwtService other = new JwtService("un-altro-segreto-lungo-almeno-trentadue-byte-diverso", "7d");
        String token = other.generateToken(UUID.randomUUID(), "mallory", "mallory@example.com");
        assertNull(jwtService.extractUserId(token));
    }

    @Test
    @DisplayName("Un payload modificato invalida la firma")
    void rejectsTamperedPayload() {
        String token = jwtService.generateToken(UUID.randomUUID(), "lorenzo", "lorenzo@example.com");
        String[] parts = token.split("\\.");

        // Si riusa il payload di un secondo token tenendo la firma del primo: e' il caso
        // che conta davvero, cioe' qualcuno che prova a cambiare il proprio id utente.
        String otherPayload = jwtService.generateToken(UUID.randomUUID(), "mallory", "mallory@example.com")
                .split("\\.")[1];

        assertNull(jwtService.extractUserId(parts[0] + "." + otherPayload + "." + parts[2]));
    }

    @Test
    @DisplayName("Spazzatura al posto del token non fa esplodere niente")
    void rejectsGarbage() {
        assertNull(jwtService.extractUserId("non-e-un-token"));
        assertNull(jwtService.extractUserId(""));
    }

    @Test
    @DisplayName("Un segreto troppo corto per HS256 blocca l'avvio")
    void refusesShortSecret() {
        assertThrows(IllegalStateException.class, () -> new JwtService("corto", "7d"));
    }

    @Test
    @DisplayName("Le durate nel formato di jsonwebtoken sono comprese")
    void parsesDurations() {
        assertEquals(604800, new JwtService(SECRET, "7d").getExpirationSeconds());
        assertEquals(86400, new JwtService(SECRET, "24h").getExpirationSeconds());
        assertEquals(1800, new JwtService(SECRET, "30m").getExpirationSeconds());
        assertEquals(3600, new JwtService(SECRET, "3600").getExpirationSeconds());
    }
}
