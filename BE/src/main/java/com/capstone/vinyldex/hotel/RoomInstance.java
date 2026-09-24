package com.capstone.vinyldex.hotel;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Una stanza "viva": chi c'e', dove si trova, dove sta andando.
 *
 * Il server decide ogni posizione. Il client chiede di andare in una casella, qui si calcola
 * il percorso e lo si manda a tutti; poi il tick (ogni 500 ms, come su Habbo) fa avanzare
 * l'avatar di una casella alla volta. I client animano lo stesso percorso alla stessa velocita',
 * quindi quello che vedono coincide con lo stato del server.
 *
 * Tutti i metodi pubblici sono synchronized: comandi dei giocatori e tick arrivano da thread
 * diversi e toccano le stesse strutture.
 */
public class RoomInstance {

    /** Direzioni come su Habbo: 0 nord (y-1), 2 est (x+1), 4 sud (y+1), 6 ovest (x-1). */
    private static final int[][] DIRECTION_DELTAS = {
            {0, -1}, {1, -1}, {1, 0}, {1, 1}, {0, 1}, {-1, 1}, {-1, 0}, {-1, -1}};

    private static final Set<String> EMOTES = Set.of("wave", "blow", "laugh");
    private static final Set<String> STATUSES = Set.of("idle", "dance", "sit");

    private final RoomData data;
    private final RoomLayout layout;
    private final Map<UUID, Occupant> occupants = new LinkedHashMap<>();
    private long emptySince = System.currentTimeMillis();

    private static final class Occupant {
        final HotelSession session;
        HotelUser user;
        int x;
        int y;
        int z;
        int dir;
        String status = "idle";
        final Deque<Pathfinder.Step> path = new ArrayDeque<>();
        int targetX;
        int targetY;

        Occupant(HotelSession session, int x, int y, int z, int dir) {
            this.session = session;
            this.user = session.user();
            this.x = x;
            this.y = y;
            this.z = z;
            this.dir = dir;
            this.targetX = x;
            this.targetY = y;
        }
    }

    public RoomInstance(RoomData data) {
        this.data = data;
        this.layout = RoomLayout.parse(data.layout());
    }

    public RoomData data() {
        return data;
    }

    public synchronized int userCount() {
        return occupants.size();
    }

    public synchronized long emptySince() {
        return occupants.isEmpty() ? emptySince : Long.MAX_VALUE;
    }

    // ------------------------------------------------------------------ ingresso e uscita

    public enum JoinResult { OK, FULL, CLOSED }

    public synchronized JoinResult join(HotelSession session) {
        UUID userId = session.user().id();
        boolean owner = data.isOwner(userId);
        if (!owner && "closed".equals(data.doorMode())) return JoinResult.CLOSED;
        if (!occupants.containsKey(userId) && occupants.size() >= data.maxUsers() && !owner) return JoinResult.FULL;

        occupants.remove(userId);
        Occupant occupant = new Occupant(session, data.doorX(), data.doorY(),
                Math.max(0, layout.heightAt(data.doorX(), data.doorY())), data.doorDir());
        occupants.put(userId, occupant);
        session.setRoomId(data.id());

        session.send(roomState(userId));
        broadcastExcept(userId, Map.of("type", "user_joined", "user", view(occupant)));
        return JoinResult.OK;
    }

    public synchronized void leave(UUID userId) {
        Occupant removed = occupants.remove(userId);
        if (removed == null) return;
        if (occupants.isEmpty()) emptySince = System.currentTimeMillis();
        broadcast(Map.of("type", "user_left", "id", userId));
    }

    // ------------------------------------------------------------------ movimento

