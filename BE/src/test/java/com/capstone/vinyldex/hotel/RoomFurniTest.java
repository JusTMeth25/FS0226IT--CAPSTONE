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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoomFurniTest {

    /**
     * Stanza 5x4 con porta in (0,1), una fila rialzata in fondo e il vuoto in basso a destra:
     *   x1111
     *   00000
     *   x0000
     *   x000x
     */
    private static final String LAYOUT = "x1111\n00000\nx0000\nx000x";

    private static FurniCatalog.FurniDef def(String type) {
        return FurniCatalog.get(type).orElseThrow();
    }

    private RoomInstance room;

    @BeforeEach
    void setUp() {
        room = new RoomInstance(new RoomData(UUID.randomUUID(), "Test", null, UUID.randomUUID(), "owner", LAYOUT,
                0, 1, 2, "neon", "neon", "open", 10, false),
                List.of(new RoomItemView(UUID.randomUUID(), null, "table_round", 3, 2, 0, 0, null)));
    }

    @Test
    @DisplayName("Un mobile a pavimento deve stare tutto nella stanza, in piano e lontano dalla porta")
    void floorPlacementRules() {
        assertEquals(RoomInstance.PlaceResult.OK, room.canPlace(def("chair_neon"), 1, 2, 0, null));
        assertEquals(RoomInstance.PlaceResult.OUTSIDE, room.canPlace(def("chair_neon"), 4, 3, 0, null));
        assertEquals(RoomInstance.PlaceResult.DOOR, room.canPlace(def("chair_neon"), 0, 1, 0, null));
        assertEquals(RoomInstance.PlaceResult.UNEVEN, room.canPlace(def("sofa_vinyl"), 1, 0, 2, null), "metà sul palco");
        assertEquals(RoomInstance.PlaceResult.OCCUPIED, room.canPlace(def("sofa_vinyl"), 2, 2, 0, null), "c'e' il tavolino");
    }

    @Test
    @DisplayName("Ruotare un mobile lungo scambia il suo ingombro fra x e y")
    void rotationSwapsFootprint() {
        // Divano 2x1: con rot 0 finirebbe sul tavolino in (3,2), con rot 2 va in verticale.
        assertEquals(RoomInstance.PlaceResult.OCCUPIED, room.canPlace(def("sofa_vinyl"), 2, 2, 0, null));
        assertEquals(RoomInstance.PlaceResult.OK, room.canPlace(def("sofa_vinyl"), 2, 1, 2, null));
    }

    @Test
    @DisplayName("Un quadro va solo su una parete che esiste davvero")
    void wallPlacementRules() {
        assertEquals(RoomInstance.PlaceResult.OK, room.canPlace(def("card_frame"), 2, 0, 0, null), "parete in alto");
        assertEquals(RoomInstance.PlaceResult.OK, room.canPlace(def("card_frame"), 1, 2, 2, null), "parete a sinistra");
        assertEquals(RoomInstance.PlaceResult.NO_WALL, room.canPlace(def("card_frame"), 2, 2, 0, null), "in mezzo alla stanza");
        assertEquals(RoomInstance.PlaceResult.NO_WALL, room.canPlace(def("card_frame"), 1, 1, 2, null), "accanto alla porta aperta");
    }

    @Test
    @DisplayName("Chi arriva su una sedia si siede, girato come la sedia")
    void sitsOnArrival() throws Exception {
        room.putItem(new RoomItemView(UUID.randomUUID(), null, "chair_neon", 2, 2, 0, 2, null));

        JsonMapper mapper = JsonMapper.builder().build();
        List<JsonNode> received = new ArrayList<>();
        WebSocketSession raw = mock(WebSocketSession.class);
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn("anna");
        doAnswer(inv -> {
            received.add(mapper.readTree(((TextMessage) inv.getArgument(0)).getPayload()));
            return null;
        }).when(raw).sendMessage(any());

        HotelSession session = new HotelSession(raw, mapper);
        UUID id = UUID.randomUUID();
        session.authenticate(new HotelUser(id, "anna", HotelLook.DEFAULT, 1));
        room.join(session);

        room.move(id, 2, 2);
        for (int i = 0; i < 5; i++) room.tick();

        JsonNode status = received.reversed().stream()
                .filter(n -> "user_status".equals(n.path("type").asString())).findFirst().orElseThrow();
        assertEquals("sit", status.path("status").asString());
        assertEquals(4, status.path("dir").asInt(), "sedia ruotata: si guarda verso sud");
    }

    @Test
    @DisplayName("I mobili solidi bloccano il passaggio, tappeti e sedute no")
    void passability() {
        assertEquals(false, def("table_round").passable());
        assertEquals(true, def("rug_vinyl").passable());
        assertEquals(true, def("sofa_vinyl").passable());
    }
}
