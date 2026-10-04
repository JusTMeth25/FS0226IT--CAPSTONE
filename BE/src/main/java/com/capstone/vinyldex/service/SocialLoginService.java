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
 * Accesso con Google e con Apple (dal browser, dall'app Android e dall'app iOS).
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
    public static final String APPLE = "apple";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final String googleWebClientId;
    private final String googleIosClientId;
    private final String appleServiceId;
    private final String appleBundleId;
    private final boolean appleIos;
    private final String appleRedirectUrl;
    private IdTokenVerifier google = new IdTokenVerifier(Set.of("https://accounts.google.com", "accounts.google.com"),
            IdTokenVerifier.jwks("https://www.googleapis.com/oauth2/v3/certs"));
    private IdTokenVerifier apple = new IdTokenVerifier(Set.of("https://appleid.apple.com"),
            IdTokenVerifier.jwks("https://appleid.apple.com/auth/keys"));

    @Autowired
    public SocialLoginService(UserRepository userRepository, PasswordEncoder passwordEncoder, JdbcTemplate jdbc,
                              @Value("${vinyldex.auth.google.web-client-id:}") String googleWebClientId,
                              @Value("${vinyldex.auth.google.ios-client-id:}") String googleIosClientId,
                              @Value("${vinyldex.auth.apple.service-id:}") String appleServiceId,
                              @Value("${vinyldex.auth.apple.bundle-id:com.vinyldex.app}") String appleBundleId,
                              @Value("${vinyldex.auth.apple.ios-enabled:false}") boolean appleIos,
                              @Value("${vinyldex.auth.apple.redirect-url:}") String appleRedirectUrl) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.googleWebClientId = googleWebClientId.trim();
        this.googleIosClientId = googleIosClientId.trim();
        this.appleServiceId = appleServiceId.trim();
        this.appleBundleId = appleBundleId.trim();
        this.appleIos = appleIos;
        this.appleRedirectUrl = appleRedirectUrl.trim();
    }

    /** Per i test: verificatori con chiavi locali invece di quelle vere di Google e Apple. */
    void useVerifiers(IdTokenVerifier google, IdTokenVerifier apple) {
        this.google = google;
        this.apple = apple;
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
        if (!appleServiceId.isEmpty() || appleIos) {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("serviceId", appleServiceId.isEmpty() ? null : appleServiceId);
            a.put("redirectUrl", appleRedirectUrl.isEmpty() ? null : appleRedirectUrl);
            a.put("ios", appleIos);
            out.put(APPLE, a);
        }
        return out;
    }

    private List<String> audiences(String provider) {
        List<String> list = new ArrayList<>();
        if (GOOGLE.equals(provider)) {
            // Android e web danno token per il client web; iOS per il suo client.
            if (!googleWebClientId.isEmpty()) list.add(googleWebClientId);
            if (!googleIosClientId.isEmpty()) list.add(googleIosClientId);
        } else if (APPLE.equals(provider)) {
            // Dal browser il destinatario e' il Services ID, dall'app iOS il bundle id.
            if (!appleServiceId.isEmpty()) list.add(appleServiceId);
            if (appleIos && !appleBundleId.isEmpty()) list.add(appleBundleId);
        }
        return list;
    }

    /**
     * Account VinylDex per questo ID token: quello gia' collegato, quello con la stessa email
     * verificata (che viene collegato) oppure uno nuovo. {@code name} e' il nome che Apple manda
     * solo al primo accesso, usato per scegliere lo username.
     */
    public User authenticate(String provider, String idToken, String name) {
        List<String> aud = audiences(provider);
        if (aud.isEmpty()) throw ApiException.badRequest("provider_disabled");
        Claims claims = (GOOGLE.equals(provider) ? google : apple).verify(idToken, aud);
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
