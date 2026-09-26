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
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Partita a squadre vera, con quattro giocatori nella stanza (sessioni finte): squadre, fischio
 * d'inizio, chi puo' fischiare, abbandono con sconfitta a tavolino e premi via evento.
 */
class TeamMatchRoomTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private final List<Object> events = new ArrayList<>();
    private RoomInstance room;

    private record Client(HotelSession session, List<JsonNode> received, UUID id) {
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
        room.join(session);
        return new Client(session, received, id);
    }

    /** Stadio piccolo: 20x9 con le due porte ai lati. */
    @BeforeEach
    void setUp() {
        StringBuilder layout = new StringBuilder();
        for (int y = 0; y <= 9; y++) {
            for (int x = 0; x <= 20; x++) layout.append(x == 0 && y != 5 ? 'x' : y == 0 ? 'x' : '0');
            if (y < 9) layout.append('\n');
        }
        List<RoomItemView> goals = List.of(
                new RoomItemView(UUID.randomUUID(), null, FootballMatch.GOAL_TYPE, 1, 4, 0, 0, null),
                new RoomItemView(UUID.randomUUID(), null, FootballMatch.GOAL_TYPE, 20, 4, 0, 0, null));
        room = new RoomInstance(new RoomData(UUID.randomUUID(), "Stadio test", null, null, null, layout.toString(),
                0, 5, 2, "pitch", "stadium", "open", 20, true), goals, new Random(3));
        room.setEvents(events::add);
    }

    @Test
    @DisplayName("Due contro due: squadre piene a due, fischia solo chi gioca, tutti vedono le squadre")
    void teamsAndStart() throws Exception {
        Client anna = client("anna");
        Client bruno = client("bruno");
        Client carla = client("carla");
        Client dario = client("dario");
        Client elena = client("elena");

        assertNull(room.matchJoin(anna.id(), "blue"));
        assertNull(room.matchJoin(bruno.id(), "blue"));
        assertEquals("match_team_full", room.matchJoin(carla.id(), "blue"));
        assertNull(room.matchJoin(carla.id(), "red"));
        assertNull(room.matchJoin(dario.id(), "red"));

        assertEquals("match_not_player", room.matchStart(elena.id()), "chi guarda non fischia");
        assertNull(room.matchStart(anna.id()));

        JsonNode view = elena.last("match");
        assertEquals("playing", view.path("phase").asString());
        assertEquals(2, view.path("blue").size());
        assertEquals(2, view.path("red").size());
        assertEquals("match_running", room.matchJoin(elena.id(), "red"), "a partita iniziata non si entra");
    }

    @Test
    @DisplayName("Se una squadra resta vuota perde a tavolino: vincono gli altri e il premio passa dall'evento")
    void forfeit() throws Exception {
        Client anna = client("anna");
        Client bruno = client("bruno");
        Client carla = client("carla");
        room.matchJoin(anna.id(), "blue");
        room.matchJoin(bruno.id(), "red");
        room.matchJoin(carla.id(), "red");
        room.matchStart(bruno.id());

        room.leave(anna.id());

        JsonNode end = carla.last("match_end");
        assertEquals("red", end.path("winner").asString());
        HotelGameEvents.MatchPlayed played = events.stream().filter(HotelGameEvents.MatchPlayed.class::isInstance)
                .map(HotelGameEvents.MatchPlayed.class::cast).findFirst().orElseThrow();
        assertTrue(played.winners().containsAll(List.of(bruno.id(), carla.id())));
        assertEquals(List.of(), played.losers(), "chi e' uscito non prende niente");
        assertEquals("lobby", carla.last("match").path("phase").asString());
    }
}
