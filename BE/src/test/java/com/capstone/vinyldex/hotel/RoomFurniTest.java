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
    @DisplayName("Tappeti e piastrelle stanno sotto gli altri mobili, ma non uno sull'altro")
    void flatItemsStack() {
        // Il tavolino e' in (3,2): il tappeto 2x2 in (2,1) lo copre.
        assertEquals(RoomInstance.PlaceResult.OK, room.canPlace(def("rug_vinyl"), 2, 1, 0, null), "tappeto sotto il tavolino");
        room.putItem(new RoomItemView(UUID.randomUUID(), null, "rug_vinyl", 2, 1, 0, 0, null));

        assertEquals(RoomInstance.PlaceResult.OK, room.canPlace(def("sofa_vinyl"), 1, 1, 0, null), "divano sul tappeto");
        assertEquals(RoomInstance.PlaceResult.OCCUPIED, room.canPlace(def("dance_tile"), 2, 2, 0, null), "due mobili a terra no");
        assertEquals(RoomInstance.PlaceResult.OCCUPIED, room.canPlace(def("chair_neon"), 3, 2, 0, null), "due mobili sopra no");
    }

    @Test
    @DisplayName("Le quattro rotazioni girano lo schienale verso tutti i lati")
    void fourRotations() {
        FurniCatalog.FurniDef chair = def("chair_neon");
        assertEquals(List.of(2, 4, 6, 0), List.of(chair.sitDirFor(0), chair.sitDirFor(2), chair.sitDirFor(4), chair.sitDirFor(6)));
        FurniCatalog.FurniDef sofa = def("sofa_vinyl");
        assertEquals(List.of(4, 2, 0, 6), List.of(sofa.sitDirFor(0), sofa.sitDirFor(2), sofa.sitDirFor(4), sofa.sitDirFor(6)));
        assertEquals(1, sofa.footprintX(6), "rot 6 e' in verticale come rot 2");
        assertEquals(4, sofa.normalizeRot(4));
        assertEquals(2, def("card_frame").normalizeRot(6), "i quadri hanno solo due pareti");
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
    @DisplayName("Sul divano si siedono in due: chi trova il posto preso va sull'altro")
    void sofaSeatsTwo() throws Exception {
        room.putItem(new RoomItemView(UUID.randomUUID(), null, "sofa_vinyl", 1, 2, 0, 0, null));
        JsonMapper mapper = JsonMapper.builder().build();
        List<JsonNode> received = new ArrayList<>();
        UUID anna = join(mapper, received, "anna");
        UUID bruno = join(mapper, received, "bruno");

        room.move(anna, 1, 2);
        for (int i = 0; i < 6; i++) room.tick();
        room.move(bruno, 1, 2);
        for (int i = 0; i < 6; i++) room.tick();

        List<JsonNode> seated = received.stream()
                .filter(n -> "user_status".equals(n.path("type").asString()) && "sit".equals(n.path("status").asString()))
                .toList();
        assertEquals(2, seated.stream().map(n -> n.path("id").asString()).distinct().count(), "seduti entrambi");
        JsonNode lastPath = received.reversed().stream()
                .filter(n -> "user_path".equals(n.path("type").asString()) && bruno.toString().equals(n.path("id").asString()))
                .findFirst().orElseThrow();
        JsonNode end = lastPath.path("path").get(lastPath.path("path").size() - 1);
        assertEquals(2, end.get(0).asInt(), "bruno sull'altro posto del divano");
    }

    private UUID join(JsonMapper mapper, List<JsonNode> received, String name) throws Exception {
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

    @Test
    @DisplayName("I mobili solidi bloccano il passaggio, tappeti e sedute no")
    void passability() {
        assertEquals(false, def("table_round").passable());
        assertEquals(true, def("rug_vinyl").passable());
        assertEquals(true, def("sofa_vinyl").passable());
    }
}
