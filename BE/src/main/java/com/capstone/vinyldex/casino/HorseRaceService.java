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
 * L'ippodromo del casino (HorseRace): si punta con le fiches, la corsa la vedono tutti quelli
 * che sono nel casino, le vincite arrivano nel portafoglio appena i cavalli tagliano il traguardo.
 */
@Service
public class HorseRaceService implements HorseRace.Listener {

    private static final Logger log = LoggerFactory.getLogger(HorseRaceService.class);

    private final CasinoService casino;
    private final RoomRegistry registry;
    private final HorseRace race;
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "horse-race");
        t.setDaemon(true);
        return t;
    });

    public HorseRaceService(CasinoService casino, RoomRegistry registry) {
        this.casino = casino;
        this.registry = registry;
        this.race = new HorseRace(new SecureRandom(), this);
        clock.scheduleAtFixedRate(this::tick, 1, 250, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        try {
            RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
            race.setAudience(room != null && !room.activePlayers().isEmpty());
            if (race.tick(System.currentTimeMillis())) broadcast();
        } catch (Exception ex) {
            log.warn("Ippodromo: errore nella corsa", ex);
        }
    }

    /** Punta: le fiches si scalano subito. null se va bene, altrimenti il codice d'errore. */
    public String bet(UUID userId, String username, String type, int[] horses, int stake) {
        HotelSession session = registry.sessionOf(userId);
        if (session == null || !CasinoService.CASINO_ROOM.equals(session.roomId())) return "casino_not_here";
        HorseRace.Type t;
        try {
            t = HorseRace.Type.valueOf(type);
        } catch (IllegalArgumentException | NullPointerException ex) {
            return "horse_bad_bet";
        }
        if (stake < HorseRace.MIN_STAKE || stake > HorseRace.MAX_STAKE) return "horse_bad_stake";
        try {
            casino.tableChips(userId, -stake);
        } catch (ApiException ex) {
            return "casino_not_enough_chips";
        }
        String error = race.bet(userId.toString(), username, t, horses, stake);
        if (error != null) {
            casino.tableChips(userId, stake);
            return error;
        }
        broadcast();
        return null;
    }

    public void watch(HotelSession session) {
        session.send(message(session.user().id()));
    }

    private Map<String, Object> message(UUID viewer) {
        return Map.of("type", "horse_state", "horse", race.view(viewer.toString(), System.currentTimeMillis()));
    }

    private void broadcast() {
        RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
        if (room == null) return;
        for (UUID id : room.humanIds()) {
            HotelSession session = registry.sessionOf(id);
            if (session != null) session.send(message(id));
        }
    }

    /** Cassa del banco: le poste degli habitue' entrano, le loro vincite escono. */
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
            log.error("Ippodromo: vincita non pagata a {} ({})", playerId, chips, ex);
            return;
        }
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(Map.of("type", "horse_win", "chips", chips, "bet", reason));
        RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
        if (room != null && chips >= 200 && session != null) {
            room.announce(Map.of("type", "casino_win", "by", session.user().username(), "game", "Ippodromo (" + reason + ")",
                    "amount", chips, "currency", "chips"));
        }
    }

    /** Il server si ferma prima dell'arrivo: le puntate aperte si rimborsano. */
    @PreDestroy
    void shutdown() {
        clock.shutdownNow();
        race.refundAll().forEach((id, chips) -> {
            try {
                casino.tableChips(UUID.fromString(id), chips);
            } catch (Exception ex) {
                log.error("Ippodromo: rimborso non riuscito a {} ({}) alla chiusura", id, chips, ex);
            }
        });
    }
}
