package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.dto.response.AuthResponse;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.security.IdTokenVerifier;
import com.capstone.vinyldex.security.JwtService;
import com.capstone.vinyldex.security.Totp;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.security.KeyPair;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Accesso con Google (con un "Google" finto che firma con chiavi locali) e verifica in due
 * passaggi sul database vero: account creato al primo accesso, codice chiesto solo sui
 * dispositivi non fidati, codici di emergenza monouso.
 */
@SpringBootTest(properties = {"vinyldex.fc27.seed-ea-players=0", "vinyldex.auth.google.web-client-id=test-web-client"})
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class SocialTwoFactorIntegrationTest {

    @Autowired
    private AuthService authService;
    @Autowired
    private SocialLoginService social;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private JdbcTemplate jdbc;

    private final KeyPair keys = Jwts.SIG.RS256.keyPair().build();
    private final String email = "social2fa_" + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
    private final String subject = "google-" + UUID.randomUUID();

    @AfterEach
    void cleanup() {
        jdbc.update("delete from users where email = ?", email);
    }

    private String idToken() {
        return Jwts.builder().header().keyId("k").and()
                .subject(subject).issuer("https://accounts.google.com").audience().add("test-web-client").and()
                .claim("email", email).claim("email_verified", true)
                .expiration(new Date(System.currentTimeMillis() + 600_000))
                .signWith(keys.getPrivate()).compact();
    }

    private AuthResponse google(String deviceToken) {
        return authService.socialLogin(new AuthRequests.SocialLoginRequest("google", idToken(), "Màrio Rossi", deviceToken));
    }

    @Test
    @DisplayName("Google crea l'account, poi la verifica in due passaggi vale solo sui dispositivi nuovi")
    void fullFlow() {
        social.useVerifiers(new IdTokenVerifier(Set.of("https://accounts.google.com"), kid -> keys.getPublic()), null);

        // Primo accesso: account nuovo, username dal nome senza accenti, accesso diretto.
        AuthResponse first = google(null);
        assertNotNull(first.token());
        assertTrue(first.user().username().startsWith("Mario_Rossi"), first.user().username());
        UUID userId = first.user().id();
        assertEquals(userId, google(null).user().id(), "stesso account al secondo accesso");
        assertTrue(authService.socialProviders().containsKey("google"));

        // Attivazione: QR, primo codice dell'app, codici di emergenza e questo dispositivo fidato.
        TwoFactorService.Setup setup = authService.twoFactorSetup(userId);
        assertThrows(ApiException.class, () -> authService.twoFactorEnable(userId, "000000", "test"));
        String code = Totp.code(setup.secret(), Totp.stepAt(Instant.now().getEpochSecond()));
        Map<String, Object> enabled = authService.twoFactorEnable(userId, code, "Chrome su Windows");
        @SuppressWarnings("unchecked")
        List<String> backup = (List<String>) enabled.get("backupCodes");
        String trusted = (String) enabled.get("deviceToken");
        assertEquals(10, backup.size());
        String stored = jdbc.queryForObject("select totp_secret from users where id = ?", String.class, userId);
        assertTrue(stored != null && !stored.contains(setup.secret()), "segreto cifrato nel database");

        // Dispositivo fidato: niente codice. Dispositivo nuovo: challenge.
        assertNotNull(google(trusted).token());
        AuthResponse challenge = google(null);
        assertNull(challenge.token());
        assertTrue(challenge.twoFactorRequired());
        assertNull(jwtService.extractUserId(challenge.challenge()), "il challenge non e' un token di accesso");

        // Codice sbagliato, poi codice di emergenza: accesso e nuovo dispositivo fidato.
        assertThrows(ApiException.class, () -> authService.verifySecondStep(
                new AuthRequests.TwoFactorVerifyRequest(challenge.challenge(), "123456", true), "x"));
        AuthResponse ok = authService.verifySecondStep(
                new AuthRequests.TwoFactorVerifyRequest(challenge.challenge(), backup.get(0).toUpperCase(), true), "Safari su iOS");
        assertNotNull(ok.token());
        assertNotNull(ok.deviceToken());
        assertNotNull(google(ok.deviceToken()).token());
        assertThrows(ApiException.class, () -> authService.verifySecondStep(
                new AuthRequests.TwoFactorVerifyRequest(challenge.challenge(), backup.get(0), false), "x"), "codice di emergenza monouso");
        assertEquals(2, authService.twoFactorStatus(userId).get("trustedDevices"));

        // "Dimentica gli altri dispositivi": resta solo quello da cui lo si chiede.
        assertEquals(1, authService.forgetOtherDevices(userId, ok.deviceToken()));
        assertTrue(google(trusted).twoFactorRequired());

        // Spegnimento con un codice di emergenza: di nuovo accesso diretto ovunque.
        authService.twoFactorDisable(userId, backup.get(1));
        assertNotNull(google(null).token());
    }
}
