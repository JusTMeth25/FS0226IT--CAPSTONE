package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.SecretBox;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Base64;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * "Non ricordo la password": l'utente chiede un link via email, il link porta un token monouso che
 * scade dopo pochi minuti e con quello si sceglie la password nuova.
 *
 * - La richiesta risponde sempre allo stesso modo, che l'email esista o no.
 * - Nel database c'e' solo l'hash SHA-256 del token; un link nuovo annulla quelli vecchi.
 * - Al cambio: password BCrypt, token di accesso emessi prima rifiutati (passwordChangedAt),
 *   dispositivi fidati della verifica in due passaggi dimenticati, email di avviso.
 * - Limiti: PER_EMAIL link all'ora per account, PER_IP richieste all'ora per indirizzo.
 */
@Service
public class PasswordResetService {

    static final int PER_EMAIL = 3;
    static final int PER_IP = 10;
    private static final Duration WINDOW = Duration.ofHours(1);

    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final MailTemplates templates;
    private final String appUrl;
    private final Duration validity;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Deque<Instant>> byIp = new ConcurrentHashMap<>();

    public PasswordResetService(UserRepository users, JdbcTemplate jdbc, PasswordEncoder encoder, MailService mail,
                                MailTemplates templates,
                                @Value("${vinyldex.app.url:http://localhost:5173}") String appUrl,
                                @Value("${vinyldex.password-reset.minutes:30}") long minutes) {
        this.users = users;
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.mail = mail;
        this.templates = templates;
        this.appUrl = appUrl.replaceAll("/+$", "");
        this.validity = Duration.ofMinutes(minutes);
    }

    /** Manda il link se l'email e' di un account; altrimenti non fa niente (stessa risposta). */
    @Transactional
    public void request(String email, String ip) {
        limitIp(ip);
        User user = email == null ? null : users.findByEmailIgnoreCase(email.trim()).orElse(null);
        if (user == null || user.isNpc()) return;
        Integer recent = jdbc.queryForObject("select count(*) from password_reset_tokens where user_id = ? and created_at > ?",
                Integer.class, user.getId(), Timestamp.from(Instant.now().minus(WINDOW)));
        if (recent != null && recent >= PER_EMAIL) return;

        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant now = Instant.now();
        jdbc.update("update password_reset_tokens set used_at = ? where user_id = ? and used_at is null",
                Timestamp.from(now), user.getId());
        jdbc.update("insert into password_reset_tokens (user_id, token_hash, expires_at, ip) values (?, ?, ?, ?)",
                user.getId(), SecretBox.sha256(token), Timestamp.from(now.plus(validity)), ip);

        String link = appUrl + "/#/reset-password?token=" + token;
        mail.send(user.getEmail(), templates.render("reset-password", "Reimposta la password di VinylDex", "Nuova password",
                Map.of("username", user.getUsername(), "link", link, "minutes", validity.toMinutes())));
    }

    /** Imposta la password nuova col token del link. */
    @Transactional
    public void reset(String token, String password) {
        if (token == null || token.isBlank()) throw ApiException.badRequest("reset_token_invalid");
        List<UUID> found = jdbc.queryForList("""
                select user_id from password_reset_tokens
                where token_hash = ? and used_at is null and expires_at > ?
                for update""", UUID.class, SecretBox.sha256(token.trim()), Timestamp.from(Instant.now()));
        if (found.isEmpty()) throw ApiException.badRequest("reset_token_invalid");
        User user = users.findById(found.getFirst()).orElseThrow(() -> ApiException.badRequest("reset_token_invalid"));

        Instant now = Instant.now();
        user.setPasswordHash(encoder.encode(password));
        user.setPasswordChangedAt(now);
        users.save(user);
        jdbc.update("update password_reset_tokens set used_at = ? where user_id = ? and used_at is null",
                Timestamp.from(now), user.getId());
        jdbc.update("delete from trusted_devices where user_id = ?", user.getId());

        mail.send(user.getEmail(), templates.render("password-changed", "La password di VinylDex è cambiata", "Password cambiata",
                Map.of("username", user.getUsername(), "forgotUrl", appUrl + "/#/forgot-password")));
    }

    private void limitIp(String ip) {
        if (ip == null) return;
        Instant now = Instant.now();
        Deque<Instant> times = byIp.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst().isBefore(now.minus(WINDOW))) times.pollFirst();
            if (times.size() >= PER_IP) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "too_many_requests");
            times.addLast(now);
        }
    }
}
