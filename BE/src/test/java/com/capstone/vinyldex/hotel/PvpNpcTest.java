package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PvpNpcTest {

    private static final String ARENA_LAYOUT = RoomNpcTest.bigLayout();

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final List<JsonNode> received = new CopyOnWriteArrayList<>();

    private static Card card(String code, int stat) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode(code);
        card.setName(code);
        card.setRarity("rare");
        card.setFans(stat);
        card.setStyle(stat);
        card.setInfluence(stat);
        card.setEnergy(stat);
        return card;
    }

    private JsonNode last(String type) {
        for (int i = received.size() - 1; i >= 0; i--) {
            if (type.equals(received.get(i).path("type").asString())) return received.get(i);
        }
        return null;
    }

    private long count(String type) {
        return received.stream().filter(n -> type.equals(n.path("type").asString())).count();
    }

    @Test
    @DisplayName("In Arena si sfida uno sfidante NPC: accetta, gioca da solo e a fine partita arriva il premio")
    void fullMatchAgainstNpc() throws Exception {
        RoomRegistry registry = new RoomRegistry(NpcMind.NONE, event -> { });
        UserCardRepository userCards = mock(UserCardRepository.class);
        NpcDeals deals = mock(NpcDeals.class);
        PvpService pvp = new PvpService(registry, userCards, mock(PvpRewardService.class), deals);

        User owner = new User();
        List<Card> mine = List.of(card("a", 50), card("b", 60), card("c", 70));
        UUID annaId = UUID.randomUUID();
        when(userCards.findByUserIdWithCard(annaId)).thenReturn(mine.stream().map(c -> new UserCard(owner, c, 1)).toList());
        when(deals.team(any(), any())).thenReturn(List.of(card("x", 40), card("y", 55), card("z", 65)).stream()
                .map(PvpService::cardInfo).toList());
        when(deals.reward(eq(annaId), anyString(), anyBoolean(), anyBoolean()))
                .thenReturn(new PvpRewardService.PlayerReward(50, 100, false, 2));

        WebSocketSession raw = mock(WebSocketSession.class);
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn("anna");
        doAnswer(inv -> {
            received.add(mapper.readTree(((TextMessage) inv.getArgument(0)).getPayload()));
            return null;
        }).when(raw).sendMessage(any());
        HotelSession session = new HotelSession(raw, mapper);
        session.authenticate(new HotelUser(annaId, "anna", HotelLook.DEFAULT, 1));
        registry.register(session);
        RoomData arena = new RoomData(NpcRoster.ARENA, "Arena", null, null, null, ARENA_LAYOUT,
                0, 11, 2, "arena", "brick", "open", 25, true);
        registry.join(session, arena, List.of());

        UUID kira = null;
        for (JsonNode user : last("room_state").path("users")) {
            if ("Kira".equals(user.path("username").asString())) kira = UUID.fromString(user.path("id").asString());
        }
        assertNotNull(kira);
        assertEquals(null, pvp.challenge(session, kira));

        long end = System.currentTimeMillis() + 60_000;
        int rounds = 0;
        int categories = 0;
        boolean teamSent = false;
        while (last("pvp_end") == null && System.currentTimeMillis() < end) {
            Thread.sleep(200);
            if (!teamSent && last("pvp_start") != null) {
                assertEquals(null, pvp.team(session, List.of("a", "b", "c")));
                teamSent = true;
            }
            JsonNode round = last("pvp_round");
            if (round != null && count("pvp_round") > rounds) {
                rounds = (int) count("pvp_round");
                if ("you".equals(round.path("chooser").asString())) pvp.category(session, "fans");
            }
            if (count("pvp_category") > categories) {
                categories = (int) count("pvp_category");
                pvp.card(session, categories - 1, false);
            }
        }

        JsonNode result = last("pvp_end");
        assertNotNull(result, "la partita finisce");
        assertEquals(3, count("pvp_reveal"), "tre round giocati");
        assertEquals(50, result.path("reward").path("gold").asInt());
        verify(deals).reward(eq(annaId), eq("Kira"), anyBoolean(), anyBoolean());
        assertTrue(received.stream().anyMatch(n -> "chat".equals(n.path("type").asString())
                && n.path("text").asString().contains("anna")), "Kira parla durante la sfida");
        assertEquals(false, pvp.isBusy(kira), "a fine partita Kira e' di nuovo libera");
    }

    @Test
    @DisplayName("Se un NPC ti sfida e cambi stanza, la sfida scade anche per te e il popup si chiude")
    void npcChallengeCancelledWhenLeaving() throws Exception {
        RoomRegistry registry = new RoomRegistry(NpcMind.NONE, event -> { });
        PvpService pvp = new PvpService(registry, mock(UserCardRepository.class), mock(PvpRewardService.class), mock(NpcDeals.class));
        WebSocketSession raw = mock(WebSocketSession.class);
        when(raw.isOpen()).thenReturn(true);
        when(raw.getId()).thenReturn("anna");
        doAnswer(inv -> {
            received.add(mapper.readTree(((TextMessage) inv.getArgument(0)).getPayload()));
            return null;
        }).when(raw).sendMessage(any());
        HotelSession session = new HotelSession(raw, mapper);
        UUID annaId = UUID.randomUUID();
        session.authenticate(new HotelUser(annaId, "anna", HotelLook.DEFAULT, 1));
        registry.register(session);
        registry.join(session, new RoomData(NpcRoster.ARENA, "Arena", null, null, null, ARENA_LAYOUT,
                0, 11, 2, "arena", "brick", "open", 25, true), List.of());

        // La sfida spontanea parte una volta su tre: si riprova finche' non arriva.
        for (int i = 0; i < 60 && last("challenge_received") == null; i++) pvp.npcChallenges();
        JsonNode challenge = last("challenge_received");
        assertNotNull(challenge, "uno sfidante ha sfidato anna");

        pvp.userLeft(annaId);
        JsonNode expired = last("challenge_expired");
        assertNotNull(expired, "anna riceve la scadenza");
        assertEquals(challenge.path("challengeId").asString(), expired.path("challengeId").asString());
    }
}
