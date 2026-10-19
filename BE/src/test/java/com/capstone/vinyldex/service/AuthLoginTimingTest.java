package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Il login deve costare lo stesso tempo che l'email esista o no: la password si confronta
 * sempre con BCrypt (con un hash fittizio se l'account non c'e').
 */
class AuthLoginTimingTest {

    /** BCrypt a costo basso (test veloce) che conta i confronti. */
    private static final class CountingEncoder implements PasswordEncoder {
        final AtomicInteger matches = new AtomicInteger();
        private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder(4);

        @Override
        public String encode(CharSequence raw) {
            return bcrypt.encode(raw);
        }

        @Override
        public boolean matches(CharSequence raw, String encoded) {
            matches.incrementAndGet();
            return bcrypt.matches(raw, encoded);
        }
    }

    private final UserRepository users = mock(UserRepository.class);
    private final CountingEncoder encoder = new CountingEncoder();
    private final AuthService auth = new AuthService(users, encoder,
            new JwtService("un-segreto-di-test-lungo-almeno-trentadue-byte-per-hs256", "7d"));

    private void assertInvalid(String email, String password) {
        ApiException ex = assertThrows(ApiException.class, () -> auth.login(new AuthRequests.LoginRequest(email, password)));
        assertEquals("invalid_credentials", ex.getCode());
    }

    @Test
    @DisplayName("Email inesistente: BCrypt gira lo stesso e l'errore e' quello della password sbagliata")
    void unknownEmailStillHashes() {
        when(users.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        assertInvalid("nessuno@example.com", "Password123!");
        assertEquals(1, encoder.matches.get());
    }

    @Test
    @DisplayName("Email scritta male: nessuna ricerca, ma stesso confronto e stesso errore")
    void malformedEmailStillHashes() {
        assertInvalid("non-una-email", "Password123!");
        assertEquals(1, encoder.matches.get());
    }

    @Test
    @DisplayName("Account senza password (solo Google/Apple): stesso confronto, stesso errore")
    void socialOnlyAccount() {
        User user = new User();
        user.setEmail("social@example.com");
        when(users.findByEmailIgnoreCase("social@example.com")).thenReturn(Optional.of(user));
        assertInvalid("social@example.com", "qualsiasi");
        assertEquals(1, encoder.matches.get());
    }

    @Test
    @DisplayName("Password sbagliata su account vero: un confronto, stesso errore")
    void wrongPassword() {
        User user = new User();
        user.setEmail("vero@example.com");
        user.setPasswordHash(encoder.encode("Giusta123!"));
        when(users.findByEmailIgnoreCase("vero@example.com")).thenReturn(Optional.of(user));
        assertInvalid("vero@example.com", "Sbagliata1!");
        assertEquals(1, encoder.matches.get());
    }
}
