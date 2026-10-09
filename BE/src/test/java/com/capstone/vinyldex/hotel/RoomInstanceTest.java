package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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

class RoomInstanceTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private RoomInstance room;

    private static final String LAYOUT = """
            x0000
            00000
            x0000""";

    /** Sessione finta che registra tutto quello che il server le manda. */
    private record Client(HotelSession session, List<JsonNode> received, UUID id) {
        List<String> types() {
            return received.stream().map(n -> n.path("type").asString()).toList();
        }

        JsonNode last(String type) {
            return received.reversed().stream().filter(n -> type.equals(n.path("type").asString())).findFirst().orElseThrow();
        }
    }

    private Client client(String name) throws Exception {
        WebSocketSession raw = mock(WebSocketSession.class);
        List<JsonNode> received = new ArrayList<>();
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn(name);
        doAnswer(inv -> {
            WebSocketMessage<?> message = inv.getArgument(0);
            received.add(mapper.readTree(((TextMessage) message).getPayload()));
            return null;
        }).when(raw).sendMessage(any());

        HotelSession session = new HotelSession(raw, mapper);
        UUID id = UUID.randomUUID();
        session.authenticate(new HotelUser(id, name, HotelLook.DEFAULT, 1));
        return new Client(session, received, id);
    }

    @BeforeEach
    void setUp() {
        room = new RoomInstance(new RoomData(UUID.randomUUID(), "Test", null, null, null, LAYOUT,
                0, 1, 2, "neon", "neon", "open", 2, true));
    }

    private static RoomInstance styled(String floor, String wall) {
        return new RoomInstance(new RoomData(UUID.randomUUID(), "Stile", null, null, null, LAYOUT,
                0, 1, 2, floor, wall, "open", 2, true));
    }

    @Test
    @DisplayName("Veicoli solo all'aperto: non a Wall Street, nei palazzetti o nei locali")
    void ridesOnlyOutdoors() {
        assertTrue(styled("wooddeck", "skyline").rideable(), "terrazza sul tetto");
        assertTrue(styled("city", "street").rideable(), "quartiere");
        assertTrue(styled("grass", "hedge").rideable(), "giardino");
        assertFalse(styled("marble", "skyline").rideable(), "Wall Street");
        assertFalse(styled("parquet", "skyline").outdoor(), "piano dirigenti");
        assertFalse(styled("ice", "stadium").outdoor(), "palaghiaccio");
        assertTrue(styled("pitch", "stadium").outdoor(), "stadio");
        assertFalse(styled("pitch", "stadium").rideable(), "in campo si va a piedi");
        assertFalse(styled("neon", "neon").rideable());
    }

    @Test
    @DisplayName("Chi entra riceve lo stato della stanza, gli altri vengono avvisati")
    void joinBroadcasts() throws Exception {
        Client anna = client("anna");
        Client bruno = client("bruno");

        room.join(anna.session());
        room.join(bruno.session());

        assertEquals("room_state", anna.received().getFirst().path("type").asString());
        assertEquals(2, bruno.last("room_state").path("users").size());
        assertEquals("bruno", anna.last("user_joined").path("user").path("username").asString());
        assertEquals(1, bruno.last("room_state").path("users").get(1).path("y").asInt(), "si entra dalla porta");
    }

    @Test
    @DisplayName("Il movimento e' deciso dal server e avanza di una casella per tick")
    void movementFollowsTicks() throws Exception {
        Client anna = client("anna");
        room.join(anna.session());

        room.move(anna.id(), 3, 1);
        JsonNode path = anna.last("user_path").path("path");
        assertEquals(3, path.size());

        room.tick();
        room.tick();
        Client bruno = client("bruno");
        room.join(bruno.session());
        JsonNode annaMidway = bruno.last("room_state").path("users").get(0);
        assertEquals(2, annaMidway.path("x").asInt(), "dopo due tick e' a meta' strada");
        assertEquals(1, annaMidway.path("path").size(), "il nuovo arrivato riceve il passo che manca");

        room.tick();
        Client carla = client("carla");
        room.move(bruno.id(), 4, 2);
        // La stanza ha posto per due: carla resta fuori, ma anna e' ormai arrivata.
        assertEquals(RoomInstance.JoinResult.FULL, room.join(carla.session()));
    }

    @Test
    @DisplayName("Sigaretta in mano ed effetto della canna si portano nella stanza dopo, e li' si fuma")
    void handItemFollowsAcrossRooms() throws Exception {
        Client anna = client("anna");
        room.join(anna.session());
        room.giveHandItem(anna.id(), "joint", 6);
        assertNull(room.consume(anna.id()));
        room.leave(anna.id());

        RoomInstance other = new RoomInstance(new RoomData(UUID.randomUUID(), "Altra", null, null, null, LAYOUT,
                0, 1, 2, "neon", "neon", "open", 4, true));
        other.join(anna.session());
        JsonNode me = anna.last("room_state").path("users").get(0);
        assertEquals("joint", me.path("handItem").asString(), "la canna e' ancora in mano");
        assertEquals(5, me.path("handLeft").asInt(), "con i tiri rimasti");
        assertEquals("chill", me.path("effect").asString(), "e l'effetto continua");
        Thread.sleep(1_600);
        assertNull(other.consume(anna.id()));
        assertEquals(4, anna.last("consume").path("left").asInt(), "si fuma anche qui");
    }

    @Test
    @DisplayName("Una stanza piena rifiuta nuovi ingressi")
    void fullRoom() throws Exception {
        room.join(client("a").session());
        room.join(client("b").session());

        assertEquals(RoomInstance.JoinResult.FULL, room.join(client("c").session()));
    }

    @Test
    @DisplayName("Il sussurro arriva solo al destinatario e al mittente")
    void whisperIsPrivate() throws Exception {
        Client anna = client("anna");
        Client bruno = client("bruno");
        RoomInstance bigRoom = new RoomInstance(new RoomData(UUID.randomUUID(), "Big", null, null, null, LAYOUT,
                0, 1, 2, "neon", "neon", "open", 10, true));
        Client carla = client("carla");
        bigRoom.join(anna.session());
        bigRoom.join(bruno.session());
        bigRoom.join(carla.session());

        assertTrue(bigRoom.whisper(anna.id(), "BRUNO", "segreto"));

        assertEquals("segreto", bruno.last("chat").path("text").asString());
        assertEquals("whisper", anna.last("chat").path("style").asString());
        assertTrue(carla.types().stream().noneMatch("chat"::equals));
    }

    @Test
    @DisplayName("Emote sconosciute vengono ignorate")
    void unknownEmoteIgnored() throws Exception {
        Client anna = client("anna");
        room.join(anna.session());

        room.emote(anna.id(), "hack");
        room.emote(anna.id(), "wave");

        assertEquals(1, anna.types().stream().filter("emote"::equals).count());
    }

    @Test
    @DisplayName("La direzione segue la convenzione di Habbo")
    void directions() {
        assertEquals(2, RoomInstance.directionBetween(0, 0, 1, 0, 0));
        assertEquals(4, RoomInstance.directionBetween(0, 0, 0, 1, 0));
        assertEquals(3, RoomInstance.directionBetween(0, 0, 1, 1, 0));
        assertEquals(7, RoomInstance.directionBetween(1, 1, 0, 0, 0));
    }

    @Test
    @DisplayName("Chi torna sulla pagina dell'hotel riceve lo stato senza rientrare; chi va altrove resta, assente")
    void resyncAndAway() throws Exception {
        Client anna = client("anna");
        Client bruno = client("bruno");
        room.join(anna.session());
        room.join(bruno.session());
        int statesBefore = (int) anna.types().stream().filter("room_state"::equals).count();

        room.setAway(anna.id(), true);
        assertTrue(bruno.last("user_away").path("away").asBoolean());
        room.setAway(anna.id(), true);
        assertEquals(1, bruno.types().stream().filter("user_away"::equals).count(), "nessun doppione se non cambia");

        assertTrue(room.resendState(anna.id()));
        assertEquals(statesBefore + 1, anna.types().stream().filter("room_state"::equals).count());
        assertTrue(anna.last("room_state").path("users").get(0).path("away").asBoolean());
        assertEquals(0, bruno.types().stream().filter("user_left"::equals).count(), "nessuno e' uscito");
        assertEquals(false, room.resendState(UUID.randomUUID()), "chi non e' nella stanza non riceve nulla");
    }
}
