package com.capstone.vinyldex.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class IdTokenVerifierTest {

    private static final String ISSUER = "https://accounts.google.com";
    private static final String CLIENT = "web-client.apps.googleusercontent.com";

    private final KeyPair google = Jwts.SIG.RS256.keyPair().build();
    private final KeyPair attacker = Jwts.SIG.RS256.keyPair().build();
    private final IdTokenVerifier verifier = new IdTokenVerifier(Set.of(ISSUER),
            kid -> "k1".equals(kid) ? google.getPublic() : null);

    private String token(KeyPair keys, String issuer, String audience, long expiresInSeconds) {
        long now = System.currentTimeMillis();
        return Jwts.builder().header().keyId("k1").and()
                .subject("1234567890").issuer(issuer).audience().add(audience).and()
                .claim("email", "Io@Example.com").claim("email_verified", true)
                .issuedAt(new Date(now)).expiration(new Date(now + expiresInSeconds * 1000))
                .signWith(keys.getPrivate()).compact();
    }

    @Test
    @DisplayName("Un ID token firmato dal fornitore per il nostro client e' valido")
    void accepts() {
        Claims claims = verifier.verify(token(google, ISSUER, CLIENT, 600), List.of(CLIENT));
        assertNotNull(claims);
        assertEquals("1234567890", claims.getSubject());
    }

    @Test
    @DisplayName("Rifiutati: firma di un altro, client diverso, emittente diverso, scaduto, spazzatura")
    void rejects() {
        assertNull(verifier.verify(token(attacker, ISSUER, CLIENT, 600), List.of(CLIENT)));
        assertNull(verifier.verify(token(google, ISSUER, "client-di-un-altro-sito", 600), List.of(CLIENT)));
        assertNull(verifier.verify(token(google, "https://evil.example", CLIENT, 600), List.of(CLIENT)));
        assertNull(verifier.verify(token(google, ISSUER, CLIENT, -3600), List.of(CLIENT)));
        assertNull(verifier.verify("non.un.token", List.of(CLIENT)));
        assertNull(verifier.verify(token(google, ISSUER, CLIENT, 600), List.of()));
    }

    @Test
    @DisplayName("Il token di attesa del secondo passaggio non vale come token di accesso")
    void challengeIsNotAccess() {
        JwtService jwt = new JwtService("un-segreto-di-test-lungo-almeno-trentadue-byte-per-hs256", "7d");
        UUID id = UUID.randomUUID();
        String challenge = jwt.generateChallenge(id);
        assertNull(jwt.extractUserId(challenge));
        assertEquals(id, jwt.extractChallengeUserId(challenge));
        assertNull(jwt.extractChallengeUserId(jwt.generateToken(id, "io", "io@example.com")));
    }
}
