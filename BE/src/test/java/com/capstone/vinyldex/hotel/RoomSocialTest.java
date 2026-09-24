package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
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

class RoomSocialTest {

    private static final String LAYOUT = "x00000\n000000\nx00000\nx00000";
    private final JsonMapper mapper = JsonMapper.builder().build();

    private record Client(UUID id, List<JsonNode> received) {
        JsonNode last(String type) {
            return received.reversed().stream().filter(n -> type.equals(n.path("type").asString())).findFirst().orElse(null);
        }
    }

    private Client join(RoomInstance room, String name) throws Exception {
        List<JsonNode> received = new ArrayList<>();
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
        return new Client(id, received);
    }

    private static RoomInstance room(boolean publicRoom, UUID ownerId, RoomItemView... items) {
        return new RoomInstance(new RoomData(UUID.randomUUID(), "Bar", null, ownerId, null, LAYOUT, 0, 1, 2,
                "neon", "neon", "open", 10, publicRoom), List.of(items));
    }

    @Test
    @DisplayName("Al bancone da lontano si cammina fin li' e la bibita arriva all'arrivo")
    void barServesDrinkOnArrival() throws Exception {
        RoomItemView bar = new RoomItemView(UUID.randomUUID(), null, "bar_counter", 3, 0, 0, 0, null);
        RoomInstance room = room(true, null, bar);
        Client anna = join(room, "anna");
        for (int i = 0; i < 3; i++) room.tick();

        assertNull(room.useItem(anna.id(), bar.id()));
        assertNotNull(anna.last("user_path"), "prima si cammina verso il bancone");
        assertNull(anna.last("hand_item"), "la bibita arriva solo quando si e' accanto");

        for (int i = 0; i < 8; i++) room.tick();
        JsonNode drink = anna.last("hand_item");
        assertNotNull(drink);
        assertTrue(List.of("cola", "juice", "coffee", "bubble").contains(drink.path("item").asString()));
    }

    @Test
    @DisplayName("Il jukebox di una stanza pubblica lo accende chiunque, ma non di continuo")
    void jukeboxInPublicRoom() throws Exception {
        RoomItemView jukebox = new RoomItemView(UUID.randomUUID(), null, "jukebox", 4, 2, 0, 0, null);
        RoomInstance room = room(true, null, jukebox);
        Client anna = join(room, "anna");

        assertNull(room.useItem(anna.id(), jukebox.id()));
        JsonNode playing = anna.last("jukebox");
        assertEquals(0, playing.path("track").asInt());
        assertTrue(playing.path("startedAt").asLong() > 0);

        assertEquals("jukebox_cooldown", room.useItem(anna.id(), jukebox.id()), "un cambio ogni 3 secondi");
        assertNull(room.setJukebox(anna.id(), false));
        assertEquals(-1, anna.last("jukebox").path("track").asInt());
    }

    @Test
    @DisplayName("Nella stanza di un altro il jukebox lo comanda solo il proprietario")
    void jukeboxInPrivateRoom() throws Exception {
        UUID owner = UUID.randomUUID();
        RoomItemView jukebox = new RoomItemView(UUID.randomUUID(), owner, "jukebox", 4, 2, 0, 0, null);
        RoomInstance room = room(false, owner, jukebox);
        Client guest = join(room, "ospite");

        assertEquals("not_your_room", room.useItem(guest.id(), jukebox.id()));
    }

    @Test
    @DisplayName("I distintivi seguono collezione, livello e battaglie")
    void badges() {
        User user = new User();
        user.setLevel(12);
        user.setBattlesWon(6);
        List<UserCard> cards = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            Card card = new Card();
            card.setRarity(i == 0 ? "legendary" : "common");
            UserCard uc = new UserCard();
            uc.setCard(card);
            uc.setQuantity(1);
            cards.add(uc);
        }

        List<String> codes = HotelSocialService.badges(user, cards).stream().map(b -> b.get("code")).toList();
        assertEquals(List.of("collector1", "legend", "level2", "fighter"), codes);
    }

    @Test
    @DisplayName("Il rispetto viene annunciato a tutta la stanza")
    void respectIsBroadcast() throws Exception {
        RoomInstance room = room(true, null);
        Client anna = join(room, "anna");
        Client bruno = join(room, "bruno");

        room.announceRespect(anna.id(), bruno.id(), 7);

        JsonNode seenByBruno = bruno.last("respect");
        assertEquals(anna.id().toString(), seenByBruno.path("from").asString());
        assertEquals(7, seenByBruno.path("total").asInt());
        assertNotNull(anna.last("respect"));
    }
}
