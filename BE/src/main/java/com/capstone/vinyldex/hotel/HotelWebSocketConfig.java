package com.capstone.vinyldex.hotel;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;

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
        registry.addHandler(handler, "/ws/hotel").setAllowedOrigins(allowedOrigins);
    }
}
