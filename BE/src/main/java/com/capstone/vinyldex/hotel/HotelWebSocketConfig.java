package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.security.AuthCookies;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Arrays;
import java.util.Map;

/**
 * Registra l'endpoint /ws/hotel.
 *
 * Le origini ammesse sono le stesse del CORS delle API (vinyldex.cors.allowed-origins): una
 * pagina di un altro sito non deve poter aprire una connessione all'hotel con il token di chi
 * la sta visitando.
 *
 * La dimensione massima dei messaggi la controlla HotelSocketHandler (2 KB). Non si configura
 * il container WebSocket con un bean dedicato: nei test con server simulato quel container non
 * esiste e l'avvio del contesto fallirebbe.
 */
@Configuration
@EnableWebSocket
public class HotelWebSocketConfig implements WebSocketConfigurer {

    private final HotelSocketHandler handler;
    private final String[] allowedOrigins;

    public HotelWebSocketConfig(HotelSocketHandler handler,
                                @Value("${vinyldex.cors.allowed-origins}") String allowedOrigins) {
        this.handler = handler;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(",")).map(String::trim).toArray(String[]::new);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/hotel").setAllowedOrigins(allowedOrigins)
                .addInterceptors(new SessionCookieInterceptor());
    }

    /**
     * Il sito non ha piu' il token in JavaScript: sta nel cookie HttpOnly, che il browser manda
     * con l'handshake. Lo si copia negli attributi della connessione per il messaggio "auth".
     */
    static final class SessionCookieInterceptor implements HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            String token = AuthCookies.readHeader(String.join(";", request.getHeaders().getOrEmpty(HttpHeaders.COOKIE)));
            if (token != null) attributes.put(AuthCookies.NAME, token);
            return true;
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Exception exception) {
        }
    }
}
