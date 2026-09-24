package com.capstone.vinyldex.hotel;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Stanze vive e connessioni aperte.
 *
 * Una stanza viene creata in memoria quando entra il primo visitatore e scaricata dopo un
 * minuto che e' vuota. Un solo thread fa avanzare tutte le stanze ogni 500 ms: con le poche
 * decine di utenti di un capstone basta e avanza, e un solo thread evita di dover ragionare su
 * tick concorrenti della stessa stanza.
 *
 * Ogni utente ha al massimo una connessione: se ne apre un'altra (nuova scheda, riconnessione)
 * la precedente viene chiusa, come su Habbo.
 */
@Component
public class RoomRegistry {

    private static final Logger log = LoggerFactory.getLogger(RoomRegistry.class);

    static final long TICK_MILLIS = 500;
    private static final long UNLOAD_AFTER_MILLIS = 60_000;
    private static final long IDLE_KICK_MILLIS = 30 * 60_000;

    /** Codice di chiusura per chi viene sostituito da una connessione piu' recente. */
    public static final CloseStatus REPLACED = new CloseStatus(4001, "replaced");
    public static final CloseStatus IDLE = new CloseStatus(4002, "idle");

    private final Map<UUID, RoomInstance> rooms = new ConcurrentHashMap<>();
    private final Map<UUID, HotelSession> sessionsByUser = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "hotel-tick");
        thread.setDaemon(true);
        return thread;
    });

    public RoomRegistry() {
        scheduler.scheduleAtFixedRate(this::safeTick, TICK_MILLIS, TICK_MILLIS, TimeUnit.MILLISECONDS);
    }

    /**
     * Fa entrare la sessione nella stanza, creandola in memoria se serve.
     *
     * Creazione e ingresso avvengono dentro compute: cosi' il tick non puo' scaricare la stanza
     * perche' vuota nello stesso istante in cui qualcuno ci sta entrando. I dati vanno letti dal
     * database prima (loader), mai dentro compute.
     */
    public RoomInstance.JoinResult join(HotelSession session, RoomData data, List<RoomItemView> items) {
        leaveRoom(session);
        RoomInstance.JoinResult[] result = new RoomInstance.JoinResult[1];
        rooms.compute(data.id(), (id, existing) -> {
            RoomInstance room = existing != null ? existing : new RoomInstance(data, items);
            result[0] = room.join(session);
            return room;
        });
        return result[0];
    }

    public boolean isLoaded(UUID roomId) {
        return rooms.containsKey(roomId);
    }

    public RoomInstance get(UUID roomId) {
        return roomId == null ? null : rooms.get(roomId);
    }

    public int userCount(UUID roomId) {
        RoomInstance room = rooms.get(roomId);
        return room == null ? 0 : room.userCount();
    }

    /** Registra la connessione dell'utente e chiude quella precedente, se c'era. */
    public void register(HotelSession session) {
        HotelSession previous = sessionsByUser.put(session.user().id(), session);
        if (previous != null && previous != session) {
            leaveRoom(previous);
            previous.close(REPLACED);
        }
    }

    public void unregister(HotelSession session) {
        leaveRoom(session);
        if (session.user() != null) sessionsByUser.remove(session.user().id(), session);
    }

    public void leaveRoom(HotelSession session) {
        RoomInstance room = get(session.roomId());
        if (room != null && session.user() != null) room.leave(session.user().id());
        session.setRoomId(null);
    }

    public ScheduledFuture<?> schedule(Runnable task, long delayMillis) {
        return scheduler.schedule(task, delayMillis, TimeUnit.MILLISECONDS);
    }

    private void safeTick() {
        try {
            long now = System.currentTimeMillis();
            rooms.values().forEach(RoomInstance::tick);
            rooms.keySet().forEach(id -> rooms.computeIfPresent(id,
                    (key, room) -> now - room.emptySince() > UNLOAD_AFTER_MILLIS ? null : room));
            sessionsByUser.values().forEach(s -> {
                if (now - s.lastActivity() > IDLE_KICK_MILLIS) {
                    leaveRoom(s);
                    s.close(IDLE);
                }
            });
        } catch (RuntimeException ex) {
            // Un errore in una stanza non deve fermare il tick di tutte le altre.
            log.error("Errore nel tick dell'hotel", ex);
        }
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }
}
