package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Scambi di carte con gli NPC, in tutte le stanze pubbliche.
 *
 * Due strade: l'NPC propone (ogni tanto un ospite o uno sfidante si avvicina a un giocatore con
 * un'offerta: una sua carta doppia per una che non ha) oppure il giocatore propone, scegliendo
 * una carta della vetrina dell'NPC e una delle sue da dare in cambio. Le regole sul valore e il
 * passaggio delle carte stanno in NpcDeals; qui ci sono le offerte in attesa e i messaggi.
 */
@Service
public class NpcTradeService {

    private static final Logger log = LoggerFactory.getLogger(NpcTradeService.class);

    /** Chi scambia: gli ospiti e gli sfidanti, non chi lavora. */
    static final Set<NpcRoster.Role> TRADERS = Set.of(NpcRoster.Role.GUEST, NpcRoster.Role.FIGHTER);
    static final long OFFER_MILLIS = 45_000;
    /** Dopo un'offerta, lo stesso giocatore non ne riceve un'altra per qualche minuto. */
    private static final long OFFER_COOLDOWN_MILLIS = 5 * 60_000;

    private record PendingOffer(UUID id, UUID npcId, UUID userId, UUID roomId, String giveCode, String wantCode) {
    }

    private final RoomRegistry registry;
    private final NpcDeals deals;
    private final SecureRandom random = new SecureRandom();
    private final Map<UUID, PendingOffer> offers = new ConcurrentHashMap<>();
    private final Map<UUID, Long> offeredAt = new ConcurrentHashMap<>();

    public NpcTradeService(RoomRegistry registry, NpcDeals deals) {
        this.registry = registry;
        this.deals = deals;
    }

    /** Ogni tanto, in una stanza pubblica con giocatori, un NPC fa un'offerta a uno di loro. */
    @Scheduled(fixedDelay = 40_000, initialDelay = 45_000)
    public void spontaneousOffers() {
        long now = System.currentTimeMillis();
        for (UUID roomId : List.of(NpcRoster.LOBBY, NpcRoster.ARENA, NpcRoster.RELAX, NpcRoster.POOL, NpcRoster.NEON_BAR,
                NpcRoster.GARDEN, NpcRoster.PIZZERIA, NpcRoster.GAMES, NpcRoster.LIBRARY, NpcRoster.ROOFTOP)) {
            RoomInstance room = registry.get(roomId);
            if (room == null || random.nextInt(4) != 0) continue;
            List<UUID> players = room.activePlayers().stream()
                    .filter(id -> now - offeredAt.getOrDefault(id, 0L) > OFFER_COOLDOWN_MILLIS)
                    .filter(id -> offers.values().stream().noneMatch(o -> o.userId().equals(id)))
                    .filter(id -> deals.tradesToday(id) < NpcDeals.TRADES_PER_DAY)
                    .toList();
            List<UUID> traders = room.npcsWithRole(TRADERS);
            if (players.isEmpty() || traders.isEmpty()) continue;
            try {
                offer(room, traders.get(random.nextInt(traders.size())), players.get(random.nextInt(players.size())));
            } catch (RuntimeException ex) {
                log.warn("Offerta di scambio NPC non riuscita: {}", ex.getMessage());
            }
        }
    }

    private void offer(RoomInstance room, UUID npcId, UUID userId) {
        HotelSession session = registry.sessionOf(userId);
        HotelUser npc = room.npcUser(npcId);
        if (session == null || npc == null) return;
        NpcDeals.Offer offer = deals.makeOffer(userId, random).orElse(null);
        if (offer == null) return;
        offeredAt.put(userId, System.currentTimeMillis());

        PendingOffer pending = new PendingOffer(UUID.randomUUID(), npcId, userId, room.data().id(),
                offer.want().getCode(), offer.give().getCode());
        offers.put(pending.id(), pending);
        room.npcSay(npcId, NpcDialog.tradeOffer(session.user().username(), random), userId);
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "npc_trade_offer");
        message.put("offerId", pending.id());
        message.put("npc", Map.of("id", npcId, "username", npc.username(), "look", npc.look()));
        message.put("give", RoomItemView.CardView.from(offer.give()));
        message.put("want", RoomItemView.CardView.from(offer.want()));
        message.put("expiresIn", OFFER_MILLIS);
        session.send(message);
        registry.schedule(() -> {
            if (offers.remove(pending.id()) != null) send(userId, Map.of("type", "npc_trade_expired", "offerId", pending.id()));
        }, OFFER_MILLIS);
    }

    /** Il giocatore risponde a un'offerta dell'NPC. */
    public String reply(HotelSession session, UUID offerId, boolean accept) {
        PendingOffer offer = offerId == null ? null : offers.remove(offerId);
        UUID userId = session.user().id();
        if (offer == null || !offer.userId().equals(userId)) return "npc_trade_expired";
        RoomInstance room = registry.get(offer.roomId());
        String name = session.user().username();
        if (!accept) {
            if (room != null) room.npcSay(offer.npcId(), NpcDialog.tradeDeclined(name), userId);
            return null;
        }
        // L'utente da' la carta chiesta dall'NPC (giveCode dal suo punto di vista e' "want").
        NpcDeals.Verdict verdict = deals.trade(userId, offer.giveCode(), offer.wantCode());
        return conclude(session, room, offer.npcId(), verdict, offer.giveCode(), offer.wantCode());
    }

    /** Vetrina dell'NPC: le carte che oggi e' disposto a scambiare. */
    public String showcase(HotelSession session, UUID npcId) {
        RoomInstance room = registry.get(session.roomId());
        if (room == null || npcId == null || !TRADERS.contains(room.npcRole(npcId))) return "npc_no_trade";
        List<Card> cards = deals.showcase(npcId);
        session.send(Map.of("type", "npc_showcase", "npcId", npcId,
                "cards", cards.stream().map(c -> Map.of("card", RoomItemView.CardView.from(c), "value", NpcDeals.value(c))).toList(),
                "tradesLeft", Math.max(0, NpcDeals.TRADES_PER_DAY - deals.tradesToday(session.user().id()))));
        return null;
    }

    /** Il giocatore propone: una sua carta in cambio di una della vetrina. */
    public String propose(HotelSession session, UUID npcId, String giveCode, String wantCode) {
        RoomInstance room = registry.get(session.roomId());
        if (room == null || npcId == null || !TRADERS.contains(room.npcRole(npcId))) return "npc_no_trade";
        if (giveCode == null || wantCode == null) return "invalid_trade";
        NpcDeals.Verdict verdict = deals.propose(npcId, session.user().id(), giveCode, wantCode);
        return conclude(session, room, npcId, verdict, giveCode, wantCode);
    }

    private String conclude(HotelSession session, RoomInstance room, UUID npcId, NpcDeals.Verdict verdict,
                            String gaveCode, String gotCode) {
        UUID userId = session.user().id();
        String name = session.user().username();
        switch (verdict) {
            case ACCEPTED -> {
                if (room != null) room.npcSay(npcId, NpcDialog.tradeDone(name), userId);
                session.send(Map.of("type", "npc_trade_done", "npcId", npcId, "gave", gaveCode, "got", gotCode));
                return null;
            }
            case UNFAIR -> {
                if (room != null) room.npcSay(npcId, NpcDialog.tradeUnfair(name), userId);
                return "npc_trade_unfair";
            }
            case LIMIT -> {
                return "npc_trade_limit";
            }
            case NOT_OFFERED -> {
                return "npc_trade_not_offered";
            }
            default -> {
                return "card_not_owned";
            }
        }
    }

    private void send(UUID userId, Object message) {
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(message);
    }
}
