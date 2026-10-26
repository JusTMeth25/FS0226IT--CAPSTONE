package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.security.SecretBox;
import com.capstone.vinyldex.security.Totp;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifica in due passaggi: dopo la password (o Google) serve il codice a 6 cifre dell'app
 * di autenticazione, ma solo sui dispositivi nuovi.
 *
 * Un dispositivo che ha superato il secondo passaggio diventa "fidato" per {@code trustDays}
 * giorni, e la scadenza si sposta in avanti a ogni accesso: chi entra almeno una volta al mese
 * dallo stesso telefono o browser non rivede mai il codice. Lo rivede su un dispositivo nuovo,
 * dopo un logout da "dimentica i dispositivi" o dopo tanto tempo senza entrare.
 */
@Service
public class TwoFactorService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ISSUER = "VinylDex";
    private static final int BACKUP_CODES = 10;
    private static final String BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
    private static final int MAX_DEVICES = 10;
    private static final int MAX_FAILURES = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(10);

    private final JdbcTemplate jdbc;
    private final SecretBox box;
    private final Duration trust;
    private final Clock clock;
    private final Map<UUID, Failures> failures = new ConcurrentHashMap<>();

    private record Failures(int count, Instant since) {
    }

    public record Setup(String secret, String uri) {
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TwoFactorService(JdbcTemplate jdbc, SecretBox box,
                            @Value("${vinyldex.two-factor.trust-days:30}") int trustDays) {
        this(jdbc, box, Duration.ofDays(trustDays), Clock.systemUTC());
    }

    TwoFactorService(JdbcTemplate jdbc, SecretBox box, Duration trust, Clock clock) {
        this.jdbc = jdbc;
        this.box = box;
        this.trust = trust;
        this.clock = clock;
    }

    public long trustDays() {
        return trust.toDays();
    }

    /**
     * Serve il codice a 6 cifre? No se la verifica non e' attiva o se il dispositivo e' fidato
     * (in quel caso la fiducia si rinnova da qui in avanti).
     */
    public boolean needsSecondStep(User user, String deviceToken) {
        if (!user.isTwoFactorEnabled()) return false;
        if (deviceToken == null || deviceToken.isBlank() || deviceToken.length() > 200) return true;
        Instant now = clock.instant();
        int touched = jdbc.update("""
                update trusted_devices set last_used_at = ?, expires_at = ?
                where user_id = ? and token_hash = ? and expires_at > ?""",
                Timestamp.from(now), Timestamp.from(now.plus(trust)), user.getId(),
                SecretBox.sha256(deviceToken), Timestamp.from(now));
        return touched == 0;
    }

    /** Rende fidato il dispositivo e restituisce il token da conservare sul dispositivo. */
    public String trustDevice(UUID userId, String label) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant now = clock.instant();
        jdbc.update("delete from trusted_devices where user_id = ? and expires_at <= ?", userId, Timestamp.from(now));
        jdbc.update("insert into trusted_devices (user_id, token_hash, label, created_at, last_used_at, expires_at) values (?, ?, ?, ?, ?, ?)",
                userId, SecretBox.sha256(token), label == null ? null : label.substring(0, Math.min(120, label.length())),
                Timestamp.from(now), Timestamp.from(now), Timestamp.from(now.plus(trust)));
        // Al massimo dieci dispositivi fidati: si dimenticano quelli usati meno di recente.
        jdbc.update("""
                delete from trusted_devices where user_id = ? and id not in (
                    select id from trusted_devices where user_id = ? order by last_used_at desc limit ?)""",
                userId, userId, MAX_DEVICES);
        return token;
    }

    /** Dimentica tutti i dispositivi fidati tranne quello da cui si fa la richiesta. */
    public int forgetOtherDevices(UUID userId, String keepToken) {
        String keep = keepToken == null || keepToken.isBlank() ? "" : SecretBox.sha256(keepToken);
        return jdbc.update("delete from trusted_devices where user_id = ? and token_hash <> ?", userId, keep);
    }

    public int trustedDevices(UUID userId) {
        Integer n = jdbc.queryForObject("select count(*) from trusted_devices where user_id = ? and expires_at > ?",
                Integer.class, userId, Timestamp.from(clock.instant()));
        return n == null ? 0 : n;
    }

    public int backupCodesLeft(UUID userId) {
        Integer n = jdbc.queryForObject("select count(*) from two_factor_backup_codes where user_id = ? and used_at is null",
                Integer.class, userId);
        return n == null ? 0 : n;
    }

    /** Primo passo dell'attivazione: segreto nuovo da mostrare come QR code. */
    public Setup setup(User user) {
        if (user.isTwoFactorEnabled()) throw ApiException.conflict("two_factor_already_enabled");
        String secret = Totp.newSecret();
        user.setTotpPending(box.encrypt(secret));
        return new Setup(secret, Totp.uri(ISSUER, user.getEmail(), secret));
    }

    /**
     * Secondo passo: il primo codice dell'app conferma che il QR e' stato letto. Restituisce i
     * codici di emergenza, mostrati una volta sola.
     */
    public List<String> enable(User user, String code) {
        if (user.isTwoFactorEnabled()) throw ApiException.conflict("two_factor_already_enabled");
        if (user.getTotpPending() == null) throw ApiException.badRequest("two_factor_not_started");
        checkNotLocked(user.getId());
        String secret = box.decrypt(user.getTotpPending());
        long step = Totp.matchingStep(secret, code, Totp.stepAt(clock.instant().getEpochSecond()), 0);
        if (step < 0) {
            fail(user.getId());
            throw ApiException.badRequest("invalid_two_factor_code");
        }
        failures.remove(user.getId());
        user.setTotpSecret(user.getTotpPending());
        user.setTotpPending(null);
        user.setTotpLastStep(step);
        user.setTwoFactorEnabled(true);
        return newBackupCodes(user.getId());
    }

    /** Spegne la verifica: serve un codice valido (dell'app o di emergenza). */
    public void disable(User user, String code) {
        if (!user.isTwoFactorEnabled()) throw ApiException.badRequest("two_factor_not_enabled");
        if (!verify(user, code)) throw ApiException.badRequest("invalid_two_factor_code");
        user.setTwoFactorEnabled(false);
        user.setTotpSecret(null);
        user.setTotpPending(null);
        user.setTotpLastStep(0);
        jdbc.update("delete from trusted_devices where user_id = ?", user.getId());
        jdbc.update("delete from two_factor_backup_codes where user_id = ?", user.getId());
    }

    /** Nuovi codici di emergenza (i vecchi non valgono piu'); serve un codice valido. */
    public List<String> regenerateBackupCodes(User user, String code) {
        if (!user.isTwoFactorEnabled()) throw ApiException.badRequest("two_factor_not_enabled");
        if (!verify(user, code)) throw ApiException.badRequest("invalid_two_factor_code");
        return newBackupCodes(user.getId());
    }

    /**
     * Controlla un codice a 6 cifre dell'app o un codice di emergenza (che poi non vale piu').
     * Dopo cinque errori in dieci minuti l'account resta bloccato per il resto dei dieci minuti:
     * un milione di combinazioni non si provano a mano.
     */
    public boolean verify(User user, String code) {
        checkNotLocked(user.getId());
        boolean ok = false;
        String clean = code == null ? "" : code.trim();
        if (user.getTotpSecret() != null && clean.replaceAll("\\s", "").matches("\\d{6}")) {
            long step = Totp.matchingStep(box.decrypt(user.getTotpSecret()), clean,
                    Totp.stepAt(clock.instant().getEpochSecond()), user.getTotpLastStep());
            if (step >= 0) {
                user.setTotpLastStep(step);
                ok = true;
            }
        } else if (!clean.isEmpty()) {
            String hash = SecretBox.sha256(normalizeBackup(clean));
            ok = jdbc.update("update two_factor_backup_codes set used_at = ? where user_id = ? and code_hash = ? and used_at is null",
                    Timestamp.from(clock.instant()), user.getId(), hash) > 0;
        }
        if (ok) failures.remove(user.getId());
        else fail(user.getId());
        return ok;
    }

    private void checkNotLocked(UUID userId) {
        Failures f = failures.get(userId);
        if (f == null) return;
        if (clock.instant().isAfter(f.since().plus(FAILURE_WINDOW))) {
            failures.remove(userId);
        } else if (f.count() >= MAX_FAILURES) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "two_factor_locked", null);
        }
    }

    private void fail(UUID userId) {
        Instant now = clock.instant();
        failures.merge(userId, new Failures(1, now), (old, one) ->
                now.isAfter(old.since().plus(FAILURE_WINDOW)) ? one : new Failures(old.count() + 1, old.since()));
    }

    private List<String> newBackupCodes(UUID userId) {
        jdbc.update("delete from two_factor_backup_codes where user_id = ?", userId);
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < BACKUP_CODES; i++) {
            StringBuilder code = new StringBuilder();
            for (int k = 0; k < 8; k++) {
                if (k == 4) code.append('-');
                code.append(BACKUP_ALPHABET.charAt(RANDOM.nextInt(BACKUP_ALPHABET.length())));
            }
            codes.add(code.toString());
            jdbc.update("insert into two_factor_backup_codes (user_id, code_hash) values (?, ?)",
                    userId, SecretBox.sha256(normalizeBackup(code.toString())));
        }
        return codes;
    }

    /** "ABCD-efgh", "abcd efgh" e "abcdefgh" sono lo stesso codice. */
    static String normalizeBackup(String code) {
        return code.toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
