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
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoomNpcTest {

    private static final String LAYOUT = String.join("\n",
            "xxxxxxxxxxxx", "x00000000000", "x00000000000", "x00000000000", "x00000000000", "x00000000000",
            "000000000000", "x00000000000", "x00000000000", "x00000000000", "x00000000000", "x00000000000");

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final List<JsonNode> received = new ArrayList<>();
    private RoomInstance room;
    private UUID anna;

    @BeforeEach
    void setUp() throws Exception {
        RoomData data = new RoomData(NpcRoster.NEON_BAR, "Neon Bar", null, null, null, LAYOUT,
                0, 6, 2, "checker", "neon", "open", 25, true);
        room = new RoomInstance(data, List.of(
                new RoomItemView(UUID.randomUUID(), null, "bar_counter", 4, 2, 0, 0, null),
                new RoomItemView(UUID.randomUUID(), null, "jukebox", 11, 1, 0, 0, null)), new Random(1));

        WebSocketSession raw = mock(WebSocketSession.class);
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn("anna");
        doAnswer(inv -> {
            received.add(mapper.readTree(((TextMessage) inv.getArgument(0)).getPayload()));
            return null;
        }).when(raw).sendMessage(any());
        HotelSession session = new HotelSession(raw, mapper);
        anna = UUID.randomUUID();
        session.authenticate(new HotelUser(anna, "anna", HotelLook.DEFAULT, 1));
        room.join(session);
    }

    private UUID npcId(String name) {
        JsonNode state = received.stream().filter(n -> "room_state".equals(n.path("type").asString())).findFirst().orElseThrow();
        for (JsonNode user : state.path("users")) {
            if (name.equals(user.path("username").asString())) return UUID.fromString(user.path("id").asString());
        }
        throw new AssertionError("NPC non trovato: " + name);
    }

    /** Aspetta che scadano le risposte ritardate degli NPC e fa girare il tick. */
    private void waitAndTick(int ticks) throws InterruptedException {
        for (int i = 0; i < ticks; i++) {
            Thread.sleep(250);
            room.tick();
        }
    }

    @Test
    @DisplayName("Gli NPC sono nella stanza con il loro mestiere, ma non contano come giocatori")
    void npcsPresentButNotCounted() {
        JsonNode state = received.getFirst();
        long npcs = 0;
        for (JsonNode user : state.path("users")) {
            if (user.has("npc")) npcs++;
        }
        assertEquals(NpcRoster.forRoom(NpcRoster.NEON_BAR).size(), npcs);
        assertEquals(1, room.userCount(), "solo anna e' un giocatore");
        assertTrue(room.isNpc(npcId("Vinnie")));
        assertEquals("Barista", state.path("users").get(0).path("npc").path("title").asString());
    }

    @Test
    @DisplayName("Il barista serve chi gli chiede un cocktail in chat e gli sta vicino")
    void baristaServesOnChat() throws Exception {
        room.move(anna, 5, 3);
        for (int i = 0; i < 12; i++) room.tick();

        room.chat(anna, "Vinnie, un cocktail per favore!", "normal");
        waitAndTick(12);

        JsonNode hand = received.stream()
                .filter(n -> "hand_item".equals(n.path("type").asString()) && anna.toString().equals(n.path("id").asString()))
                .reduce((a, b) -> b).orElseThrow();
        assertEquals("cocktail", hand.path("item").asString());
        assertTrue(received.stream().anyMatch(n -> "chat".equals(n.path("type").asString())
                && npcId("Vinnie").toString().equals(n.path("id").asString())), "il barista ha parlato");
    }

    @Test
    @DisplayName("Sussurrando a un NPC, la risposta arriva solo a chi ha scritto")
    void whisperToNpcIsAnswered() throws Exception {
        assertTrue(room.whisper(anna, "DJ Byte", "ciao!"));
        waitAndTick(8);

        assertTrue(received.stream().anyMatch(n -> "chat".equals(n.path("type").asString())
                && "whisper".equals(n.path("style").asString())
                && npcId("DJ Byte").toString().equals(n.path("id").asString())));
    }

    @Test
    @DisplayName("Dalla scheda si ordina e si chiede musica; al barista non si chiede di ballare")
    void npcActions() throws Exception {
        assertNull(room.npcAction(anna, npcId("DJ Byte"), "music", null));
        assertTrue(received.stream().anyMatch(n -> "jukebox".equals(n.path("type").asString())
                && n.path("track").asInt() >= 0), "il DJ accende il jukebox");
        assertEquals("npc_not_found", room.npcAction(anna, UUID.randomUUID(), "talk", null));
        assertEquals("unknown_action", room.npcAction(anna, npcId("Vinnie"), "hack", null));
    }

    @Test
    @DisplayName("Le parole chiave della chat diventano intenzioni")
    void dialogIntents() {
        assertEquals(NpcDialog.Intent.ORDER, NpcDialog.intentOf("Un caffè, per favore!"));
        assertEquals("coffee", NpcDialog.requestedItem("Un caffè, per favore!"));
        assertEquals("tea", NpcDialog.requestedItem("mi fai un tè?"));
        assertNull(NpcDialog.requestedItem("questo e' per te"), "\"te\" da solo e' un pronome");
        assertEquals("pizza", NpcDialog.requestedItem("Salvatore, una margherita!"));
        assertEquals("book", NpcDialog.requestedItem("mi consigli un libro?"));
        assertEquals(NpcDialog.Intent.GREET, NpcDialog.intentOf("ciao Marco"));
        assertEquals(NpcDialog.Intent.THANKS, NpcDialog.intentOf("grazie mille"));
        assertTrue(NpcDialog.mentions("ehi dj byte, metti musica", "DJ Byte"));
    }
}
