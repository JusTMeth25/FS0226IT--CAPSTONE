package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.JwtService;
import com.capstone.vinyldex.service.PackService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Punto d'ingresso WebSocket dell'hotel: /ws/hotel.
 *
 * Protocollo: messaggi JSON con un campo "type". Il primo deve essere
 * {"type":"auth","token":"<jwt>"}; il token viaggia nel messaggio e non nell'URL, cosi' non
 * finisce nei log di accesso. Chi non si autentica entro 5 secondi viene disconnesso.
 *
 * Comandi accettati dopo l'autenticazione:
 *   join {roomId} · move {x,y} · chat {text} · shout {text} · whisper {to,text}
 *   typing {on} · emote {emote} · status {status} · refresh_profile · ping
 *   respect {userId} · use_item {itemId} · jukebox {on}
 *   challenge {userId} · challenge_reply {challengeId,accept} · pvp_team {cards} · pvp_category {category}
 *   pvp_card {index,boost} · pvp_forfeit · sync · away {on}
 *   npc {npcId,action,item}: ordinare, chiacchierare, far ballare o cambiare musica a un NPC
 *   consume: un sorso o un morso dell'oggetto in mano
 *   npc_showcase {npcId} · npc_trade_propose {npcId,give,want} · npc_trade_reply {offerId,accept}
 *   buy_pack {packId}: comprare un pacchetto in edicola (va nella borsa)
 *   pack_opened: finito di aprire un pacchetto, la stanza vede il riepilogo (valore e carta migliore)
 *   minigame_result {score} · minigame_quit: fine di un minigioco partito con use_item
 * Solo nella propria stanza:
 *   place {itemId,x,y,rot} · pickup {itemId} · set_display {itemId,cardId} · kick {userId}
 */
