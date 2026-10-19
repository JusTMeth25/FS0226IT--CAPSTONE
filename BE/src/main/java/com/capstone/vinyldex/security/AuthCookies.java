package com.capstone.vinyldex.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Cookie di sessione del sito: il JWT viaggia in un cookie HttpOnly e non sta piu' in
 * localStorage, cosi' uno script estraneo nella pagina non lo puo' leggere.
 *
 * - HttpOnly: JavaScript non lo vede; Secure: solo su HTTPS (spento in locale con
 *   vinyldex.auth.cookie-secure=false se serve); SameSite=Strict: un altro sito non lo fa partire.
 * - L'app nativa (Capacitor) carica le pagine da capacitor://localhost: per lei sarebbe un cookie
 *   di terze parti e iOS lo blocca. Si presenta con l'header {@link #CLIENT_HEADER} = "native" e
 *   riceve il token nel corpo della risposta, da mandare come Bearer.
 * - Le richieste che modificano dati autenticate col cookie devono avere {@link #CLIENT_HEADER}:
 *   un altro sito non puo' aggiungerlo senza il permesso CORS (vedi JwtAuthenticationFilter).
 */
@Component
public class AuthCookies {

    public static final String NAME = "vinyldex_session";
    public static final String CLIENT_HEADER = "X-VinylDex-Client";

    private final Duration maxAge;
    private final boolean secure;

    public AuthCookies(JwtService jwtService,
                       @Value("${vinyldex.auth.cookie-secure:true}") boolean secure) {
        this.maxAge = jwtService.expiration();
        this.secure = secure;
    }

    /** Valore di Set-Cookie per il token appena emesso. */
    public String issue(String token) {
        return build(token, maxAge);
    }

    /** Valore di Set-Cookie che cancella la sessione (logout). */
    public String clear() {
        return build("", Duration.ZERO);
    }

    private String build(String value, Duration age) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(age)
                .build()
                .toString();
    }

    /** L'app nativa vuole il token nel corpo della risposta (niente cookie per lei). */
    public static boolean isNative(HttpServletRequest request) {
        return "native".equalsIgnoreCase(request.getHeader(CLIENT_HEADER));
    }

    /** Token del cookie di sessione, se c'e'. */
    public static String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (NAME.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }

    /** Token dall'intestazione Cookie grezza (handshake del WebSocket). */
    public static String readHeader(String cookieHeader) {
        if (cookieHeader == null) return null;
        for (String part : cookieHeader.split(";")) {
            String item = part.trim();
            if (item.startsWith(NAME + "=")) {
                String value = item.substring(NAME.length() + 1);
                return value.isBlank() ? null : value;
            }
        }
        return null;
    }
}