    public synchronized void move(UUID userId, int toX, int toY) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null) return;

        List<Pathfinder.Step> steps = Pathfinder.find(layout, occupant.x, occupant.y, toX, toY,
                (x, y) -> isOccupiedByOther(userId, x, y));
        if (steps.isEmpty()) return;

        occupant.path.clear();
        occupant.path.addAll(steps);
        occupant.targetX = toX;
        occupant.targetY = toY;
        if (!"idle".equals(occupant.status)) {
            occupant.status = "idle";
            broadcast(statusMessage(occupant));
        }
        broadcast(pathMessage(occupant));
    }

    /** Un passo per ogni avatar in cammino. Chiamato dal RoomRegistry ogni 500 ms. */
    public synchronized void tick() {
        for (Occupant occupant : occupants.values()) {
            Pathfinder.Step next = occupant.path.peekFirst();
            if (next == null) continue;

            // Qualcuno si e' fermato sulla prossima casella: si ricalcola il resto del percorso.
            if (isOccupiedByOther(occupant.user.id(), next.x(), next.y())) {
                List<Pathfinder.Step> detour = Pathfinder.find(layout, occupant.x, occupant.y,
                        occupant.targetX, occupant.targetY, (x, y) -> isOccupiedByOther(occupant.user.id(), x, y));
                occupant.path.clear();
                occupant.path.addAll(detour);
                if (detour.isEmpty()) {
                    // Nessuna strada libera: ci si ferma qui e si libera la destinazione prenotata.
                    occupant.targetX = occupant.x;
                    occupant.targetY = occupant.y;
                }
                broadcast(pathMessage(occupant));
                next = occupant.path.peekFirst();
                if (next == null) continue;
            }

            occupant.path.pollFirst();
            occupant.dir = directionBetween(occupant.x, occupant.y, next.x(), next.y(), occupant.dir);
            occupant.x = next.x();
            occupant.y = next.y();
            occupant.z = next.z();
        }
    }

    /**
     * Occupata da un altro avatar: sia dove si trova ora, sia dove e' diretto. Contare anche la
     * destinazione evita che due persone si fermino sulla stessa casella partendo insieme.
     */
    private boolean isOccupiedByOther(UUID userId, int x, int y) {
        for (Occupant other : occupants.values()) {
            if (other.user.id().equals(userId)) continue;
            if ((other.x == x && other.y == y) || (other.targetX == x && other.targetY == y)) return true;
        }
        return false;
    }

    static int directionBetween(int fromX, int fromY, int toX, int toY, int fallback) {
        int dx = Integer.signum(toX - fromX);
        int dy = Integer.signum(toY - fromY);
        for (int d = 0; d < DIRECTION_DELTAS.length; d++) {
            if (DIRECTION_DELTAS[d][0] == dx && DIRECTION_DELTAS[d][1] == dy) return d;
        }
        return fallback;
    }

    // ------------------------------------------------------------------ chat ed espressioni

    public synchronized void chat(UUID userId, String text, String style) {
        if (!occupants.containsKey(userId)) return;
        broadcast(Map.of("type", "chat", "id", userId, "text", text, "style", style));
    }

    /** Sussurro: arriva solo al destinatario e a chi lo scrive. */
    public synchronized boolean whisper(UUID fromId, String toUsername, String text) {
        Occupant from = occupants.get(fromId);
        if (from == null) return false;
        Occupant to = occupants.values().stream()
                .filter(o -> o.user.username().equalsIgnoreCase(toUsername))
                .findFirst().orElse(null);
        if (to == null) return false;

        Map<String, Object> message = Map.of("type", "chat", "id", fromId, "text", text, "style", "whisper",
                "to", to.user.username());
        from.session.send(message);
        if (to != from) to.session.send(message);
        return true;
    }

    public synchronized void typing(UUID userId, boolean on) {
        if (!occupants.containsKey(userId)) return;
        broadcastExcept(userId, Map.of("type", "typing", "id", userId, "on", on));
    }

    public synchronized void emote(UUID userId, String emote) {
        if (!occupants.containsKey(userId) || !EMOTES.contains(emote)) return;
        broadcast(Map.of("type", "emote", "id", userId, "emote", emote));
    }

    /** Stato che dura: ballare o stare seduti, finche' non ci si muove. */
    public synchronized void setStatus(UUID userId, String status) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null || !STATUSES.contains(status) || !occupant.path.isEmpty()) return;
        occupant.status = status;
        broadcast(statusMessage(occupant));
    }

    /** Aspetto o livello cambiati (guardaroba, level up): tutti i presenti vedono la novita'. */
    public synchronized void updateUser(HotelUser user) {
        Occupant occupant = occupants.get(user.id());
        if (occupant == null) return;
        occupant.user = user;
        broadcast(Map.of("type", "user_update", "user", user));
    }

    // ------------------------------------------------------------------ messaggi

    private Map<String, Object> roomState(UUID you) {
        List<Map<String, Object>> users = new ArrayList<>();
        occupants.values().forEach(o -> users.add(view(o)));

        Map<String, Object> room = new LinkedHashMap<>();
        room.put("id", data.id());
        room.put("name", data.name());
        room.put("description", data.description());
        room.put("ownerName", data.ownerName());
        room.put("layout", data.layout());
        room.put("door", Map.of("x", data.doorX(), "y", data.doorY(), "dir", data.doorDir()));
        room.put("floorStyle", data.floorStyle());
        room.put("wallStyle", data.wallStyle());
        room.put("isPublic", data.publicRoom());

        return Map.of("type", "room_state", "room", room, "users", users, "you", you);
    }

    private static Map<String, Object> view(Occupant o) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", o.user.id());
        view.put("username", o.user.username());
        view.put("look", o.user.look());
        view.put("level", o.user.level());
        view.put("x", o.x);
        view.put("y", o.y);
        view.put("z", o.z);
        view.put("dir", o.dir);
        view.put("status", o.status);
        List<int[]> path = new ArrayList<>();
        o.path.forEach(s -> path.add(new int[]{s.x(), s.y(), s.z()}));
        view.put("path", path);
        return view;
    }

    private static Map<String, Object> pathMessage(Occupant o) {
        List<int[]> path = new ArrayList<>();
        o.path.forEach(s -> path.add(new int[]{s.x(), s.y(), s.z()}));
        return Map.of("type", "user_path", "id", o.user.id(), "from", new int[]{o.x, o.y, o.z}, "path", path);
    }

    private static Map<String, Object> statusMessage(Occupant o) {
        return Map.of("type", "user_status", "id", o.user.id(), "status", o.status, "dir", o.dir);
    }

    private void broadcast(Object message) {
        occupants.values().forEach(o -> o.session.send(message));
    }

    private void broadcastExcept(UUID userId, Object message) {
        occupants.values().forEach(o -> {
            if (!o.user.id().equals(userId)) o.session.send(message);
        });
    }
}
