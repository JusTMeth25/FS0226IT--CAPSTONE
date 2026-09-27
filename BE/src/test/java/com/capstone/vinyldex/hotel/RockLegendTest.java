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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Le leggende del Locale Rock: carta sopra la testa e sfida alla gara rock contro di loro. */
class RockLegendTest {

    /** Palco 18x6 con la porta in (0,1): ci stanno la band e una pedana della gara. */
    private static final String LAYOUT = "x".repeat(18) + "\n" + "0".repeat(18) + ("\nx" + "0".repeat(17)).repeat(4);

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final List<JsonNode> received = new ArrayList<>();
    private final UUID pedal = UUID.randomUUID();
    private RoomInstance room;

    @BeforeEach
    void setUp() {
        room = new RoomInstance(new RoomData(NpcRoster.ROCK_CLUB, "Locale Rock", null, null, null, LAYOUT,
                0, 1, 2, "rockclub", "rockclub", "open", 30, true),
                List.of(new RoomItemView(pedal, null, "guitar_duel", 3, 4, 0, 0, null)));
    }

    private UUID join(String name) throws Exception {
        WebSocketSession raw = mock(WebSocketSession.class);
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn(name);
        doAnswer(inv -> {
            received.add(mapper.readTree(((TextMessage) inv.getArgument(0)).getPayload()));
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

    /** Si cammina fino alla pedana: la gara parte all'arrivo. */
    private void play(UUID user) {
        assertNull(room.useItem(user, pedal));
        for (int i = 0; i < 12 && last("minigame_start") == null; i++) room.tick();
        assertNotNull(last("minigame_start"));
    }

    private JsonNode occupant(String name) {
        for (JsonNode user : last("room_state").path("users")) {
            if (name.equals(user.path("username").asString())) return user;
        }
        return null;
    }

    @Test
    @DisplayName("La band del Locale Rock sono le leggende, con la loro carta leggendaria")
    void legendsCarryTheirCard() throws Exception {
        join("anna");
        JsonNode thunder = occupant("Thunder Chord");
        assertNotNull(thunder);
        assertEquals("riff-001", thunder.path("bestCard").path("id").asString());
        assertEquals("legendary", thunder.path("topCards").get(0).path("rarity").asString());
        assertEquals("guitar", thunder.path("npc").path("legend").path("instrument").asString());
        assertTrue(thunder.path("look").asString().endsWith(".k5"));
    }

    @Test
    @DisplayName("Sfida a una leggenda: accetta, e il verdetto va a tutta la stanza")
    void challengeLegend() throws Exception {
        UUID anna = join("anna");
        play(anna);
        room.rockChallenge(anna, NpcRoster.LEGEND_KEYS.indexOf("thunder_chord"));
        room.backdateGame(anna, 60_000);
        assertNull(room.minigameResult(anna, 1000).error());
        JsonNode duel = last("rock_duel");
        assertNotNull(duel);
        assertEquals("anna", duel.path("winner").asString());
        assertEquals("Thunder Chord", duel.path("loser").asString());
        assertEquals("Thunder Chord", duel.path("legend").asString());
    }

    @Test
    @DisplayName("Con un voto basso vince la leggenda")
    void legendWins() throws Exception {
        UUID anna = join("anna");
        play(anna);
        room.rockChallenge(anna, NpcRoster.LEGEND_KEYS.indexOf("royal_echo"));
        room.backdateGame(anna, 60_000);
        room.minigameResult(anna, 100);
        assertEquals("Royal Echo", last("rock_duel").path("winner").asString());
    }
}
