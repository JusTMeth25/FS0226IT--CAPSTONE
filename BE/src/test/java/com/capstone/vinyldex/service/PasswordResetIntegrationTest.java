package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** "Non ricordo la password": link via email, token monouso, vecchie sessioni chiuse. */
@SpringBootTest(properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class PasswordResetIntegrationTest {

    /** Le email non partono: si tengono per leggere il link. */
    static final List<String[]> SENT = new ArrayList<>();

    @TestConfiguration
    static class Outbox {
        @Bean
        @Primary
        MailService outbox() {
            return new MailService(null, "", "", "VinylDex") {
                @Override
                public void send(String to, String subject, String text, String html) {
                    synchronized (SENT) {
                        SENT.add(new String[]{to, subject, text});
                    }
                }
            };
        }
    }

    @Autowired
    private PasswordResetService reset;
    @Autowired
    private AuthService auth;
    @Autowired
    private JwtService jwt;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    private String linkTokenFor(String email) {
        synchronized (SENT) {
            for (int i = SENT.size() - 1; i >= 0; i--) {
                if (!SENT.get(i)[0].equals(email)) continue;
                Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(SENT.get(i)[2]);
                if (m.find()) return m.group(1);
            }
        }
        return null;
    }

    private long mailsTo(String email) {
        synchronized (SENT) {
            return SENT.stream().filter(m -> m[0].equals(email)).count();
        }
    }

    @Test
    @DisplayName("Link via email, password nuova, token usato una volta, vecchi accessi rifiutati")
    void fullFlow() {
        String name = "rst_" + UUID.randomUUID().toString().substring(0, 8);
        String email = name + "@test.local";
        auth.register(new AuthRequests.RegisterRequest(name, email, "Vecchia123!"));
        UUID id = users.findByEmailIgnoreCase(email).orElseThrow().getId();
        try {
            String oldToken = jwt.generateToken(id, name, email);
            reset.request(email.toUpperCase(), "10.0.0.1");
            String token = linkTokenFor(email);
            assertNotNull(token, "email col link");

            assertThrows(ApiException.class, () -> reset.reset("sbagliato", "Nuova12345!"));
            reset.reset(token, "Nuova12345!");
            assertThrows(ApiException.class, () -> reset.reset(token, "Altra12345!"), "il link vale una volta");
            assertEquals(2, mailsTo(email), "link e avviso di password cambiata");

            assertThrows(ApiException.class, () -> auth.login(new AuthRequests.LoginRequest(email, "Vecchia123!")));
            assertNotNull(auth.login(new AuthRequests.LoginRequest(email, "Nuova12345!")));

            User user = users.findById(id).orElseThrow();
            JwtService.Access old = jwt.extractAccess(oldToken);
            assertFalse(user.acceptsTokenIssuedAt(old.issuedAt().minusSeconds(1)), "token di prima rifiutato");
            assertTrue(user.acceptsTokenIssuedAt(Instant.now().plusSeconds(1)), "token nuovo accettato");
        } finally {
            jdbc.update("delete from users where id = ?", id);
        }
    }

    @Test
    @DisplayName("Email sconosciuta: nessuna email, stessa risposta; massimo tre link all'ora per account")
    void unknownAndLimit() {
        String name = "rsl_" + UUID.randomUUID().toString().substring(0, 8);
        String email = name + "@test.local";
        reset.request("nessuno_" + name + "@test.local", "10.0.0.2");
        assertEquals(0, mailsTo("nessuno_" + name + "@test.local"));

        auth.register(new AuthRequests.RegisterRequest(name, email, "Password123!"));
        UUID id = users.findByEmailIgnoreCase(email).orElseThrow().getId();
        try {
            for (int i = 0; i < 5; i++) reset.request(email, "10.0.0.3");
            assertEquals(PasswordResetService.PER_EMAIL, mailsTo(email));
            Integer open = jdbc.queryForObject("select count(*) from password_reset_tokens where user_id = ? and used_at is null",
                    Integer.class, id);
            assertEquals(1, open, "un link nuovo annulla i vecchi");

            for (int i = 0; i < PasswordResetService.PER_IP; i++) reset.request("x" + i + "@test.local", "10.0.0.4");
            ApiException tooMany = assertThrows(ApiException.class, () -> reset.request(email, "10.0.0.4"));
            assertEquals("too_many_requests", tooMany.getMessage());
        } finally {
            jdbc.update("delete from users where id = ?", id);
        }
    }
}