@Component
public class HotelSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(HotelSocketHandler.class);

    private static final long AUTH_TIMEOUT_MILLIS = 5_000;
    static final int MAX_MESSAGE_BYTES = 2_048;

    public static final CloseStatus AUTH_FAILED = new CloseStatus(4003, "auth_failed");
    public static final CloseStatus BANNED = new CloseStatus(4004, "banned");

    private final ObjectMapper objectMapper;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RoomRegistry registry;
    private final RoomService roomService;
    private final FurniService furniService;
    private final HotelSocialService socialService;
    private final PetService petService;
    private final FishingService fishingService;
    private final PvpService pvpService;
    private final NpcTradeService npcTradeService;
    private final PackService packService;
    private final PackRecapService packRecapService;
    private final MinigameRewardService minigameRewardService;
    private final Random random = new Random();
    private final Map<String, HotelSession> sessions = new ConcurrentHashMap<>();

    public HotelSocketHandler(ObjectMapper objectMapper, JwtService jwtService, UserRepository userRepository,
                              RoomRegistry registry, RoomService roomService, FurniService furniService,
                              HotelSocialService socialService, PvpService pvpService, NpcTradeService npcTradeService,
                              PackService packService, PackRecapService packRecapService,
                              MinigameRewardService minigameRewardService, PetService petService,
                              FishingService fishingService) {
        this.fishingService = fishingService;
        this.objectMapper = objectMapper;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.registry = registry;
        this.roomService = roomService;
        this.furniService = furniService;
        this.socialService = socialService;
        this.pvpService = pvpService;
        this.npcTradeService = npcTradeService;
        this.packService = packService;
        this.packRecapService = packRecapService;
        this.minigameRewardService = minigameRewardService;
        this.petService = petService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession raw) {
        HotelSession session = new HotelSession(raw, objectMapper);
        sessions.put(raw.getId(), session);
        registry.schedule(() -> {
            if (!session.isAuthenticated()) session.close(AUTH_FAILED);
        }, AUTH_TIMEOUT_MILLIS);
    }

    @Override
    protected void handleTextMessage(WebSocketSession raw, TextMessage message) {
        HotelSession session = sessions.get(raw.getId());
        if (session == null) return;

        if (message.getPayloadLength() > MAX_MESSAGE_BYTES) {
            session.close(CloseStatus.TOO_BIG_TO_PROCESS);
            return;
        }

        JsonNode node;
        try {
            node = objectMapper.readTree(message.getPayload());
        } catch (JacksonException ex) {
            session.send(error("bad_message"));
            return;
        }
        String type = text(node, "type");

        if (!session.isAuthenticated()) {
            if ("auth".equals(type)) authenticate(session, text(node, "token"));
            else session.close(AUTH_FAILED);
            return;
        }

        session.touch();
        try {
            dispatch(session, type, node);
        } catch (ApiException ex) {
            // Errori previsti (mobile non tuo, carta non posseduta...): il client li mostra.
            session.send(error(ex.getCode()));
        } catch (RuntimeException ex) {
            log.warn("Comando hotel {} fallito per {}: {}", type, session.user().username(), ex.getMessage());
            session.send(error("server_error"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession raw, CloseStatus status) {
        HotelSession session = sessions.remove(raw.getId());
        if (session == null) return;
        // Chi si disconnette durante una sfida la perde a tavolino.
        if (session.user() != null) pvpService.userLeft(session.user().id());
        registry.unregister(session);
    }

    // ------------------------------------------------------------------ comandi

    private void authenticate(HotelSession session, String token) {
        UUID userId = token == null ? null : jwtService.extractUserId(token);
        Optional<User> user = userId == null ? Optional.empty() : userRepository.findById(userId);
        if (user.isEmpty()) {
            session.close(AUTH_FAILED);
            return;
        }
        if (user.get().isBanned()) {
            session.send(error("banned"));
            session.close(BANNED);
            return;
        }

        HotelUser hotelUser = HotelUser.from(user.get(), socialService.showcase(userId)).withPet(petService.petOf(userId));
        session.authenticate(hotelUser);
        registry.register(session);
        session.send(Map.of("type", "hello", "user", hotelUser));
    }

    private void dispatch(HotelSession session, String type, JsonNode node) {
        UUID userId = session.user().id();
        RoomInstance room = registry.get(session.roomId());

        switch (type == null ? "" : type) {
            case "ping" -> session.send(Map.of("type", "pong"));
            case "join" -> {
                // Cambiare stanza durante una sfida vale come abbandono.
                pvpService.userLeft(userId);
                join(session, text(node, "roomId"));
            }
            case "leave" -> {
                pvpService.userLeft(userId);
                registry.leaveRoom(session);
            }
            case "move" -> {
                if (room != null) room.move(userId, integer(node, "x"), integer(node, "y"));
            }
            case "chat", "shout" -> {
                if (room != null) chat(session, room, type, text(node, "text"));
            }
            case "whisper" -> {
                if (room != null) whisper(session, room, text(node, "to"), text(node, "text"));
            }
            case "typing" -> {
                if (room != null) room.typing(userId, node.path("on").asBoolean(false));
            }
            case "emote" -> {
                if (room != null) room.emote(userId, text(node, "emote"));
            }
            case "status" -> {
                if (room != null) room.setStatus(userId, text(node, "status"));
            }
            case "refresh_profile" -> refreshProfile(session, room);
            case "place" -> {
                if (room != null) place(session, room, node);
            }
            case "pickup" -> {
                if (room != null) pickup(session, room, uuid(node, "itemId"));
            }
            case "set_display" -> {
                if (room != null) setDisplay(session, room, uuid(node, "itemId"), text(node, "cardId"));
            }
            case "respect" -> {
                if (room != null) respect(session, room, uuid(node, "userId"));
            }
            case "consume" -> {
                if (room != null) reply(session, room.consume(userId));
            }
            case "npc_trade_reply" -> reply(session, npcTradeService.reply(session, uuid(node, "offerId"),
                    node.path("accept").asBoolean(false)));
            case "npc_showcase" -> reply(session, npcTradeService.showcase(session, uuid(node, "npcId")));
            case "npc_trade_propose" -> reply(session, npcTradeService.propose(session, uuid(node, "npcId"),
                    text(node, "give"), text(node, "want")));
            case "npc" -> {
                if (room != null) reply(session, room.npcAction(userId, uuid(node, "npcId"), text(node, "action"), text(node, "item")));
            }
            case "buy_pack" -> buyPack(session, room, text(node, "packId"));
            case "pack_opened" -> {
                // Senza stanza o senza un'apertura recente non c'e' niente da mostrare: nessun errore.
                if (room != null) packRecapService.announceLatest(session, room);
            }
            case "minigame_result" -> {
                if (room != null) minigameResult(session, room, integer(node, "score"));
            }
            case "minigame_fx" -> {
                if (room != null) room.minigameFx(userId, minigameFx(node.get("fx")));
            }
            case "minigame_quit" -> {
                if (room != null) room.minigameQuit(userId);
            }
            case "use_item" -> {
                if (room != null) reply(session, room.useItem(userId, uuid(node, "itemId")));
            }
            case "jukebox" -> {
                if (room != null) reply(session, room.setJukebox(userId, node.path("on").asBoolean(true)));
            }
            case "challenge" -> reply(session, pvpService.challenge(session, uuid(node, "userId")));
            case "challenge_reply" -> reply(session, pvpService.reply(session, uuid(node, "challengeId"),
                    node.path("accept").asBoolean(false)));
            case "pvp_team" -> {
                List<String> cards = new ArrayList<>();
                node.path("cards").forEach(c -> cards.add(c.asString()));
                reply(session, pvpService.team(session, cards));
            }
            case "pvp_category" -> reply(session, pvpService.category(session, text(node, "category")));
            case "pvp_card" -> reply(session, pvpService.card(session, integer(node, "index"), node.path("boost").asBoolean(false)));
            case "pvp_forfeit" -> pvpService.userLeft(userId);
            case "sync" -> {
                // Tornato sulla pagina dell'hotel: stato completo della stanza in cui e' ancora.
                if (room == null || !room.resendState(userId)) session.send(Map.of("type", "not_in_room"));
            }
            case "away" -> {
                if (room != null) room.setAway(userId, node.path("on").asBoolean(false));
            }
            case "match_join" -> {
                if (room != null) reply(session, room.matchJoin(userId, text(node, "team")));
            }
            case "match_start" -> {
                if (room != null) reply(session, room.matchStart(userId));
            }
            case "kick" -> {
                if (room != null && room.data().isOwner(userId)) room.kick(uuid(node, "userId"));
            }
            default -> session.send(error("unknown_command"));
        }
    }

    /** Rilegge aspetto e livello dal database, dopo un salvataggio dal guardaroba. */
    private void refreshProfile(HotelSession session, RoomInstance room) {
        userRepository.findById(session.user().id()).ifPresent(user -> {
            HotelUser updated = HotelUser.from(user, socialService.showcase(user.getId())).withPet(petService.petOf(user.getId()));
            session.authenticate(updated);
            session.send(Map.of("type", "hello", "user", updated));
            if (room != null) room.updateUser(updated);
        });
    }

    private void join(HotelSession session, String rawRoomId) {
        UUID roomId;
        try {
            roomId = UUID.fromString(rawRoomId);
        } catch (IllegalArgumentException | NullPointerException ex) {
            session.send(error("room_not_found"));
            return;
        }

        Optional<RoomData> data = roomService.load(roomId);
        if (data.isEmpty()) {
            session.send(error("room_not_found"));
            return;
        }

        // Ogni ingresso rilegge le carte in mostra: dopo un pacchetto fortunato o una battaglia basta
        // cambiare stanza.
        session.authenticate(session.user().withShowcase(socialService.showcase(session.user().id())));
        RoomInstance.JoinResult result = registry.join(session, data.get(), roomService.loadItems(roomId));
        switch (result) {
            case FULL -> session.send(error("room_full"));
            case CLOSED -> session.send(error("room_closed"));
            case OK -> { }
        }
    }

    /**
     * Posiziona un mobile dall'inventario o sposta uno gia' nella stanza. Prima si controlla
     * che ci stia (stanza viva), poi che sia davvero dell'utente e la stanza sua (database).
     */
    private void place(HotelSession session, RoomInstance room, JsonNode node) {
        UUID userId = session.user().id();
        if (!room.data().isOwner(userId)) {
            session.send(error("not_your_room"));
            return;
        }
        UUID itemId = uuid(node, "itemId");
        if (itemId == null) {
            session.send(error("item_not_found"));
            return;
        }
        int x = integer(node, "x");
        int y = integer(node, "y");

        // Il tipo si legge dal database, non dal messaggio: forma e regole sono quelle vere.
        FurniCatalog.FurniDef def = furniService.ownedItem(userId, itemId).def();
        int rot = def.normalizeRot(integer(node, "rot"));
        RoomInstance.PlaceResult fit = room.canPlace(def, x, y, rot, itemId);
        if (fit != RoomInstance.PlaceResult.OK) {
            session.send(error("cant_place_" + fit.name().toLowerCase()));
            return;
        }
        room.putItem(furniService.place(userId, itemId, room.data().id(), x, y, room.heightAt(x, y), rot));
        session.send(Map.of("type", "inventory_changed"));
    }

    private void pickup(HotelSession session, RoomInstance room, UUID itemId) {
        UUID userId = session.user().id();
        if (itemId == null || !room.data().isOwner(userId)) {
            session.send(error("not_your_room"));
            return;
        }
        furniService.pickup(userId, itemId, room.data().id());
        room.removeItem(itemId);
        session.send(Map.of("type", "inventory_changed"));
    }

    private void setDisplay(HotelSession session, RoomInstance room, UUID itemId, String cardCode) {
        UUID userId = session.user().id();
        RoomItemView current = itemId == null ? null : room.item(itemId);
        if (current == null || !room.data().isOwner(userId)) {
            session.send(error("not_your_room"));
            return;
        }
        room.putItem(furniService.setDisplay(userId, itemId, cardCode));
    }

    /** Rispetto a un giocatore presente nella stanza: lo vedono tutti, e chi lo da' sa quanti gliene restano. */
    private void respect(HotelSession session, RoomInstance room, UUID receiverId) {
        if (receiverId == null || !room.contains(receiverId)) {
            session.send(error("user_not_here"));
            return;
        }
        if (room.isNpc(receiverId)) {
            session.send(error("npc_no_respect"));
            return;
        }
        HotelSocialService.RespectResult result = socialService.respect(session.user().id(), receiverId);
        room.announceRespect(session.user().id(), receiverId, result.receivedTotal());
        session.send(Map.of("type", "respects_left", "left", result.remainingToday()));
    }

    /** Fine di un minigioco: il punteggio lo controlla la stanza, un nuovo record vale dei gold. */
    private void minigameResult(HotelSession session, RoomInstance room, int score) {
        Minigames.Outcome outcome = room.minigameResult(session.user().id(), score);
        if (outcome.error() != null) {
            session.send(error(outcome.error()));
            return;
        }
        if ("fish".equals(outcome.game().key())) fishCard(session, room, outcome.score());
        if (!outcome.record()) return;
        MinigameRewardService.Reward reward = minigameRewardService.reward(session.user().id(), outcome.game(), outcome.score());
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "minigame_reward");
        message.put("game", outcome.game().key());
        message.put("gold", reward.gold());
        message.put("left", reward.left());
        message.put("reason", reward.reason());
        session.send(message);
    }

    /** Pesce raro dal molo: una carta nella collezione (fino a tre al giorno), e tutti lo vedono. */
    private void fishCard(HotelSession session, RoomInstance room, int score) {
        com.capstone.vinyldex.entity.Card card = fishingService.catchCard(session.user().id(), score);
        if (card == null) return;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "fish_card");
        message.put("card", RoomItemView.CardView.from(card));
        message.put("left", fishingService.leftToday(session.user().id()));
        session.send(message);
        room.announce(Map.of("type", "fish_catch", "by", session.user().username(), "byId", session.user().id(),
                "card", RoomItemView.CardView.from(card)));
    }

    /** In edicola si compra un pacchetto: i gold vanno via subito, il pacchetto finisce nella borsa. */
    private void buyPack(HotelSession session, RoomInstance room, String packId) {
        if (room == null || !NpcRoster.NEWSSTAND.equals(room.data().id())) {
            session.send(error("not_at_newsstand"));
            return;
        }
        if (packId == null) {
            session.send(error("pack_not_found"));
            return;
        }
        UUID userId = session.user().id();
        PackService.PackPurchase purchase = packService.buyPack(userId, packId);
        room.npcsWithRole(Set.of(NpcRoster.Role.NEWSAGENT)).stream().findFirst().ifPresent(newsagent ->
                room.npcSay(newsagent, NpcDialog.packSold(session.user().username(), purchase.name(), random), userId));
        session.send(Map.of("type", "pack_bought", "packId", purchase.packId(), "name", purchase.name(),
                "owned", purchase.owned(), "gold", purchase.gold()));
    }

    private static void reply(HotelSession session, String errorCode) {
        if (errorCode != null) session.send(error(errorCode));
    }

    private void chat(HotelSession session, RoomInstance room, String style, String text) {
        ChatFilter.Result result = session.chatFilter().check(text);
        switch (result.verdict()) {
            case OK -> room.chat(session.user().id(), result.text(), style);
            case FLOOD, MUTED -> session.send(error("chat_muted"));
            case EMPTY -> { }
        }
    }

    private void whisper(HotelSession session, RoomInstance room, String to, String text) {
        ChatFilter.Result result = session.chatFilter().check(text);
        if (result.verdict() == ChatFilter.Verdict.FLOOD || result.verdict() == ChatFilter.Verdict.MUTED) {
            session.send(error("chat_muted"));
            return;
        }
        if (result.verdict() != ChatFilter.Verdict.OK || to == null) return;
        if (!room.whisper(session.user().id(), to, result.text())) session.send(error("user_not_here"));
    }

    // ------------------------------------------------------------------ utilita'

    private static Map<String, Object> error(String code) {
        return Map.of("type", "error", "code", code);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    /** Tipi di evento dei minigiochi che si inoltrano alla stanza, e i campi ammessi. */
    private static final java.util.Set<String> FX_KINDS = java.util.Set.of("dribble", "shoot", "aim", "roll", "reset", "ball",
            "hole", "curl", "hit", "balls", "cue", "cast", "bite", "catch", "reel", "sing", "lap", "kart");
    private static final List<String> FX_NUMBERS = List.of("made", "swish", "off", "x", "power", "u", "v", "arm", "dx", "dy");
    /** Bilie del biliardo: coppie (x, y) da 0 a 1 sul tavolo, -1 per quelle in buca. Al massimo 16 bilie. */
    private static final int MAX_BALL_NUMBERS = 32;

    /**
     * Evento di un minigioco ripulito: solo il tipo, qualche numero entro limiti ragionevoli e le
     * liste di birilli (indici da 0 a 9). Qualunque altra cosa si scarta.
     */
    static Map<String, Object> minigameFx(JsonNode node) {
        if (node == null || !node.isObject()) return null;
        String kind = text(node, "kind");
        if (kind == null || !FX_KINDS.contains(kind)) return null;
        Map<String, Object> fx = new java.util.LinkedHashMap<>();
        fx.put("kind", kind);
        for (String field : FX_NUMBERS) {
            JsonNode value = node.get(field);
            if (value != null && value.isNumber()) fx.put(field, Math.max(-100.0, Math.min(100.0, value.asDouble())));
        }
        JsonNode balls = node.get("balls");
        if (balls != null && balls.isArray() && balls.size() <= MAX_BALL_NUMBERS) {
            List<Double> values = new java.util.ArrayList<>();
            for (JsonNode value : balls) {
                if (!value.isNumber()) return null;
                values.add(Math.round(Math.max(-1.0, Math.min(1.0, value.asDouble())) * 1000) / 1000.0);
            }
            fx.put("balls", values);
        }
        for (String field : List.of("fallen", "standing")) {
            JsonNode list = node.get(field);
            if (list == null || !list.isArray()) continue;
            List<Integer> pins = new java.util.ArrayList<>();
            for (JsonNode pin : list) {
                if (pin.isInt() && pin.asInt() >= 0 && pin.asInt() <= 9 && !pins.contains(pin.asInt())) pins.add(pin.asInt());
            }
            fx.put(field, pins);
        }
        return fx;
    }

    private static int integer(JsonNode node, String field) {
        return node.path(field).asInt(-1);
    }

    private static UUID uuid(JsonNode node, String field) {
        try {
            String value = text(node, field);
            return value == null ? null : UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
