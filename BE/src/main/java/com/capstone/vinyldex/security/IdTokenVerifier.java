package com.capstone.vinyldex.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.Key;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * Verifica gli ID token (JWT firmati RS256) che Google e Apple danno all'app dopo il login:
 * firma con le chiavi pubbliche del fornitore, emittente, destinatario (i nostri client id) e
 * scadenza. Solo dopo si puo' credere a "sub" ed "email".
 */
public class IdTokenVerifier {

    private final Set<String> issuers;
    private final Function<String, Key> keys;

    public IdTokenVerifier(Set<String> issuers, Function<String, Key> keys) {
        this.issuers = issuers;
        this.keys = keys;
    }

    /** Claims del token, oppure null se non e' valido o non e' destinato a uno dei client indicati. */
    public Claims verify(String idToken, Collection<String> audiences) {
        if (idToken == null || idToken.isBlank() || audiences.isEmpty()) return null;
        try {
            Claims claims = Jwts.parser()
                    .keyLocator(new LocatorAdapter<Key>() {
                        @Override
                        protected Key locate(JwsHeader header) {
                            Key key = keys.apply(header.getKeyId());
                            if (key == null) throw new JwtException("Chiave sconosciuta");
                            return key;
                        }
                    })
                    .clockSkewSeconds(60)
                    .build()
                    .parseSignedClaims(idToken)
                    .getPayload();
            if (!issuers.contains(claims.getIssuer())) return null;
            Set<String> aud = claims.getAudience();
            if (aud == null || aud.stream().noneMatch(audiences::contains)) return null;
            if (claims.getSubject() == null || claims.getSubject().isBlank()) return null;
            return claims;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Chiavi pubbliche lette dall'indirizzo JWKS del fornitore e tenute in memoria per qualche ora.
     * Una chiave sconosciuta (il fornitore le ruota) fa rileggere l'elenco, al massimo una volta al minuto.
     */
    public static Function<String, Key> jwks(String url) {
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        return new Function<>() {
            private Map<String, Key> cache = Map.of();
            private long loadedAt;

            @Override
            public synchronized Key apply(String kid) {
                long now = System.currentTimeMillis();
                boolean stale = now - loadedAt > Duration.ofHours(6).toMillis();
                boolean unknown = !cache.containsKey(kid) && now - loadedAt > 60_000;
                if (stale || unknown) {
                    try {
                        String json = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build(),
                                HttpResponse.BodyHandlers.ofString()).body();
                        JwkSet set = Jwks.setParser().build().parse(json);
                        Map<String, Key> next = new HashMap<>();
                        for (Jwk<?> jwk : set) next.put(jwk.getId(), jwk.toKey());
                        cache = next;
                        loadedAt = now;
                    } catch (Exception e) {
                        if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                        // Fornitore irraggiungibile: restano le chiavi di prima.
                    }
                }
                return cache.get(kid);
            }
        };
    }
}
