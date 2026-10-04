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
 * Il Bingo del casino (BingoGame): le cartelle si comprano con le fiches, l'estrazione la sentono
 * tutti quelli che sono nella stanza del casino, i premi arrivano subito nel portafoglio.
 */
@Service
public class BingoService implements BingoGame.Listener {

    private static final Logger log = LoggerFactory.getLogger(BingoService.class);

    private final CasinoService casino;
    private final RoomRegistry registry;
    private final BingoGame game;
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "bingo-caller");
        t.setDaemon(true);
        return t;
    });

    public BingoService(CasinoService casino, RoomRegistry registry) {
        this.casino = casino;
        this.registry = registry;
        this.game = new BingoGame(new SecureRandom(), this);
        clock.scheduleAtFixedRate(this::tick, 1, 250, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        try {
            if (game.tick(System.currentTimeMillis())) broadcast();
        } catch (Exception ex) {
            log.warn("Bingo: errore nell'estrazione", ex);
        }
    }

    /** Compra `count` cartelle: le fiches si scalano subito. null se va bene, altrimenti l'errore. */
    public String buy(UUID userId, String username, int count) {
        HotelSession session = registry.sessionOf(userId);
        if (session == null || !CasinoService.CASINO_ROOM.equals(session.roomId())) return "casino_not_here";
        if (count < 1 || count > BingoGame.MAX_CARDS) return "bingo_too_many";
        int cost = count * BingoGame.CARD_PRICE;
        try {
            casino.tableChips(userId, -cost);
        } catch (ApiException ex) {
            return "casino_not_enough_chips";
        }
        String error = game.buy(userId.toString(), username, count, System.currentTimeMillis());
        if (error != null) {
            casino.tableChips(userId, cost);
            return error;
        }
        broadcast();
        return null;
    }

    public void watch(HotelSession session) {
        session.send(message(session.user().id()));
    }

    /** Chi esce dal casino durante la vendita riprende le fiches; a estrazione iniziata le cartelle giocano lo stesso. */
    public void userLeft(UUID userId) {
        int refund = game.refund(userId.toString());
        if (refund > 0) {
            try {
                casino.tableChips(userId, refund);
            } catch (Exception ex) {
                log.error("Bingo: rimborso non riuscito a {} ({})", userId, refund, ex);
            }
            broadcast();
        }
    }

    private Map<String, Object> message(UUID viewer) {
        return Map.of("type", "bingo_state", "bingo", game.view(viewer.toString(), System.currentTimeMillis()));
    }

    private void broadcast() {
        RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
        if (room == null) return;
        for (UUID id : room.humanIds()) {
            HotelSession session = registry.sessionOf(id);
            if (session != null) session.send(message(id));
        }
    }

    /** Cassa del banco: le cartelle degli NPC entrano, i loro premi escono. */
    private CasinoBank bank;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setBank(CasinoBank bank) {
        this.bank = bank;
    }

    @Override
    public void house(int chips) {
        if (bank != null) bank.record(CasinoService.Currency.CHIPS, chips);
    }

    @Override
    public void pay(String playerId, int chips, String reason) {
        UUID userId = UUID.fromString(playerId);
        try {
            casino.tableChips(userId, chips);
        } catch (Exception ex) {
            log.error("Bingo: premio non pagato a {} ({})", playerId, chips, ex);
            return;
        }
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(Map.of("type", "bingo_win", "chips", chips, "prize", reason));
        RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
        if (room != null && chips >= 100 && session != null) {
            room.announce(Map.of("type", "casino_win", "by", session.user().username(), "game", "Bingo (" + reason + ")",
                    "amount", chips, "currency", "chips"));
        }
    }

    /** Il server si ferma durante la vendita: le cartelle non giocate si rimborsano. */
    @PreDestroy
    void shutdown() {
        clock.shutdownNow();
        game.refundAll().forEach((id, chips) -> {
            try {
                casino.tableChips(UUID.fromString(id), chips);
            } catch (Exception ex) {
                log.error("Bingo: rimborso non riuscito a {} ({}) alla chiusura", id, chips, ex);
            }
        });
    }
}
