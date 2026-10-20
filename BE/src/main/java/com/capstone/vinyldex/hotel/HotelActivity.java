package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.service.UserActivity;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Chi e' impegnato in questo momento, per l'hotel:
 * - in una sfida di carte (anche contro un NPC dell'hotel) o in una partita del torneo;
 * - iscritto a un torneo in corso (fra un turno e l'altro gioca ancora);
 * - in un minigioco della stanza;
 * - in una battaglia contro gli NPC della pagina Battaglie (la segnala il client con
 *   POST /api/battles/activity: la gioca lui, il server non la vede).
 *
 * I servizi sono presi pigri (@Lazy): TradeService che usa questa classe e' a sua volta usato da
 * pezzi dell'hotel, e senza si creerebbe un giro di dipendenze all'avvio.
 */
@Component
public class HotelActivity implements UserActivity {

    private final PvpService pvp;
    private final CardTournamentService tournament;
    private final RoomRegistry registry;
    /** Battaglie contro gli NPC in corso: fino a quando contano (al massimo 20 minuti). */
    private final Map<UUID, Long> battles = new ConcurrentHashMap<>();
    private static final long BATTLE_MAX_MILLIS = 20 * 60_000L;

    public HotelActivity(@Lazy PvpService pvp, @Lazy CardTournamentService tournament, @Lazy RoomRegistry registry) {
        this.pvp = pvp;
        this.tournament = tournament;
        this.registry = registry;
    }

    @Override
    public boolean isBusy(UUID userId) {
        if (userId == null) return false;
        if (pvp.isBusy(userId) || tournament.isPlaying(userId)) return true;
        Long until = battles.get(userId);
        if (until != null && until > System.currentTimeMillis()) return true;
        HotelSession session = registry.sessionOf(userId);
        if (session == null) return false;
        RoomInstance room = session.roomId() == null ? null : registry.get(session.roomId());
        return room != null && room.inMinigame(userId);
    }

    @Override
    public void setInBattle(UUID userId, boolean inBattle) {
        long now = System.currentTimeMillis();
        battles.values().removeIf(until -> until <= now);
        if (inBattle) battles.put(userId, now + BATTLE_MAX_MILLIS);
        else battles.remove(userId);
    }
}
