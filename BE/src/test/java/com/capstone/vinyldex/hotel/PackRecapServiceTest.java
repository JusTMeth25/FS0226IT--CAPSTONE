package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.PackOpening;
import com.capstone.vinyldex.entity.PackOpeningCard;
import com.capstone.vinyldex.repository.PackOpeningRepository;
import com.capstone.vinyldex.repository.PackRepository;
import com.capstone.vinyldex.service.PackGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Riepilogo dei pacchetti aperti nell'hotel: valore totale e carta piu' costosa. */
class PackRecapServiceTest {

    private static Card card(String code, String rarity, Double price) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode(code);
        card.setName(code);
        card.setRarity(rarity);
        if (price != null) card.setMetadata(Map.of("marketPrice", price));
        return card;
    }

    @Test
    @DisplayName("Il totale somma i prezzi di mercato e la carta migliore e' la piu' costosa")
    void totalAndTop() {
        List<Card> cards = List.of(card("a", "common", 0.25), card("b", "rare", 12.5), card("c", "legendary", null));
        assertEquals(12.75, PackRecapService.total(cards));
        assertEquals("b", PackRecapService.top(cards).getCode(), "conta il prezzo, non la rarita'");
        assertEquals("c", PackRecapService.top(List.of(card("x", "common", null), card("c", "legendary", null))).getCode(),
                "senza prezzi vince la rarita' piu' alta");
    }

    @Test
    @DisplayName("L'ultima apertura del giocatore si annuncia a tutta la stanza, una volta sola")
    void announcesOnce() throws Exception {
        PackOpeningRepository openings = mock(PackOpeningRepository.class);
        PackRecapService service = new PackRecapService(openings, mock(PackRepository.class), mock(PackGenerator.class),
                mock(RoomRegistry.class));

        Pack pack = new Pack();
        pack.setName("Pacchetto Deluxe");
        PackOpening opening = new PackOpening();
        opening.setId(UUID.randomUUID());
        opening.setPack(pack);
        List<PackOpeningCard> cards = new ArrayList<>();
        for (Card c : List.of(card("a", "common", 1.0), card("b", "epic", 40.0))) cards.add(new PackOpeningCard(opening, c, c.getRarity()));
        opening.setCards(cards);

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
        UUID anna = UUID.randomUUID();
        session.authenticate(new HotelUser(anna, "anna", HotelLook.DEFAULT, 1));
        RoomInstance room = new RoomInstance(new RoomData(UUID.randomUUID(), "Stanza", null, null, null,
                "xxx\n000\nx00", 0, 1, 2, "neon", "neon", "open", 10, false));
        room.join(session);
        when(openings.findRecentOfUser(eq(anna), any())).thenReturn(List.of(opening));

        assertNull(service.announceLatest(session, room));
        JsonNode recap = received.reversed().stream().filter(n -> "pack_recap".equals(n.path("type").asString())).findFirst().orElseThrow();
        assertEquals("Pacchetto Deluxe", recap.path("pack").asString());
        assertEquals(41.0, recap.path("total").asDouble());
        assertEquals("b", recap.path("top").path("id").asString());
        assertEquals(2, recap.path("count").asInt());

        assertEquals("no_recent_pack", service.announceLatest(session, room), "la stessa apertura non si ripete");
    }

    @Test
    @DisplayName("Ogni tanto un NPC ospite apre un pacchetto e la stanza vede il riepilogo")
    void npcOpensPacks() throws Exception {
        PackRepository packs = mock(PackRepository.class);
        PackGenerator generator = mock(PackGenerator.class);
        RoomRegistry registry = mock(RoomRegistry.class);
        PackRecapService service = new PackRecapService(mock(PackOpeningRepository.class), packs, generator, registry);
        Pack pack = new Pack();
        pack.setName("Pacchetto Base");
        when(packs.findAllActiveWithRates()).thenReturn(List.of(pack));
        when(generator.generate(pack)).thenReturn(List.of(card("a", "rare", 3.0), card("b", "common", 0.1)));

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
        session.authenticate(new HotelUser(UUID.randomUUID(), "anna", HotelLook.DEFAULT, 1));
        // L'edicola vera: due ospiti che possono aprire pacchetti.
        RoomInstance room = new RoomInstance(new RoomData(NpcRoster.NEWSSTAND, "Edicola", null, null, null,
                RoomNpcTest.bigLayout(), 0, 11, 2, "cobble", "shops", "open", 50, true));
        room.join(session);
        when(registry.get(any())).thenReturn(null);
        when(registry.get(NpcRoster.NEWSSTAND)).thenReturn(room);

        // Succede una volta su cinque: si riprova finche' non capita.
        for (int i = 0; i < 200 && received.stream().noneMatch(n -> "pack_recap".equals(n.path("type").asString())); i++) {
            service.npcOpenings();
        }
        JsonNode recap = received.stream().filter(n -> "pack_recap".equals(n.path("type").asString())).findFirst().orElseThrow();
        assertEquals(true, recap.path("npc").asBoolean());
        assertEquals("a", recap.path("top").path("id").asString());
        assertEquals(3.1, recap.path("total").asDouble());
        String opener = recap.path("username").asString();
        assertEquals(true, opener.equals("Nando") || opener.equals("Bianca"), "apre un ospite, non l'edicolante");
    }
}
