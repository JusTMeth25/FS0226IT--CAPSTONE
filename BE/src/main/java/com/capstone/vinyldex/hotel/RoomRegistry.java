package com.capstone.vinyldex.hotel;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;

import java.util.List;
import java.util.Map;
import java.util.Random;
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

    /** Chi da' le risposte agli NPC: il modello linguistico, se configurato. */
    private final NpcMind mind;
    /** Dove finiscono i fatti di gioco delle stanze: eventi Spring (missioni, eventi a orario...). */
    private final org.springframework.context.ApplicationEventPublisher publisher;

    public RoomRegistry(NpcMind mind, org.springframework.context.ApplicationEventPublisher publisher) {
        this.mind = mind;
        this.publisher = publisher;
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
            RoomInstance room = existing != null ? existing : newRoom(data, items);
            result[0] = room.join(session);
            return room;
        });
        return result[0];
    }

    private RoomInstance newRoom(RoomData data, List<RoomItemView> items) {
        RoomInstance room = new RoomInstance(data, items, new Random(), mind);
        room.setEvents(event -> {
            try {
                publisher.publishEvent(event);
            } catch (RuntimeException ex) {
                // Una missione non aggiornata non deve fermare la partita.
                LoggerHolder.LOG.warn("Evento dell'hotel non gestito: {}", ex.getMessage());
            }
        });
        return room;
    }

    private static final class LoggerHolder {
        static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(RoomRegistry.class);
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

    /** Tutte le connessioni aperte (una per utente), per chi cerca avversari online. */
    public List<HotelSession> onlineSessions() {
        return List.copyOf(sessionsByUser.values());
    }

    /** Connessione aperta dell'utente, oppure null se non e' online. */
    public HotelSession sessionOf(UUID userId) {
        return userId == null ? null : sessionsByUser.get(userId);
    }

    // ------------------------------------------------------------------ moderazione

    /** Ultimi messaggi della chat di tutte le stanze, per il pannello admin. */
    private final java.util.Deque<Map<String, Object>> chatLog = new java.util.ArrayDeque<>();
    private static final int CHAT_LOG_SIZE = 300;
    /** Giocatori silenziati dall'admin, fino a quando. */
    private final Map<UUID, Long> mutedUntil = new ConcurrentHashMap<>();

    public void logChat(String room, UUID userId, String username, String text, String style) {
        Map<String, Object> entry = new java.util.LinkedHashMap<>();
        entry.put("at", java.time.Instant.now().toString());
        entry.put("room", room);
        entry.put("userId", userId);
        entry.put("username", username);
        entry.put("text", text);
        entry.put("style", style);
        synchronized (chatLog) {
            chatLog.addFirst(entry);
            while (chatLog.size() > CHAT_LOG_SIZE) chatLog.removeLast();
        }
    }

    public List<Map<String, Object>> recentChat() {
        synchronized (chatLog) {
            return List.copyOf(chatLog);
        }
    }

    public void mute(UUID userId, int minutes) {
        mutedUntil.put(userId, System.currentTimeMillis() + minutes * 60_000L);
    }

    public void unmute(UUID userId) {
        mutedUntil.remove(userId);
    }

    public boolean isMuted(UUID userId) {
        Long until = mutedUntil.get(userId);
        if (until == null) return false;
        if (until < System.currentTimeMillis()) {
            mutedUntil.remove(userId);
            return false;
        }
        return true;
    }

    public Map<UUID, Long> muted() {
        return Map.copyOf(mutedUntil);
    }

    /** Manda un messaggio a tutti quelli connessi all'hotel, in qualunque stanza siano. */
    public void broadcastAll(Object message) {
        sessionsByUser.values().forEach(session -> {
            if (session.isOpen()) session.send(message);
        });
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
