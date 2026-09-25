package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Minigiochi sui mobili: chi puo' giocare, dove si mette l'avatar, quali punteggi valgono. */
class RoomMinigameTest {

    /** Stanza 6x6 con la porta in (0,1). */
    private static final String LAYOUT = "xxxxxx\n000000\nx00000\nx00000\nx00000\nx00000";

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final List<JsonNode> received = new ArrayList<>();
    private RoomInstance room;
    private final UUID bag = UUID.randomUUID();
    private final UUID treadmill = UUID.randomUUID();
    private final UUID bench = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        room = new RoomInstance(new RoomData(UUID.randomUUID(), "Palestra", null, null, null, LAYOUT,
                0, 1, 2, "rubber", "mirror", "open", 10, true),
                List.of(new RoomItemView(bag, null, "punching_bag", 2, 1, 0, 0, null),
                        new RoomItemView(treadmill, null, "treadmill", 4, 1, 0, 0, null),
                        new RoomItemView(bench, null, "weight_bench", 2, 4, 0, 0, null)));
    }

    private UUID join(String name) throws Exception {
        WebSocketSession raw = mock(WebSocketSession.class);
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn(name);
        doAnswer(inv -> {
            JsonNode node = mapper.readTree(((TextMessage) inv.getArgument(0)).getPayload());
            received.add(node);
            return null;
        }).when(raw).sendMessage(any());
        HotelSession session = new HotelSession(raw, mapper);
        UUID id = UUID.randomUUID();
        session.authenticate(new HotelUser(id, name, HotelLook.DEFAULT, 1));
        room.join(session);
        return id;
    }

    private JsonNode last(String type) {
        return received.reversed().stream().filter(n -> type.equals(n.path("type").asString())).findFirst().orElse(null);
    }

    private void ticks(int n) {
        for (int i = 0; i < n; i++) room.tick();
    }

    @Test
    @DisplayName("Si cammina fino al sacco e la partita parte all'arrivo; il punteggio troppo presto non vale")
    void startsOnArrival() throws Exception {
        UUID anna = join("anna");
        assertNull(room.useItem(anna, bag));
        assertNull(last("minigame_start"), "prima bisogna arrivare");
        ticks(6);
        JsonNode start = last("minigame_start");
        assertEquals("box", start.path("game").asString());
        assertEquals("box", last("minigame").path("game").asString());

        assertEquals("minigame_too_fast", room.minigameResult(anna, 50));
        assertTrue(last("minigame").path("game").isNull(), "la partita si chiude comunque");
        assertEquals("minigame_not_running", room.minigameResult(anna, 50));
    }

    @Test
    @DisplayName("Un mobile alla volta: chi arriva secondo trova il sacco occupato")
    void oneAtATime() throws Exception {
        UUID anna = join("anna");
        UUID bruno = join("bruno");
        room.useItem(anna, bag);
        ticks(6);
        assertEquals("item_busy", room.useItem(bruno, bag));
        room.minigameQuit(anna);
        assertNull(room.useItem(bruno, bag));
    }

    @Test
    @DisplayName("Sul tapis roulant si sale sul nastro e a fine partita si scende")
    void treadmillBelt() throws Exception {
        UUID anna = join("anna");
        room.useItem(anna, treadmill);
        ticks(8);
        assertEquals("run", last("minigame_start").path("game").asString());
        JsonNode onBelt = last("user_path").path("path");
        JsonNode step = onBelt.get(onBelt.size() - 1);
        assertEquals(4, step.get(0).asInt());
        assertEquals(2, step.get(1).asInt(), "sul nastro, davanti alla console");

        room.minigameQuit(anna);
        JsonNode off = last("user_path").path("path");
        assertFalse(off.get(off.size() - 1).get(0).asInt() == 4 && off.get(off.size() - 1).get(1).asInt() == 2, "sceso dal nastro");
    }

    @Test
    @DisplayName("Sulla panca ci si siede e il muoversi chiude la partita")
    void benchSitsAndMovingStops() throws Exception {
        UUID anna = join("anna");
        room.useItem(anna, bench);
        ticks(8);
        assertEquals("bench", last("minigame_start").path("game").asString());
        assertEquals("sit", last("user_status").path("status").asString());
        room.move(anna, 5, 5);
        assertTrue(last("minigame").path("game").isNull());
    }

    @Test
    @DisplayName("Il punteggio si taglia al massimo del gioco e vale solo dopo il tempo minimo")
    void scoreValidation() {
        Minigames.Game box = Minigames.forFurni("punching_bag").orElseThrow();
        assertEquals(-1, Minigames.validScore(box, 30, 2_000));
        assertEquals(30, Minigames.validScore(box, 30, 20_000));
        assertEquals(box.maxScore(), Minigames.validScore(box, 9_999, 20_000));
        assertEquals(0, Minigames.validScore(box, -5, 20_000));
        assertTrue(Minigames.forFurni("sofa_vinyl").isEmpty());
    }
}
