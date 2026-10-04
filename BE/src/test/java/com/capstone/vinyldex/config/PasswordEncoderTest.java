package com.capstone.vinyldex.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordEncoderTest {

    private final PasswordEncoder encoder = new SecurityConfig(null, null, null, "").passwordEncoder();

    @Test
    @DisplayName("Le password nuove si salvano come hash BCrypt a costo 12")
    void hashesWithCost12() {
        String hash = encoder.encode("Password123!");
        assertTrue(hash.startsWith("$2a$12$"), hash.substring(0, 7));
        assertTrue(encoder.matches("Password123!", hash));
        assertFalse(encoder.upgradeEncoding(hash));
    }

    @Test
    @DisplayName("Gli hash vecchi a costo 10 restano validi e vanno aggiornati al login")
    void oldCost10HashesStillWork() {
        String old = new BCryptPasswordEncoder(10).encode("Password123!");
        assertTrue(encoder.matches("Password123!", old));
        assertTrue(encoder.upgradeEncoding(old));
    }
}
