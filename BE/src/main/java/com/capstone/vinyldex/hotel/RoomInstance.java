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

    /** Bibite del bancone: il nome e' anche lo sprite che il client disegna in mano. */
    private static final List<String> DRINKS = List.of("cola", "juice", "coffee", "bubble");
    private static final long DRINK_MILLIS = 90_000;

    /** Brani del jukebox: il client li genera con WebAudio (src/hotel/music.js). */
    public static final int JUKEBOX_TRACKS = 4;
    private static final long JUKEBOX_COOLDOWN_MILLIS = 3_000;
    private static final Set<String> STATUSES = Set.of("idle", "dance", "sit");

    private volatile RoomData data;
    private final RoomLayout layout;
    private final Map<UUID, Occupant> occupants = new LinkedHashMap<>();
    private final Map<UUID, RoomItemView> items = new LinkedHashMap<>();
    private long emptySince = System.currentTimeMillis();

    /** Brano in corso (-1 = spento) e quando e' partito: i client lo suonano dallo stesso punto. */
    private int jukeboxTrack = -1;
    private long jukeboxStartedAt = 0;
    private long jukeboxChangedAt = 0;

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
        String handItem;
        long handItemUntil;
        /** Collegato ma su un'altra pagina del sito: gli altri lo vedono sbiadito. */
        boolean away;
        /** Mobile da usare appena si arriva (per esempio il bancone del bar). */
        UUID pendingUse;

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
        this(data, List.of());
    }

    public RoomInstance(RoomData data, List<RoomItemView> initialItems) {
        this.data = data;
        this.layout = RoomLayout.parse(data.layout());
        initialItems.forEach(item -> items.put(item.id(), item));
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
        stepInside(occupant);

        session.send(roomState(userId));
        broadcastExcept(userId, Map.of("type", "user_joined", "user", view(occupant)));
        return JoinResult.OK;
    }

    /**
     * Appena entrati si fa un passo oltre la porta, nella direzione in cui si guarda, come su
     * Habbo. Senza, chi entra comparirebbe sopra chi e' ancora fermo sulla soglia e lo coprirebbe.
     */
    private void stepInside(Occupant occupant) {
        int[] delta = DIRECTION_DELTAS[((data.doorDir() % 8) + 8) % 8];
        // Prima la casella davanti alla porta, poi quelle libere piu' vicine (fino a due passi).
        List<int[]> candidates = new ArrayList<>();
        candidates.add(new int[]{data.doorX() + delta[0], data.doorY() + delta[1]});
        for (int radius = 1; radius <= 2; radius++) {
            for (int dx = -radius; dx <= radius; dx++) {
                for (int dy = -radius; dy <= radius; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) == radius) {
                        candidates.add(new int[]{data.doorX() + dx, data.doorY() + dy});
                    }
                }
            }
        }
        UUID userId = occupant.user.id();
        for (int[] c : candidates) {
            int x = c[0];
            int y = c[1];
            if (!layout.isTile(x, y) || (x == data.doorX() && y == data.doorY())) continue;
            List<Pathfinder.Step> steps = Pathfinder.find(layout, occupant.x, occupant.y, x, y,
                    (tx, ty) -> isBlocked(userId, tx, ty, x, y));
            if (steps.isEmpty()) continue;
            occupant.path.addAll(steps);
            occupant.targetX = x;
            occupant.targetY = y;
            return;
        }
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
        // Un nuovo clic annulla l'uso rimasto in sospeso (per esempio andare al bancone).
        occupant.pendingUse = null;

        List<Pathfinder.Step> steps = Pathfinder.find(layout, occupant.x, occupant.y, toX, toY,
                (x, y) -> isBlocked(userId, x, y, toX, toY));
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
        long now = System.currentTimeMillis();
        for (Occupant occupant : occupants.values()) {
            if (occupant.handItem != null && now > occupant.handItemUntil) {
                occupant.handItem = null;
                broadcast(handMessage(occupant));
            }
        }
        for (Occupant occupant : occupants.values()) {
            Pathfinder.Step next = occupant.path.peekFirst();
            if (next == null) continue;

            // Qualcuno si e' fermato sulla casella d'arrivo: ci si ferma dove si e'.
            if (occupant.path.size() == 1 && isOccupiedByOther(occupant.user.id(), next.x(), next.y())) {
                occupant.path.clear();
                occupant.targetX = occupant.x;
                occupant.targetY = occupant.y;
                broadcast(pathMessage(occupant));
                continue;
            }

            occupant.path.pollFirst();
            occupant.dir = directionBetween(occupant.x, occupant.y, next.x(), next.y(), occupant.dir);
            occupant.x = next.x();
            occupant.y = next.y();
            occupant.z = next.z();

            if (occupant.path.isEmpty() && occupant.pendingUse != null) {
                RoomItemView target = items.get(occupant.pendingUse);
                occupant.pendingUse = null;
                if (target != null && isNextTo(occupant, target)) serveDrink(occupant, target.type());
            }

            // Arrivati su una sedia o un divano ci si siede, girati come la seduta.
            if (occupant.path.isEmpty()) {
                RoomItemView seat = floorItemAt(occupant.x, occupant.y);
                if (seat != null && seat.def().sittable()) {
                    occupant.status = "sit";
                    occupant.dir = seat.def().sitDirFor(seat.rot());
                    broadcast(statusMessage(occupant));
                }
            }
        }
    }

    /**
     * Casella non utilizzabile nel percorso verso (toX, toY).
     *
     * I mobili solidi bloccano sempre. Gli altri avatar invece si possono attraversare e
     * bloccano solo la casella d'arrivo: con avatar solidi, chi sta fermo subito dentro la porta
     * intrappolerebbe sulla soglia chiunque entri dopo di lui.
     */
    private boolean isBlocked(UUID userId, int x, int y, int toX, int toY) {
        RoomItemView item = floorItemAt(x, y);
        if (item != null && !item.def().passable()) return true;
        return x == toX && y == toY && isOccupiedByOther(userId, x, y);
    }

    /** Il mobile su quella casella; se c'e' anche un tappeto sotto, conta quello sopra. */
    private RoomItemView floorItemAt(int x, int y) {
        RoomItemView under = null;
        for (RoomItemView item : items.values()) {
            if (!item.covers(x, y)) continue;
            if (!item.def().flat()) return item;
            under = item;
        }
        return under;
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

    // ------------------------------------------------------------------ mobili

    public enum PlaceResult { OK, OUTSIDE, UNEVEN, DOOR, OCCUPIED, NO_WALL }

    /**
     * Il mobile sta in quella posizione? Controlla solo la stanza (caselle, dislivelli, porta,
     * avatar e altri mobili): proprieta' e inventario li verifica FurniService.
     *
     * @param ignoreId il mobile che si sta spostando, che non deve scontrarsi con se' stesso
     */
    public synchronized PlaceResult canPlace(FurniCatalog.FurniDef def, int x, int y, int rot, UUID ignoreId) {
        RoomData room = data;
        if (def.wall()) {
            if (!layout.isTile(x, y)) return PlaceResult.OUTSIDE;
            if (x == room.doorX() && y == room.doorY()) return PlaceResult.DOOR;
            int wallX = rot == 2 ? x - 1 : x;
            int wallY = rot == 2 ? y : y - 1;
            boolean wallThere = !layout.isTile(wallX, wallY) && !(wallX == room.doorX() && wallY == room.doorY());
            if (!wallThere) return PlaceResult.NO_WALL;
            for (RoomItemView other : items.values()) {
                if (!other.id().equals(ignoreId) && other.def().wall()
                        && other.x() == x && other.y() == y && other.rot() == rot) {
                    return PlaceResult.OCCUPIED;
                }
            }
            return PlaceResult.OK;
        }

        int height = layout.heightAt(x, y);
        for (int dx = 0; dx < def.footprintX(rot); dx++) {
            for (int dy = 0; dy < def.footprintY(rot); dy++) {
                int tx = x + dx;
                int ty = y + dy;
                if (!layout.isTile(tx, ty)) return PlaceResult.OUTSIDE;
                if (layout.heightAt(tx, ty) != height) return PlaceResult.UNEVEN;
                if (tx == room.doorX() && ty == room.doorY()) return PlaceResult.DOOR;
                for (RoomItemView other : items.values()) {
                    // Un mobile a terra e uno sopra possono condividere la casella: tavolo sul tappeto.
                    if (!other.id().equals(ignoreId) && other.covers(tx, ty)
                            && other.def().flat() == def.flat()) {
                        return PlaceResult.OCCUPIED;
                    }
                }
                if (!def.passable()) {
                    for (Occupant o : occupants.values()) {
                        if ((o.x == tx && o.y == ty) || (o.targetX == tx && o.targetY == ty)) {
                            return PlaceResult.OCCUPIED;
                        }
                    }
                }
            }
        }
        return PlaceResult.OK;
    }

    public int heightAt(int x, int y) {
        return Math.max(0, layout.heightAt(x, y));
    }

    public synchronized RoomItemView item(UUID itemId) {
        return items.get(itemId);
    }

    /** Aggiunge o aggiorna un mobile (posizionato, spostato, carta cambiata) e lo mostra a tutti. */
    public synchronized void putItem(RoomItemView item) {
        boolean existed = items.containsKey(item.id());
        items.put(item.id(), item);
        broadcast(Map.of("type", existed ? "item_updated" : "item_added", "item", item));
    }

    public synchronized void removeItem(UUID itemId) {
        if (items.remove(itemId) != null) broadcast(Map.of("type", "item_removed", "id", itemId));
    }

    /** Nome, descrizione, porta o stile cambiati dal proprietario. */
    public synchronized void updateData(RoomData updated) {
        this.data = updated;
        Map<String, Object> room = new LinkedHashMap<>();
        room.put("name", updated.name());
        room.put("description", updated.description());
        room.put("doorMode", updated.doorMode());
        room.put("maxUsers", updated.maxUsers());
        room.put("floorStyle", updated.floorStyle());
        room.put("wallStyle", updated.wallStyle());
        broadcast(Map.of("type", "room_updated", "room", room));
    }

    /** Il proprietario allontana un visitatore, che torna al navigatore. */
    public synchronized boolean kick(UUID userId) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null || data.isOwner(userId)) return false;
        occupant.session.send(Map.of("type", "kicked"));
        occupant.session.setRoomId(null);
        leave(userId);
        return true;
    }

    // ------------------------------------------------------------------ bancone, jukebox, rispetto

    /**
     * Usa un mobile della stanza. Il bancone da' una bibita: se si e' lontani ci si cammina
     * accanto e la si riceve all'arrivo. Il jukebox cambia brano.
     *
     * @return codice d'errore, oppure null se tutto e' andato bene
     */
    public synchronized String useItem(UUID userId, UUID itemId) {
        Occupant occupant = occupants.get(userId);
        RoomItemView item = itemId == null ? null : items.get(itemId);
        if (occupant == null || item == null) return "item_not_found";

        switch (item.type()) {
            case "bar_counter", "cafe_counter", "coffee_machine" -> {
                if (isNextTo(occupant, item)) {
                    serveDrink(occupant, item.type());
                    return null;
                }
                int[] spot = freeSpotNextTo(userId, item);
                if (spot == null) return "too_far";
                move(userId, spot[0], spot[1]);
                occupant.pendingUse = itemId;
                return null;
            }
            case "jukebox" -> {
                boolean mayUse = data.publicRoom() || data.isOwner(userId);
                if (!mayUse) return "not_your_room";
                return cycleJukebox();
            }
            default -> {
                return "not_usable";
            }
        }
    }

    /** Spegne il jukebox o passa al brano successivo, con una breve pausa fra un cambio e l'altro. */
    public synchronized String setJukebox(UUID userId, boolean on) {
        if (!data.publicRoom() && !data.isOwner(userId)) return "not_your_room";
        if (!on) {
            jukeboxTrack = -1;
            broadcast(jukeboxMessage());
            return null;
        }
        return cycleJukebox();
    }

    private String cycleJukebox() {
        long now = System.currentTimeMillis();
        if (now - jukeboxChangedAt < JUKEBOX_COOLDOWN_MILLIS) return "jukebox_cooldown";
        boolean hasJukebox = items.values().stream().anyMatch(i -> "jukebox".equals(i.type()));
        if (!hasJukebox) return "no_jukebox";
        jukeboxTrack = (jukeboxTrack + 1) % JUKEBOX_TRACKS;
        jukeboxStartedAt = now;
        jukeboxChangedAt = now;
        broadcast(jukeboxMessage());
        return null;
    }

    private Map<String, Object> jukeboxMessage() {
        return Map.of("type", "jukebox", "track", jukeboxTrack, "startedAt", jukeboxStartedAt,
                "serverTime", System.currentTimeMillis());
    }

    /**
     * Rimanda lo stato completo della stanza a un presente, senza farlo rientrare: serve quando
     * torna sulla pagina dell'hotel dopo aver girato per il resto del sito.
     */
    public synchronized boolean resendState(UUID userId) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null) return false;
        occupant.session.send(roomState(userId));
        return true;
    }

    /** Il giocatore e' andato su un'altra pagina del sito (o e' tornato): resta nella stanza. */
    public synchronized void setAway(UUID userId, boolean away) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null || occupant.away == away) return;
        occupant.away = away;
        broadcast(Map.of("type", "user_away", "id", userId, "away", away));
    }

    /** Messaggio a tutti i presenti, per esempio il risultato di una sfida. */
    public synchronized void announce(Map<String, Object> message) {
        broadcast(message);
    }

    /** Annuncia a tutta la stanza un rispetto dato: il client fa volare un cuore. */
    public synchronized void announceRespect(UUID fromId, UUID toId, int receivedTotal) {
        broadcast(Map.of("type", "respect", "from", fromId, "to", toId, "total", receivedTotal));
    }

    public synchronized boolean contains(UUID userId) {
        return occupants.containsKey(userId);
    }

    /** Dal bancone esce una bibita a caso, dalla macchina del caffe' sempre un caffe'. */
    private void serveDrink(Occupant occupant, String from) {
        occupant.handItem = "coffee_machine".equals(from)
                ? "coffee"
                : DRINKS.get(Math.floorMod((int) System.nanoTime(), DRINKS.size()));
        occupant.handItemUntil = System.currentTimeMillis() + DRINK_MILLIS;
        broadcast(handMessage(occupant));
    }

    /** Distanza di al massimo una casella (anche in diagonale) da una qualsiasi casella del mobile. */
    private static boolean isNextTo(Occupant occupant, RoomItemView item) {
        FurniCatalog.FurniDef def = item.def();
        int fx = def.footprintX(item.rot());
        int fy = def.footprintY(item.rot());
        int dx = occupant.x < item.x() ? item.x() - occupant.x : Math.max(0, occupant.x - (item.x() + fx - 1));
        int dy = occupant.y < item.y() ? item.y() - occupant.y : Math.max(0, occupant.y - (item.y() + fy - 1));
        return Math.max(dx, dy) <= 1;
    }

    /** Casella libera accanto al mobile, la piu' vicina a chi lo usa. */
    private int[] freeSpotNextTo(UUID userId, RoomItemView item) {
        Occupant occupant = occupants.get(userId);
        FurniCatalog.FurniDef def = item.def();
        int fx = def.footprintX(item.rot());
        int fy = def.footprintY(item.rot());
        int[] best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (int x = item.x() - 1; x <= item.x() + fx; x++) {
            for (int y = item.y() - 1; y <= item.y() + fy; y++) {
                if (item.covers(x, y) || !layout.isTile(x, y)) continue;
                if (isBlocked(userId, x, y, x, y)) continue;
                int distance = Math.abs(x - occupant.x) + Math.abs(y - occupant.y);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = new int[]{x, y};
                }
            }
        }
        return best;
    }

    private static Map<String, Object> handMessage(Occupant o) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "hand_item");
        message.put("id", o.user.id());
        message.put("item", o.handItem);
        return message;
    }

    // ------------------------------------------------------------------ utenti

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
        room.put("ownerId", data.ownerId());
        room.put("doorMode", data.doorMode());
        room.put("maxUsers", data.maxUsers());

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("type", "room_state");
        state.put("room", room);
        state.put("users", users);
        state.put("you", you);
        state.put("items", List.copyOf(items.values()));
        state.put("jukebox", Map.of("track", jukeboxTrack, "startedAt", jukeboxStartedAt));
        state.put("serverTime", System.currentTimeMillis());
        return state;
    }

    private static Map<String, Object> view(Occupant o) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", o.user.id());
        view.put("username", o.user.username());
        view.put("look", o.user.look());
        view.put("level", o.user.level());
        view.put("bestCard", o.user.bestCard());
        view.put("x", o.x);
        view.put("y", o.y);
        view.put("z", o.z);
        view.put("dir", o.dir);
        view.put("status", o.status);
        view.put("handItem", o.handItem);
        view.put("away", o.away);
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
