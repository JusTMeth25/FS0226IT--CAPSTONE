package com.capstone.vinyldex.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

/**
 * Emette e verifica i token JWT.
 *
 * Il payload resta quello che emetteva il backend Node (sub, username, email) e la firma
 * usa lo stesso JWT_SECRET: i token gia' in mano agli utenti continuano a funzionare
 * dopo il passaggio a Spring.
 *
 * Il token porta solo l'identita'. Gold, livello e ruolo si rileggono sempre dal database
 * a ogni richiesta, perche' possono cambiare dopo l'emissione del token.
 */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final Duration expiration;

    public JwtService(@Value("${vinyldex.jwt.secret}") String secret,
                      @Value("${vinyldex.jwt.expiration}") String expiration) {
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET troppo corto: HS256 richiede almeno 32 byte, trovati " + secretBytes.length);
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
        this.expiration = parseDuration(expiration);
    }

    /** Accetta i formati della libreria jsonwebtoken: "7d", "24h", "30m", "3600s" o secondi puri. */
    private static Duration parseDuration(String raw) {
        String value = raw.trim().replace("\"", "");
        if (value.isEmpty()) {
            return Duration.ofDays(7);
        }
        char unit = value.charAt(value.length() - 1);
        if (Character.isDigit(unit)) {
            return Duration.ofSeconds(Long.parseLong(value));
        }
        long amount = Long.parseLong(value.substring(0, value.length() - 1));
        return switch (Character.toLowerCase(unit)) {
            case 'd' -> Duration.ofDays(amount);
            case 'h' -> Duration.ofHours(amount);
            case 'm' -> Duration.ofMinutes(amount);
            case 's' -> Duration.ofSeconds(amount);
            default -> throw new IllegalArgumentException("Durata JWT non riconosciuta: " + raw);
        };
    }

    public String generateToken(UUID userId, String username, String email) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId.toString())
                .claims(Map.of("username", username, "email", email))
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiration.toMillis()))
                .signWith(key)
                .compact();
    }

    /** Id utente contenuto nel token, oppure null se il token e' scaduto, manomesso o malformato. */
    public UUID extractUserId(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return UUID.fromString(claims.getSubject());
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Token JWT rifiutato: {}", ex.getMessage());
            return null;
        }
    }

    public long getExpirationSeconds() {
        return expiration.toSeconds();
    }
}
