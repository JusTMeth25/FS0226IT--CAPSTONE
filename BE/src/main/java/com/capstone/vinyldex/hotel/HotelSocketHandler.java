package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Punto d'ingresso WebSocket dell'hotel: /ws/hotel.
 *
 * Protocollo: messaggi JSON con un campo "type". Il primo deve essere
 * {"type":"auth","token":"<jwt>"}; il token viaggia nel messaggio e non nell'URL, cosi' non
 * finisce nei log di accesso. Chi non si autentica entro 5 secondi viene disconnesso.
 *
 * Comandi accettati dopo l'autenticazione:
 *   join {roomId} · move {x,y} · chat {text} · shout {text} · whisper {to,text}
 *   typing {on} · emote {emote} · status {status} · refresh_profile · ping
 */
@Component
public class HotelSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(HotelSocketHandler.class);

    private static final long AUTH_TIMEOUT_MILLIS = 5_000;
    static final int MAX_MESSAGE_BYTES = 2_048;

    public static final CloseStatus AUTH_FAILED = new CloseStatus(4003, "auth_failed");
    public static final CloseStatus BANNED = new CloseStatus(4004, "banned");

    private final ObjectMapper objectMapper;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RoomRegistry registry;
    private final RoomService roomService;
    private final Map<String, HotelSession> sessions = new ConcurrentHashMap<>();

    public HotelSocketHandler(ObjectMapper objectMapper, JwtService jwtService, UserRepository userRepository,
                              RoomRegistry registry, RoomService roomService) {
        this.objectMapper = objectMapper;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.registry = registry;
        this.roomService = roomService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession raw) {
        HotelSession session = new HotelSession(raw, objectMapper);
        sessions.put(raw.getId(), session);
        registry.schedule(() -> {
            if (!session.isAuthenticated()) session.close(AUTH_FAILED);
        }, AUTH_TIMEOUT_MILLIS);
    }

    @Override
    protected void handleTextMessage(WebSocketSession raw, TextMessage message) {
        HotelSession session = sessions.get(raw.getId());
        if (session == null) return;

        if (message.getPayloadLength() > MAX_MESSAGE_BYTES) {
            session.close(CloseStatus.TOO_BIG_TO_PROCESS);
            return;
        }

        JsonNode node;
        try {
            node = objectMapper.readTree(message.getPayload());
        } catch (JacksonException ex) {
            session.send(error("bad_message"));
            return;
        }
        String type = text(node, "type");

        if (!session.isAuthenticated()) {
            if ("auth".equals(type)) authenticate(session, text(node, "token"));
            else session.close(AUTH_FAILED);
            return;
        }

        session.touch();
        try {
            dispatch(session, type, node);
        } catch (RuntimeException ex) {
            log.warn("Comando hotel {} fallito per {}: {}", type, session.user().username(), ex.getMessage());
            session.send(error("server_error"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession raw, CloseStatus status) {
        HotelSession session = sessions.remove(raw.getId());
        if (session != null) registry.unregister(session);
    }

    // ------------------------------------------------------------------ comandi

    private void authenticate(HotelSession session, String token) {
        UUID userId = token == null ? null : jwtService.extractUserId(token);
        Optional<User> user = userId == null ? Optional.empty() : userRepository.findById(userId);
        if (user.isEmpty()) {
            session.close(AUTH_FAILED);
            return;
        }
        if (user.get().isBanned()) {
            session.send(error("banned"));
            session.close(BANNED);
            return;
        }

        HotelUser hotelUser = HotelUser.from(user.get());
        session.authenticate(hotelUser);
        registry.register(session);
        session.send(Map.of("type", "hello", "user", hotelUser));
    }

    private void dispatch(HotelSession session, String type, JsonNode node) {
        UUID userId = session.user().id();
        RoomInstance room = registry.get(session.roomId());

        switch (type == null ? "" : type) {
            case "ping" -> session.send(Map.of("type", "pong"));
            case "join" -> join(session, text(node, "roomId"));
            case "leave" -> registry.leaveRoom(session);
            case "move" -> {
                if (room != null) room.move(userId, integer(node, "x"), integer(node, "y"));
            }
            case "chat", "shout" -> {
                if (room != null) chat(session, room, type, text(node, "text"));
            }
            case "whisper" -> {
                if (room != null) whisper(session, room, text(node, "to"), text(node, "text"));
            }
            case "typing" -> {
                if (room != null) room.typing(userId, node.path("on").asBoolean(false));
            }
            case "emote" -> {
                if (room != null) room.emote(userId, text(node, "emote"));
            }
            case "status" -> {
                if (room != null) room.setStatus(userId, text(node, "status"));
            }
            case "refresh_profile" -> refreshProfile(session, room);
            default -> session.send(error("unknown_command"));
        }
    }

    /** Rilegge aspetto e livello dal database, dopo un salvataggio dal guardaroba. */
    private void refreshProfile(HotelSession session, RoomInstance room) {
        userRepository.findById(session.user().id()).ifPresent(user -> {
            HotelUser updated = HotelUser.from(user);
            session.authenticate(updated);
            session.send(Map.of("type", "hello", "user", updated));
            if (room != null) room.updateUser(updated);
        });
    }

    private void join(HotelSession session, String rawRoomId) {
        UUID roomId;
        try {
            roomId = UUID.fromString(rawRoomId);
        } catch (IllegalArgumentException | NullPointerException ex) {
            session.send(error("room_not_found"));
            return;
        }

        Optional<RoomData> data = roomService.load(roomId);
        if (data.isEmpty()) {
            session.send(error("room_not_found"));
            return;
        }

        RoomInstance.JoinResult result = registry.join(session, data.get());
        switch (result) {
            case FULL -> session.send(error("room_full"));
            case CLOSED -> session.send(error("room_closed"));
            case OK -> { }
        }
    }

    private void chat(HotelSession session, RoomInstance room, String style, String text) {
        ChatFilter.Result result = session.chatFilter().check(text);
        switch (result.verdict()) {
            case OK -> room.chat(session.user().id(), result.text(), style);
            case FLOOD, MUTED -> session.send(error("chat_muted"));
            case EMPTY -> { }
        }
    }

    private void whisper(HotelSession session, RoomInstance room, String to, String text) {
        ChatFilter.Result result = session.chatFilter().check(text);
        if (result.verdict() == ChatFilter.Verdict.FLOOD || result.verdict() == ChatFilter.Verdict.MUTED) {
            session.send(error("chat_muted"));
            return;
        }
        if (result.verdict() != ChatFilter.Verdict.OK || to == null) return;
        if (!room.whisper(session.user().id(), to, result.text())) session.send(error("user_not_here"));
    }

    // ------------------------------------------------------------------ utilita'

    private static Map<String, Object> error(String code) {
        return Map.of("type", "error", "code", code);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private static int integer(JsonNode node, String field) {
        return node.path(field).asInt(-1);
    }
}
