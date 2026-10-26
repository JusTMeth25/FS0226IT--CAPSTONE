package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.IdTokenVerifier;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Accesso con Google (dal browser, dall'app Android e dall'app iOS).
 *
 * L'app ottiene dal fornitore un ID token firmato; qui se ne verifica la firma e si cerca l'account
 * collegato a quell'identita'. Al primo accesso si collega l'account VinylDex con la stessa email
 * (solo se il fornitore garantisce che l'email e' dell'utente), altrimenti se ne crea uno nuovo.
 *
 * Senza client id configurati il fornitore e' spento e il suo pulsante non compare.
 */
@Service
public class SocialLoginService {

    public static final String GOOGLE = "google";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final String googleWebClientId;
    private final String googleIosClientId;
    private IdTokenVerifier google = new IdTokenVerifier(Set.of("https://accounts.google.com", "accounts.google.com"),
            IdTokenVerifier.jwks("https://www.googleapis.com/oauth2/v3/certs"));

    @Autowired
    public SocialLoginService(UserRepository userRepository, PasswordEncoder passwordEncoder, JdbcTemplate jdbc,
                              @Value("${vinyldex.auth.google.web-client-id:}") String googleWebClientId,
                              @Value("${vinyldex.auth.google.ios-client-id:}") String googleIosClientId) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.googleWebClientId = googleWebClientId.trim();
        this.googleIosClientId = googleIosClientId.trim();
    }

    /** Per i test: verificatore con chiavi locali invece di quelle vere di Google. */
    void useVerifier(IdTokenVerifier google) {
        this.google = google;
    }

    /** Cosa serve al frontend per mostrare i pulsanti; null = fornitore spento. Nessun segreto qui. */
    public Map<String, Object> providers() {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!googleWebClientId.isEmpty() || !googleIosClientId.isEmpty()) {
            Map<String, Object> g = new LinkedHashMap<>();
            g.put("webClientId", googleWebClientId.isEmpty() ? null : googleWebClientId);
            g.put("iosClientId", googleIosClientId.isEmpty() ? null : googleIosClientId);
            out.put(GOOGLE, g);
        }
        return out;
    }

    private List<String> audiences(String provider) {
        List<String> list = new ArrayList<>();
        if (GOOGLE.equals(provider)) {
            // Android e web danno token per il client web; iOS per il suo client.
            if (!googleWebClientId.isEmpty()) list.add(googleWebClientId);
            if (!googleIosClientId.isEmpty()) list.add(googleIosClientId);
        }
        return list;
    }

    /**
     * Account VinylDex per questo ID token: quello gia' collegato, quello con la stessa email
     * verificata (che viene collegato) oppure uno nuovo. {@code name}, se c'e', serve a
     * scegliere lo username.
     */
    public User authenticate(String provider, String idToken, String name) {
        List<String> aud = audiences(provider);
        if (aud.isEmpty()) throw ApiException.badRequest("provider_disabled");
        Claims claims = google.verify(idToken, aud);
        if (claims == null) throw ApiException.unauthorized("invalid_social_token");

        String subject = claims.getSubject();
        String email = Optional.ofNullable(claims.get("email", String.class)).map(e -> e.trim().toLowerCase(Locale.ROOT)).orElse(null);
        Object verifiedClaim = claims.get("email_verified");
        boolean verified = Boolean.TRUE.equals(verifiedClaim) || "true".equals(String.valueOf(verifiedClaim));

        List<UUID> linked = jdbc.queryForList("select user_id from user_identities where provider = ? and subject = ?",
                UUID.class, provider, subject);
        if (!linked.isEmpty()) {
            return userRepository.findById(linked.getFirst()).orElseThrow(() -> ApiException.unauthorized("invalid_social_token"));
        }
        if (email == null || !verified) throw ApiException.badRequest("social_email_missing");

        Optional<User> existing = userRepository.findByEmailIgnoreCase(email);
        User user;
        if (existing.isPresent()) {
            user = existing.get();
            if (user.isNpc()) throw ApiException.conflict("email_taken");
        } else {
            user = new User();
            user.setUsername(freeUsername(name, email));
            user.setEmail(email);
            // Nessuna password: si entra con il fornitore. L'hash casuale rispetta il vincolo NOT NULL
            // e non corrisponde a nessuna password digitabile.
            user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            userRepository.saveAndFlush(user);
        }
        jdbc.update("insert into user_identities (user_id, provider, subject, email) values (?, ?, ?, ?) on conflict do nothing",
                user.getId(), provider, subject, email);
        return user;
    }

    /** Username libero preso dal nome o dalla parte dell'email prima della chiocciola. */
    String freeUsername(String name, String email) {
        String base = clean(name);
        if (base.length() < 3) base = clean(email.substring(0, email.indexOf('@') < 0 ? email.length() : email.indexOf('@')));
        if (base.length() < 3) base = "collezionista";
        base = base.substring(0, Math.min(40, base.length()));
        String candidate = base;
        for (int i = 0; userRepository.existsByUsername(candidate); i++) {
            candidate = base + (i < 5 ? "_" + (i + 2) : "_" + ThreadLocalRandom.current().nextInt(1000, 99999));
        }
        return candidate;
    }

    private static String clean(String raw) {
        if (raw == null) return "";
        String ascii = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.replaceAll("\\s+", "_").replaceAll("[^A-Za-z0-9_.-]", "").replaceAll("^[._-]+|[._-]+$", "");
    }
}
