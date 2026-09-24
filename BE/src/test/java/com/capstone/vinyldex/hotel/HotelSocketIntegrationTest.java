package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Connessioni WebSocket vere contro il server avviato.
 *
 * Come VinylDexApplicationTests richiede il database: senza credenziali viene saltato.
 * Crea due utenti temporanei e li cancella alla fine.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class HotelSocketIntegrationTest {

    private static final UUID LOBBY = UUID.fromString("00000000-0000-0000-0000-00000000a001");

    @LocalServerPort
    private int port;

    @Value("${vinyldex.cors.allowed-origins}")
    private String allowedOrigins;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    private final List<UUID> createdUsers = new ArrayList<>();

    private record Client(WebSocketSession session, BlockingQueue<JsonNode> inbox, CompletableFuture<CloseStatus> closed) {
        JsonNode next(String type) throws InterruptedException {
            while (true) {
                JsonNode message = inbox.poll(5, TimeUnit.SECONDS);
                assertNotNull(message, "nessun messaggio " + type + " ricevuto");
                if (type.equals(message.path("type").asString())) return message;
            }
        }
    }

    @AfterEach
    void cleanUp() {
        createdUsers.forEach(userRepository::deleteById);
    }

    private User tempUser() {
        String name = "ws_" + UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setUsername(name);
        user.setEmail(name + "@test.local");
        user.setPasswordHash("x");
        user = userRepository.save(user);
        createdUsers.add(user.getId());
        return user;
    }

    private Client connect() throws Exception {
        BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
        CompletableFuture<CloseStatus> closed = new CompletableFuture<>();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.setOrigin(allowedOrigins.split(",")[0].trim());

        WebSocketSession session = new StandardWebSocketClient().execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession s, TextMessage message) {
                inbox.add(objectMapper.readTree(message.getPayload()));
            }

            @Override
            public void afterConnectionClosed(WebSocketSession s, CloseStatus status) {
                closed.complete(status);
            }
        }, headers, URI.create("ws://localhost:" + port + "/ws/hotel")).get(5, TimeUnit.SECONDS);
        return new Client(session, inbox, closed);
    }

    private void send(Client client, String json) throws Exception {
        client.session().sendMessage(new TextMessage(json));
    }

    private Client loggedIn(User user) throws Exception {
        Client client = connect();
        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getEmail());
        send(client, "{\"type\":\"auth\",\"token\":\"" + token + "\"}");
        assertEquals(user.getUsername(), client.next("hello").path("user").path("username").asString());
        return client;
    }

    @Test
    @DisplayName("Un comando prima dell'autenticazione chiude la connessione")
    void commandWithoutAuthCloses() throws Exception {
        Client client = connect();
        send(client, "{\"type\":\"join\",\"roomId\":\"" + LOBBY + "\"}");

        assertEquals(HotelSocketHandler.AUTH_FAILED.getCode(), client.closed().get(5, TimeUnit.SECONDS).getCode());
    }

    @Test
    @DisplayName("Due giocatori nella Lobby: ognuno vede entrare e camminare l'altro")
    void twoPlayersSeeEachOther() throws Exception {
        User anna = tempUser();
        User bruno = tempUser();
        Client annaClient = loggedIn(anna);
        Client brunoClient = loggedIn(bruno);

        send(annaClient, "{\"type\":\"join\",\"roomId\":\"" + LOBBY + "\"}");
        annaClient.next("room_state");
        send(brunoClient, "{\"type\":\"join\",\"roomId\":\"" + LOBBY + "\"}");
        JsonNode state = brunoClient.next("room_state");
        assertEquals("VinylDex Lobby", state.path("room").path("name").asString());

        assertEquals(bruno.getUsername(), annaClient.next("user_joined").path("user").path("username").asString());

        send(brunoClient, "{\"type\":\"move\",\"x\":8,\"y\":8}");
        JsonNode path = annaClient.next("user_path");
        assertEquals(bruno.getId().toString(), path.path("id").asString());
        JsonNode last = path.path("path").get(path.path("path").size() - 1);
        assertEquals(8, last.get(0).asInt());
        assertEquals(8, last.get(1).asInt());

        send(brunoClient, "{\"type\":\"chat\",\"text\":\"ciao anna\"}");
        assertEquals("ciao anna", annaClient.next("chat").path("text").asString());

        annaClient.session().close();
        brunoClient.session().close();
    }
}
