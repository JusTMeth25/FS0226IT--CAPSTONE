package com.capstone.vinyldex.security;

import com.capstone.vinyldex.dto.request.AuthRequests;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthCookiesAndFilterTest {

    private static final String SECRET = "un-segreto-di-test-lungo-almeno-trentadue-byte-per-hs256";

    private final JwtService jwt = new JwtService(SECRET, "7d");
    private final UserRepository users = mock(UserRepository.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);
    private final UUID userId = UUID.randomUUID();
    private final String token = jwt.generateToken(userId, "lorenzo", "lorenzo@example.com");

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletResponse run(MockHttpServletRequest request) throws Exception {
        User user = new User();
        user.setUsername("lorenzo");
        user.setEmail("lorenzo@example.com");
        when(users.findById(any())).thenReturn(Optional.of(user));
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    @DisplayName("Il cookie di sessione e' HttpOnly, Secure, SameSite=Strict e dura quanto il token")
    void cookieFlags() {
        String cookie = new AuthCookies(jwt, true).issue(token);
        assertTrue(cookie.startsWith(AuthCookies.NAME + "="));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("Secure"));
        assertTrue(cookie.contains("SameSite=Strict"));
        assertTrue(cookie.contains("Max-Age=604800"));
        assertTrue(new AuthCookies(jwt, true).clear().contains("Max-Age=0"));
    }

    @Test
    @DisplayName("Una GET col solo cookie autentica l'utente")
    void cookieAuthenticates() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/profile");
        request.setCookies(new Cookie(AuthCookies.NAME, token));
        run(request);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    @DisplayName("Una POST col cookie ma senza X-VinylDex-Client viene fermata (CSRF)")
    void cookiePostNeedsHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/market/buy");
        request.setCookies(new Cookie(AuthCookies.NAME, token));
        MockHttpServletResponse response = run(request);
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("csrf_blocked"));

        SecurityContextHolder.clearContext();
        MockHttpServletRequest withHeader = new MockHttpServletRequest("POST", "/api/market/buy");
        withHeader.setCookies(new Cookie(AuthCookies.NAME, token));
        withHeader.addHeader(AuthCookies.CLIENT_HEADER, "web");
        assertEquals(200, run(withHeader).getStatus());
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    @DisplayName("L'app nativa col Bearer funziona come prima, anche in POST senza intestazioni in piu'")
    void bearerStillWorks() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/market/buy");
        request.addHeader("Authorization", "Bearer " + token);
        assertEquals(200, run(request).getStatus());
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    @DisplayName("Dall'handshake del WebSocket il token si legge dall'intestazione Cookie")
    void readsCookieHeader() {
        assertEquals("abc", AuthCookies.readHeader("x=1; " + AuthCookies.NAME + "=abc; y=2"));
        assertNull(AuthCookies.readHeader("x=1"));
        assertNull(AuthCookies.readHeader(null));
    }

    @Test
    @DisplayName("IP del client: l'ultimo di X-Forwarded-For (quello di Caddy), non il primo scritto dal client")
    void clientIpUsesLastHop() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.3");
        assertEquals("172.18.0.3", ClientIp.of(request));
        request.addHeader("X-Forwarded-For", "6.6.6.6, 203.0.113.7");
        assertEquals("203.0.113.7", ClientIp.of(request));
    }

    @Test
    @DisplayName("Regex dell'email: accetta le forme normali, rifiuta quelle rotte")
    void emailRegex() {
        Pattern email = Pattern.compile(AuthRequests.EMAIL_REGEX);
        for (String ok : new String[] {"a.b+c@dominio.it", "mario_rossi@mail.example.com", "x@y-z.io"}) {
            assertTrue(email.matcher(ok).matches(), ok);
        }
        for (String bad : new String[] {"a@b", "a b@c.it", "a@@c.it", "@c.it", "a@c.", "a@.it", "a@c.i", "a@c..it"}) {
            assertFalse(email.matcher(bad).matches(), bad);
        }
    }
}
