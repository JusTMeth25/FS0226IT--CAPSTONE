package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelSession;
import com.capstone.vinyldex.hotel.RoomInstance;
import com.capstone.vinyldex.hotel.RoomRegistry;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Il tavolo del poker del casino (Texas Hold'em, PokerTable): ci si siede con le fiches del
 * casino, si gioca con gli altri giocatori e con gli NPC, ci si alza con le fiches che restano.
 *
 * Il tavolo gira su un orologio suo (ogni 300 ms): fa giocare gli NPC, scadere i turni e partire
 * le mani. A ogni cambiamento lo stato va a tutti quelli che sono nella stanza del casino, ognuno
 * con le sue carte (le carte degli altri restano coperte fino allo showdown).
 */
@Service
public class PokerService implements PokerTable.Listener {

    private static final Logger log = LoggerFactory.getLogger(PokerService.class);

    private final CasinoService casino;
    private final RoomRegistry registry;
    private final PokerTable table;
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "poker-table");
        t.setDaemon(true);
        return t;
    });

    public PokerService(CasinoService casino, RoomRegistry registry) {
        this.casino = casino;
        this.registry = registry;
        this.table = new PokerTable("holdem", "Texas Hold'em 5/10", new SecureRandom(), this);
        clock.scheduleAtFixedRate(this::tick, 1, 300, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        try {
            if (table.tick(System.currentTimeMillis())) broadcast();
        } catch (Exception ex) {
            log.warn("Tavolo del poker: errore nel giro", ex);
        }
    }

    private void checkInCasino(UUID userId) {
        HotelSession session = registry.sessionOf(userId);
        if (session == null || !CasinoService.CASINO_ROOM.equals(session.roomId())) throw ApiException.forbidden("casino_not_here");
    }

    /** Si siede con `buyIn` fiches (da 100 a 2000), scalate subito. null se seduto, altrimenti l'errore. */
    public String join(UUID userId, String username, String look, int buyIn) {
        try {
            checkInCasino(userId);
        } catch (ApiException ex) {
            return "casino_not_here";
        }
        if (buyIn < PokerTable.MIN_BUY_IN || buyIn > PokerTable.MAX_BUY_IN) return "poker_bad_buy_in";
        if (table.isSeated(userId.toString())) return "poker_already_seated";
        try {
            casino.tableChips(userId, -buyIn);
        } catch (ApiException ex) {
            return "casino_not_enough_chips";
        }
        String error = table.sit(userId.toString(), username, look, buyIn, System.currentTimeMillis());
        if (error != null) {
            casino.tableChips(userId, buyIn);
            return error;
        }
        broadcast();
        return null;
    }

    public String leave(UUID userId) {
        table.stand(userId.toString(), System.currentTimeMillis());
        broadcast();
        return null;
    }

    public String action(UUID userId, String action, int amount) {
        String error = table.act(userId.toString(), action, amount, System.currentTimeMillis());
        if (error == null) broadcast();
        return error;
    }

    /** Lo stato del tavolo solo a chi lo chiede (quando apre il tavolo del poker). */
    public void watch(HotelSession session) {
        session.send(message(session.user().id()));
    }

    /** Chi esce dal casino o si disconnette si alza dal tavolo. */
    public void userLeft(UUID userId) {
        if (table.isSeated(userId.toString())) leave(userId);
    }

    private Map<String, Object> message(UUID viewer) {
        return Map.of("type", "poker_state", "table", table.view(viewer.toString(), System.currentTimeMillis()));
    }

    private void broadcast() {
        RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
        if (room == null) return;
        for (UUID id : room.humanIds()) {
            HotelSession session = registry.sessionOf(id);
            if (session != null) session.send(message(id));
        }
    }

    @Override
    public void changed() {
        broadcast();
    }

    @Override
    public void cashOut(String playerId, int chips, String reason) {
        if (playerId.startsWith("bot:")) return;
        UUID userId = UUID.fromString(playerId);
        try {
            if (chips > 0) casino.tableChips(userId, chips);
        } catch (Exception ex) {
            log.error("Poker: fiches non restituite a {} ({})", playerId, chips, ex);
        }
        HotelSession session = registry.sessionOf(userId);
        if (session != null) {
            session.send(Map.of("type", "poker_cashout", "chips", chips, "reason", reason));
        }
    }

    /** Il server si ferma: chi e' seduto riprende le sue fiches (anche quelle della mano in corso). */
    @PreDestroy
    void shutdown() {
        clock.shutdownNow();
        table.humanStacks().forEach((id, chips) -> {
            try {
                if (chips > 0) casino.tableChips(UUID.fromString(id), chips);
            } catch (Exception ex) {
                log.error("Poker: fiches non restituite a {} ({}) alla chiusura", id, chips, ex);
            }
        });
    }
}
