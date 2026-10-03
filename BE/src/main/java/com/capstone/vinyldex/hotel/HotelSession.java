package com.capstone.vinyldex.hotel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.UUID;

/**
 * Una connessione WebSocket all'hotel.
 *
 * La sessione vera e' avvolta in ConcurrentWebSocketSessionDecorator: i messaggi partono sia
 * dal thread che riceve i comandi sia dal tick delle stanze, e una WebSocketSession semplice
 * non accetta invii contemporanei. Il decoratore li mette in coda e scarta la connessione se
 * il client resta indietro troppo a lungo, invece di bloccare tutta la stanza.
 */
public class HotelSession {

    private static final Logger log = LoggerFactory.getLogger(HotelSession.class);

    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int BUFFER_LIMIT_BYTES = 256 * 1024;

    private final WebSocketSession socket;
    private final ObjectMapper objectMapper;
    private final ChatFilter chatFilter = new ChatFilter();

    private volatile HotelUser user;
    /** Amministratore del sito: nella Disco anni 80 e' l'unico che cambia o spegne la musica. */
    private volatile boolean admin;
    private volatile UUID roomId;
    private volatile long lastActivity = System.currentTimeMillis();

    public HotelSession(WebSocketSession raw, ObjectMapper objectMapper) {
        this.socket = new ConcurrentWebSocketSessionDecorator(raw, SEND_TIME_LIMIT_MS, BUFFER_LIMIT_BYTES);
        this.objectMapper = objectMapper;
    }

    public String id() {
        return socket.getId();
    }

    public HotelUser user() {
        return user;
    }

    public void authenticate(HotelUser user) {
        this.user = user;
    }

    public void setAdmin(boolean admin) {
        this.admin = admin;
    }

    public boolean isAdmin() {
        return admin;
    }

    public boolean isAuthenticated() {
        return user != null;
    }

    public UUID roomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public ChatFilter chatFilter() {
        return chatFilter;
    }

    public void touch() {
        lastActivity = System.currentTimeMillis();
    }

    public long lastActivity() {
        return lastActivity;
    }

    public boolean isOpen() {
        return socket.isOpen();
    }

    /** Invia un messaggio JSON. Un errore di rete chiude la sessione invece di propagarsi. */
    public void send(Object message) {
        if (!socket.isOpen()) return;
        try {
            socket.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        } catch (IOException | RuntimeException ex) {
            log.debug("Invio fallito alla sessione {}: {}", id(), ex.getMessage());
            close(CloseStatus.SESSION_NOT_RELIABLE);
        }
    }

    public void close(CloseStatus status) {
        try {
            if (socket.isOpen()) socket.close(status);
        } catch (IOException ex) {
            log.debug("Chiusura della sessione {} fallita: {}", id(), ex.getMessage());
        }
    }
}
