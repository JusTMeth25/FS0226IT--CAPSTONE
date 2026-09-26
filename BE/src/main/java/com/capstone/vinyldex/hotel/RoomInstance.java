package com.capstone.vinyldex.hotel;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

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
    /** Quanto aspetta un NPC prima di rispondere, per sembrare una persona che legge e scrive. */
    private static final long NPC_REPLY_MILLIS = 1_200;
    private static final long NPC_GREET_COOLDOWN_MILLIS = 20_000;
    /** Quanti messaggi di ogni conversazione NPC-giocatore si ricordano per il modello. */
    private static final int NPC_MEMORY_LINES = 12;
    /** Un oggetto in mano dura cinque minuti, o finche' non lo si finisce. */
    private static final long DRINK_MILLIS = 5 * 60_000;
    /** Sorsi o morsi per finire un oggetto, e pausa minima fra uno e l'altro. */
    static final int HAND_ITEM_SIPS = 3;
    private static final long SIP_PAUSE_MILLIS = 900;

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

    /** NPC: cose da dire o da fare fra poco, e quando hanno salutato chi. */
    private final Random random;
    private final List<Pending> pending = new ArrayList<>();
    private final Map<String, Long> greetedAt = new HashMap<>();
    /** Chi risponde quando ci si rivolge a un NPC: un modello linguistico, o nessuno. */
    private final NpcMind mind;
    /** Ultimi messaggi fra ogni NPC e ogni giocatore, per risposte coerenti con quanto detto. */
    private final Map<String, Deque<NpcMind.Line>> conversations = new HashMap<>();
    /** Record della stanza per ogni minigioco (si azzerano quando la stanza si svuota e si scarica). */
    private final Map<String, Minigames.Best> records = new HashMap<>();
    /** Partita di calcio, solo nelle stanze con due porte (lo stadio); altrimenti null. */
    private final FootballMatch football;
    /** Dopo un gol il pallone resta in rete un attimo, poi torna a centrocampo. */
    private static final long GOAL_PAUSE_MILLIS = 2_500;
    /** Fascia di tre ore del meteo gia' mandato ai client: quando cambia, si manda quello nuovo. */
    private long weatherSlot = HotelWeather.now().slot();

    private record Pending(long dueAt, Runnable action) {
    }

    /** Consegna in corso di un cameriere: a chi, cosa, e quante volte ha gia' provato ad arrivare. */
    private static final class Delivery {
        final UUID userId;
        final String item;
        int attempts;

        Delivery(UUID userId, String item) {
            this.userId = userId;
            this.item = item;
        }
    }

    private static final class Occupant {
        /** null per gli NPC: non hanno una connessione. */
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
        /** Quanto ne resta (sorsi, morsi, pagine) e quando si e' consumato l'ultimo. */
        int handItemLeft;
        long lastSipAt;
        /** Collegato ma su un'altra pagina del sito: gli altri lo vedono sbiadito. */
        boolean away;
        /** Mobile da usare appena si arriva (per esempio il bancone del bar). */
        UUID pendingUse;
        /** Ordinazione da ritirare arrivati dal barista: chi la prepara e cosa. */
        UUID orderFrom;
        String orderItem;
        /** Minigioco in corso su un mobile (panca, sacco, arcade...), da quando e da dove si era partiti. */
        Minigames.Game game;
        UUID gameItem;
        long gameStartedAt;
        int gameFromX;
        int gameFromY;

        /** Solo per gli NPC: chi sono, quando pensano alla prossima mossa, cosa stanno facendo. */
        NpcRoster.NpcSpec npc;
        long nextThinkAt;
        long nextChatAt;
        long sitUntil;
        Delivery delivery;

        Occupant(HotelSession session, int x, int y, int z, int dir) {
            this(session, session.user(), x, y, z, dir);
        }

        Occupant(HotelSession session, HotelUser user, int x, int y, int z, int dir) {
            this.session = session;
            this.user = user;
            this.x = x;
            this.y = y;
            this.z = z;
            this.dir = dir;
            this.targetX = x;
            this.targetY = y;
        }

        boolean isNpc() {
            return npc != null;
        }

        void send(Object message) {
            if (session != null) session.send(message);
        }
    }

    public RoomInstance(RoomData data) {
        this(data, List.of());
    }

    public RoomInstance(RoomData data, List<RoomItemView> initialItems) {
        this(data, initialItems, new Random());
    }

    RoomInstance(RoomData data, List<RoomItemView> initialItems, Random random) {
        this(data, initialItems, random, NpcMind.NONE);
    }

    RoomInstance(RoomData data, List<RoomItemView> initialItems, Random random, NpcMind mind) {
        this.data = data;
        this.layout = RoomLayout.parse(data.layout());
        this.random = random;
        this.mind = mind;
        initialItems.forEach(item -> items.put(item.id(), item));
        this.football = FootballMatch.create(items.values());
        spawnNpcs();
    }

    /** Gli NPC della stanza entrano con lei, ognuno al suo posto. */
    private void spawnNpcs() {
        long now = System.currentTimeMillis();
        for (NpcRoster.NpcSpec spec : NpcRoster.forRoom(data.id())) {
            if (!layout.isTile(spec.x(), spec.y())) continue;
            HotelUser user = new HotelUser(spec.id(data.id()), spec.name(), spec.look(), 0);
            Occupant npc = new Occupant(null, user, spec.x(), spec.y(),
                    Math.max(0, layout.heightAt(spec.x(), spec.y())), spec.dir());
            npc.npc = spec;
            npc.nextThinkAt = now + 2_000 + random.nextInt(4_000);
            npc.nextChatAt = now + 20_000 + random.nextInt(40_000);
            occupants.put(user.id(), npc);
        }
    }

    public RoomData data() {
        return data;
    }

    /** Giocatori veri presenti: gli NPC non contano ne' per la capienza ne' per il navigatore. */
    public synchronized int userCount() {
        return (int) occupants.values().stream().filter(o -> !o.isNpc()).count();
    }

    public synchronized long emptySince() {
        return userCount() == 0 ? emptySince : Long.MAX_VALUE;
    }

    public synchronized boolean isNpc(UUID id) {
        Occupant occupant = occupants.get(id);
        return occupant != null && occupant.isNpc();
    }

    // ------------------------------------------------------------------ ingresso e uscita

    public enum JoinResult { OK, FULL, CLOSED }

    public synchronized JoinResult join(HotelSession session) {
        UUID userId = session.user().id();
        boolean owner = data.isOwner(userId);
        if (!owner && "closed".equals(data.doorMode())) return JoinResult.CLOSED;
        if (!occupants.containsKey(userId) && userCount() >= data.maxUsers() && !owner) return JoinResult.FULL;

        occupants.remove(userId);
        Occupant occupant = new Occupant(session, data.doorX(), data.doorY(),
                Math.max(0, layout.heightAt(data.doorX(), data.doorY())), data.doorDir());
        occupants.put(userId, occupant);
        session.setRoomId(data.id());
        stepInside(occupant);

        session.send(roomState(userId));
        broadcastExcept(userId, Map.of("type", "user_joined", "user", view(occupant)));
        welcome(occupant);
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
        if (userCount() == 0) emptySince = System.currentTimeMillis();
        conversations.keySet().removeIf(key -> key.endsWith("/" + userId));
        broadcast(Map.of("type", "user_left", "id", userId));
    }

    // ------------------------------------------------------------------ movimento

    public synchronized void move(UUID userId, int toX, int toY) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null) return;
        // Un nuovo clic annulla l'uso rimasto in sospeso (per esempio andare al bancone) e il minigioco.
        occupant.pendingUse = null;
        if (occupant.game != null) stopGame(occupant);

        // Posto gia' preso su un divano: si va sull'altro posto libero della stessa seduta.
        int[] seat = freeSeat(userId, toX, toY);
        int destX = seat != null ? seat[0] : toX;
        int destY = seat != null ? seat[1] : toY;
        List<Pathfinder.Step> steps = Pathfinder.find(layout, occupant.x, occupant.y, destX, destY,
                (x, y) -> isBlocked(userId, x, y, destX, destY));
        if (steps.isEmpty()) return;

        occupant.path.clear();
        occupant.path.addAll(steps);
        occupant.targetX = destX;
        occupant.targetY = destY;
        if (!"idle".equals(occupant.status)) {
            occupant.status = "idle";
            broadcast(statusMessage(occupant));
        }
        broadcast(pathMessage(occupant));
    }

    /** Un passo per ogni avatar in cammino. Chiamato dal RoomRegistry ogni 500 ms. */
    public synchronized void tick() {
        long now = System.currentTimeMillis();
        HotelWeather.Weather weather = HotelWeather.now();
        if (weather.slot() != weatherSlot) {
            weatherSlot = weather.slot();
            Map<String, Object> message = new LinkedHashMap<>(weather.toMap());
            message.put("type", "weather");
            broadcast(message);
        }
        for (Occupant occupant : occupants.values()) {
            if (occupant.handItem != null && now > occupant.handItemUntil) {
                occupant.handItem = null;
                broadcast(handMessage(occupant));
            }
            // Partita lasciata a meta' (pagina chiusa, giocatore distratto): il mobile si libera.
            if (occupant.game != null && now - occupant.gameStartedAt > occupant.game.maxMillis()) stopGame(occupant);
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
            // Passando sul pallone lo si calcia nella direzione del passo.
            if (football != null) kickBall(occupant);

            if (occupant.path.isEmpty() && occupant.pendingUse != null) {
                RoomItemView target = items.get(occupant.pendingUse);
                occupant.pendingUse = null;
                Minigames.Game game = target == null ? null : Minigames.forFurni(target.type()).orElse(null);
                if (game != null && (isNextTo(occupant, target) || target.covers(occupant.x, occupant.y))) {
                    startGame(occupant, target, game);
                } else if (target != null && isNextTo(occupant, target)) {
                    serveDrink(occupant, target.type());
                }
            }
            if (occupant.path.isEmpty() && occupant.orderFrom != null) {
                Occupant barista = occupants.get(occupant.orderFrom);
                String item = occupant.orderItem;
                occupant.orderFrom = null;
                if (barista != null && distance(barista, occupant) <= 2) later(600, () -> serve(barista, occupant, item));
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
        // Gli NPC pensano solo se c'e' qualcuno a guardarli.
        if (userCount() > 0) {
            runPending(now);
            List.copyOf(occupants.values()).stream().filter(Occupant::isNpc).forEach(npc -> think(npc, now));
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

    /**
     * Se (x, y) e' un posto a sedere gia' occupato da un altro, un posto libero della stessa
     * seduta (il divano ne ha due); altrimenti null e si va dove si e' cliccato.
     */
    private int[] freeSeat(UUID userId, int x, int y) {
        RoomItemView item = floorItemAt(x, y);
        if (item == null || !item.def().sittable() || !isOccupiedByOther(userId, x, y)) return null;
        FurniCatalog.FurniDef def = item.def();
        for (int dx = 0; dx < def.footprintX(item.rot()); dx++) {
            for (int dy = 0; dy < def.footprintY(item.rot()); dy++) {
                int sx = item.x() + dx;
                int sy = item.y() + dy;
                if (!isOccupiedByOther(userId, sx, sy)) return new int[]{sx, sy};
            }
        }
        return null;
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

    // ------------------------------------------------------------------ NPC

    /**
     * Azione scelta dalla scheda di un NPC: ordinare, chiacchierare, far ballare, cambiare musica.
     *
     * @return codice d'errore, oppure null se tutto e' andato bene
     */
    public synchronized String npcAction(UUID userId, UUID npcId, String action, String item) {
        Occupant user = occupants.get(userId);
        Occupant npc = npcId == null ? null : occupants.get(npcId);
        if (user == null || user.isNpc()) return "user_not_here";
        if (npc == null || !npc.isNpc()) return "npc_not_found";
        switch (action == null ? "" : action) {
            case "order" -> order(npc, user, item, false);
            case "talk" -> {
                if (!askMind(npc, user, "(si avvicina e vuole fare due chiacchiere con te)", false)) {
                    say(npc, NpcDialog.smallTalk(npc.npc.role(), user.user.username(), random), user, false);
                }
            }
            case "help" -> say(npc, NpcDialog.help(random), user, false);
            case "dance" -> dance(npc, user, false);
            case "music" -> music(npc, user, false);
            default -> {
                return "unknown_action";
            }
        }
        return null;
    }

    /** Appena entra un giocatore, il receptionist (o il primo lavoratore della stanza) lo saluta. */
    private void welcome(Occupant user) {
        occupants.values().stream()
                .filter(o -> o.isNpc() && o.npc.role() != NpcRoster.Role.GUEST)
                .findFirst()
                .ifPresent(npc -> {
                    if (greetedRecently(npc, user)) return;
                    say(npc, NpcDialog.greeting(npc.npc.role(), user.user.username(), random), user, false, 1_800);
                });
    }

    /**
     * Un giocatore ha scritto in chat: risponde l'NPC nominato o, se nessuno e' nominato, il
     * piu' vicino che ha qualcosa da dire (il barista per le ordinazioni, chiunque per un saluto).
     */
    private void hear(Occupant user, String text) {
        List<Occupant> npcs = occupants.values().stream().filter(Occupant::isNpc).toList();
        if (npcs.isEmpty()) return;
        Occupant named = npcs.stream().filter(n -> NpcDialog.mentions(text, n.user.username())).findFirst().orElse(null);
        if (named != null) {
            respond(named, user, text, false);
            return;
        }
        NpcDialog.Intent intent = NpcDialog.intentOf(text);
        Comparator<Occupant> closest = Comparator.comparingInt(n -> distance(n, user));
        Occupant npc = switch (intent) {
            case ORDER -> npcs.stream().filter(n -> n.npc.serves()).min(closest).orElse(null);
            case MUSIC -> npcs.stream().filter(n -> n.npc.role() == NpcRoster.Role.DJ).findFirst().orElse(null);
            case HELP -> npcs.stream().filter(n -> n.npc.role() == NpcRoster.Role.RECEPTIONIST).findFirst()
                    .orElseGet(() -> npcs.stream().filter(n -> distance(n, user) <= 5).min(closest).orElse(null));
            case NONE -> null;
            default -> npcs.stream().filter(n -> distance(n, user) <= 5).min(closest).orElse(null);
        };
        if (npc != null) respond(npc, user, text, false);
    }

    /**
     * Risposta di un NPC a un messaggio (in chat o sussurrato) di un giocatore. Se c'e' un modello
     * linguistico risponde lui, tenendo conto della conversazione; le ordinazioni chiare ("un
     * caffe'") restano immediate e senza modello, e senza modello (o se sbaglia) si usano le battute.
     */
    private void respond(Occupant npc, Occupant user, String text, boolean whispered) {
        boolean clearOrder = NpcDialog.intentOf(text) == NpcDialog.Intent.ORDER && NpcDialog.requestedItem(text) != null;
        if (!clearOrder && askMind(npc, user, text, whispered)) return;
        respondWithDialog(npc, user, text, whispered, false);
    }

    /**
     * Le battute a parole chiave di NpcDialog: la risposta di sempre, e il ripiego del modello.
     * Chi si rivolge a un NPC riceve sempre una risposta: se la frase non si capisce e il modello
     * non ha risposto, l'NPC lo dice invece di cambiare discorso.
     */
    private void respondWithDialog(Occupant npc, Occupant user, String text, boolean whispered, boolean mindFailed) {
        String name = user.user.username();
        NpcRoster.Role role = npc.npc.role();
        switch (NpcDialog.intentOf(text)) {
            case ORDER -> order(npc, user, NpcDialog.requestedItem(text), false);
            case GREET -> say(npc, NpcDialog.greeting(role, name, random), user, whispered);
            case THANKS -> say(npc, NpcDialog.thanks(name, random), user, whispered);
            case DANCE -> dance(npc, user, false);
            case MUSIC -> music(npc, user, false);
            case HELP -> say(npc, NpcDialog.help(random), user, whispered);
            case BYE -> say(npc, NpcDialog.bye(name), user, whispered);
            case NONE -> say(npc, mindFailed ? NpcDialog.didntCatch(name, random) : NpcDialog.smallTalk(role, name, random),
                    user, whispered);
        }
    }

    /**
     * Passa la domanda al modello linguistico. Intanto l'NPC "sta scrivendo"; la risposta arriva
     * su un altro thread e rientra nella stanza con onMindReply.
     *
     * @return false se il modello non c'e' o non ha budget: allora si risponde con le battute
     */
    private boolean askMind(Occupant npc, Occupant user, String text, boolean whispered) {
        String key = npc.user.id() + "/" + user.user.id();
        Deque<NpcMind.Line> history = conversations.computeIfAbsent(key, k -> new ArrayDeque<>());
        List<String> present = occupants.values().stream()
                .filter(o -> o != npc && o != user)
                .map(o -> o.user.username())
                .limit(10)
                .toList();
        NpcMind.Prompt prompt = new NpcMind.Prompt(npc.user.id(), user.user.id(), npc.user.username(), npc.npc.role(),
                data.name(), data.description(), npc.npc.menu(), user.user.username(), user.handItem, present,
                jukeboxTrack >= 0, List.copyOf(history), text);
        UUID npcId = npc.user.id();
        UUID userId = user.user.id();
        // La domanda entra in memoria prima: la risposta potrebbe arrivare prima che ask() ritorni.
        remember(key, new NpcMind.Line(false, text));
        AtomicBoolean answered = new AtomicBoolean();
        boolean asked = mind.ask(prompt, reply -> {
            answered.set(true);
            onMindReply(npcId, userId, text, whispered, reply);
        });
        if (!asked) {
            history.pollLast();
            return false;
        }
        if (!answered.get()) typingOf(npc, true);
        return true;
    }

    /** Risposta del modello: la si dice (o sussurra) e si esegue l'azione, gia' controllata. */
    private synchronized void onMindReply(UUID npcId, UUID userId, String text, boolean whispered, NpcMind.Reply reply) {
        Occupant npc = occupants.get(npcId);
        Occupant user = occupants.get(userId);
        if (npc == null) return;
        typingOf(npc, false);
        if (user == null) return;
        if (reply == null) {
            respondWithDialog(npc, user, text, whispered, true);
            return;
        }
        remember(npcId + "/" + userId, new NpcMind.Line(true, reply.text()));
        say(npc, reply.text(), user, whispered, 0);
        String action = reply.action();
        if (action == null) return;
        if (action.startsWith("serve:")) order(npc, user, action.substring(6), true);
        else if ("dance".equals(action)) dance(npc, user, true);
        else if ("music".equals(action)) music(npc, user, true);
    }

    private void remember(String key, NpcMind.Line line) {
        Deque<NpcMind.Line> history = conversations.computeIfAbsent(key, k -> new ArrayDeque<>());
        history.addLast(line);
        while (history.size() > NPC_MEMORY_LINES) history.pollFirst();
    }

    private void typingOf(Occupant npc, boolean on) {
        broadcast(Map.of("type", "typing", "id", npc.user.id(), "on", on));
    }

    private boolean greetedRecently(Occupant npc, Occupant user) {
        long now = System.currentTimeMillis();
        String key = npc.user.id() + "/" + user.user.id();
        Long last = greetedAt.get(key);
        if (last != null && now - last < NPC_GREET_COOLDOWN_MILLIS) return true;
        greetedAt.put(key, now);
        return false;
    }

    /**
     * Ordinazione. Il barista (e il gelataio) serve chi gli sta vicino e fa venire al bancone
     * chi e' lontano; il cameriere invece porta da bere camminando fino al giocatore.
     */
    private void order(Occupant npc, Occupant user, String requested, boolean quiet) {
        String name = user.user.username();
        List<String> menu = npc.npc.menu();
        if (menu.isEmpty()) {
            say(npc, NpcDialog.noService(), user, false);
            return;
        }
        String item = requested == null ? menu.get(random.nextInt(menu.size())) : requested;
        if (!menu.contains(item)) {
            say(npc, NpcDialog.notOnMenu(item, menu), user, false);
            return;
        }
        if (npc.npc.role().wanders()) {
            npc.delivery = new Delivery(user.user.id(), item);
            npc.status = "idle";
            if (!quiet) say(npc, NpcDialog.onMyWay(name, item), user, false);
            later(NPC_REPLY_MILLIS, () -> walkTo(npc, user));
            return;
        }
        if (distance(npc, user) <= 2) {
            face(npc, user);
            later(NPC_REPLY_MILLIS, () -> serve(npc, user, item));
            return;
        }
        int[] spot = freeSpotNear(user.user.id(), npc.x, npc.y, 2);
        if (spot == null) {
            say(npc, NpcDialog.cantReach(name), user, false);
            return;
        }
        if (!quiet) say(npc, NpcDialog.comeCloser(name), user, false);
        move(user.user.id(), spot[0], spot[1]);
        user.orderFrom = npc.user.id();
        user.orderItem = item;
    }

    /** Consegna: l'oggetto passa in mano al giocatore, che lo vedono tutti. */
    private void serve(Occupant npc, Occupant user, String item) {
        if (!occupants.containsKey(user.user.id()) || !occupants.containsKey(npc.user.id())) return;
        face(npc, user);
        user.handItem = item;
        user.handItemLeft = HAND_ITEM_SIPS;
        user.handItemUntil = System.currentTimeMillis() + DRINK_MILLIS;
        broadcast(handMessage(user));
        say(npc, NpcDialog.served(npc.npc.role(), user.user.username(), item, random), user, false, 0);
    }

    private void dance(Occupant npc, Occupant user, boolean quiet) {
        NpcRoster.Role role = npc.npc.role();
        if (role != NpcRoster.Role.GUEST && role != NpcRoster.Role.DJ) {
            say(npc, NpcDialog.cannotDance(role), user, false);
            return;
        }
        npc.path.clear();
        npc.targetX = npc.x;
        npc.targetY = npc.y;
        npc.status = "dance";
        npc.sitUntil = System.currentTimeMillis() + 20_000;
        broadcast(statusMessage(npc));
        if (!quiet) say(npc, NpcDialog.dancing(), user, false);
    }

    private void music(Occupant npc, Occupant user, boolean quiet) {
        if (npc.npc.role() != NpcRoster.Role.DJ) {
            say(npc, NpcDialog.noDj(), user, false);
            return;
        }
        String error = cycleJukebox();
        if (error == null && !quiet) say(npc, NpcDialog.musicChange(random), user, false);
    }

    private void say(Occupant npc, String text, Occupant to, boolean whispered) {
        say(npc, text, to, whispered, NPC_REPLY_MILLIS);
    }

    /** L'NPC parla fra `delay` ms, girato verso chi gli ha parlato. Sussurrando risponde solo a lui. */
    private void say(Occupant npc, String text, Occupant to, boolean whispered, long delay) {
        // Mentre conversa con qualcuno non se ne esce con battute a caso.
        if (to != null) npc.nextChatAt = Math.max(npc.nextChatAt, System.currentTimeMillis() + 90_000);
        later(delay, () -> {
            if (!occupants.containsKey(npc.user.id())) return;
            if (to != null && occupants.containsKey(to.user.id())) face(npc, to);
            if (whispered && to != null) {
                Map<String, Object> message = Map.of("type", "chat", "id", npc.user.id(), "text", text,
                        "style", "whisper", "to", to.user.username());
                to.send(message);
            } else {
                broadcast(Map.of("type", "chat", "id", npc.user.id(), "text", text, "style", "normal"));
            }
        });
    }

    private void later(long delay, Runnable action) {
        if (delay <= 0) {
            action.run();
            return;
        }
        pending.add(new Pending(System.currentTimeMillis() + delay, action));
    }

    private void runPending(long now) {
        List<Pending> due = pending.stream().filter(p -> p.dueAt() <= now).toList();
        pending.removeAll(due);
        due.forEach(p -> p.action().run());
    }

    /** Si gira verso qualcuno senza muoversi. Da seduti resta rivolto come la seduta. */
    private void face(Occupant npc, Occupant target) {
        if (!"idle".equals(npc.status) || !npc.path.isEmpty()) return;
        int dir = directionBetween(npc.x, npc.y, target.x, target.y, npc.dir);
        if (dir == npc.dir) return;
        npc.dir = dir;
        broadcast(statusMessage(npc));
    }

    /** Il cameriere va accanto al giocatore da servire. */
    private void walkTo(Occupant npc, Occupant user) {
        int[] spot = freeSpotNear(npc.user.id(), user.x, user.y, 1);
        if (spot == null) {
            npc.delivery = null;
            say(npc, NpcDialog.cantReach(user.user.username()), user, false, 0);
            return;
        }
        move(npc.user.id(), spot[0], spot[1]);
    }

    /**
     * Una mossa per NPC a ogni tick: consegne da finire, ritorno al proprio posto, passeggiate,
     * sedute, balli quando suona il jukebox e ogni tanto una battuta.
     */
    private void think(Occupant npc, long now) {
        NpcRoster.NpcSpec spec = npc.npc;
        if (npc.delivery != null) {
            if (!npc.path.isEmpty()) return;
            Occupant user = occupants.get(npc.delivery.userId);
            if (user == null) {
                npc.delivery = null;
            } else if (distance(npc, user) <= 1) {
                String item = npc.delivery.item;
                npc.delivery = null;
                serve(npc, user, item);
                npc.nextThinkAt = now + 4_000;
            } else if (++npc.delivery.attempts > 6) {
                npc.delivery = null;
                say(npc, NpcDialog.cantReach(user.user.username()), user, false, 0);
            } else {
                walkTo(npc, user);
            }
            return;
        }
        if (now >= npc.nextChatAt) {
            npc.nextChatAt = now + 60_000 + random.nextInt(60_000);
            // Ogni tanto si parla del tempo che fa fuori.
            String line = random.nextInt(4) == 0 ? HotelWeather.now().remark() : NpcDialog.idle(spec.role(), random);
            say(npc, line, null, false, 0);
        }
        if (spec.role() == NpcRoster.Role.FOOTBALLER && football != null) {
            playFootball(npc, now);
            return;
        }
        if (now < npc.nextThinkAt || !npc.path.isEmpty()) return;
        npc.nextThinkAt = now + 4_000 + random.nextInt(6_000);

        // Balla chi e' ospite o DJ quando c'e' musica; smette quando si spegne.
        boolean music = jukeboxTrack >= 0;
        if ("dance".equals(npc.status)) {
            if (!music && now > npc.sitUntil) {
                npc.status = "idle";
                broadcast(statusMessage(npc));
            }
            return;
        }
        if (music && (spec.role() == NpcRoster.Role.GUEST || spec.role() == NpcRoster.Role.DJ) && random.nextInt(3) == 0) {
            npc.status = "dance";
            broadcast(statusMessage(npc));
            return;
        }

        if (!spec.role().wanders()) {
            // I lavoratori tornano al loro posto, rivolti come all'inizio.
            if (npc.x != spec.x() || npc.y != spec.y()) {
                move(npc.user.id(), spec.x(), spec.y());
            } else if (npc.dir != spec.dir() && "idle".equals(npc.status)) {
                npc.dir = spec.dir();
                broadcast(statusMessage(npc));
            }
            return;
        }
        if ("sit".equals(npc.status) && now < npc.sitUntil) return;

        // Gli ospiti ogni tanto si siedono su un posto libero, altrimenti passeggiano.
        if (spec.role() == NpcRoster.Role.GUEST && random.nextInt(3) == 0) {
            int[] seat = freeSeatNear(npc, spec.x(), spec.y(), spec.radius() + 2);
            if (seat != null) {
                npc.sitUntil = now + 20_000 + random.nextInt(25_000);
                move(npc.user.id(), seat[0], seat[1]);
                return;
            }
        }
        for (int attempt = 0; attempt < 8; attempt++) {
            int x = spec.x() + random.nextInt(spec.radius() * 2 + 1) - spec.radius();
            int y = spec.y() + random.nextInt(spec.radius() * 2 + 1) - spec.radius();
            if (!layout.isTile(x, y) || nearDoor(x, y) || isOccupiedByOther(npc.user.id(), x, y)) continue;
            RoomItemView item = floorItemAt(x, y);
            if (item != null && !item.def().passable()) continue;
            move(npc.user.id(), x, y);
            return;
        }
    }

    // ------------------------------------------------------------------ calcio

    /** Chi arriva sulla casella del pallone lo calcia: di corsa lontano, fermandosi un passaggio corto. */
    private void kickBall(Occupant occupant) {
        if (football.inNet() || occupant.x != football.ballX() || occupant.y != football.ballY()) return;
        int power = occupant.path.isEmpty() ? FootballMatch.TAP_POWER : FootballMatch.RUN_POWER;
        FootballMatch.Kick kick = football.kick(occupant.dir, power, ballField(occupant.user.id()));
        broadcast(ballMessage(kick.path(), occupant.user.username()));
        if (kick.scored() == null) return;

        FootballMatch.Team winner = football.winner();
        Map<String, Object> goal = new LinkedHashMap<>();
        goal.put("type", "goal");
        goal.put("team", kick.scored().key());
        goal.put("label", kick.scored().label());
        goal.put("by", occupant.user.username());
        goal.put("blue", football.score(FootballMatch.Team.BLUE));
        goal.put("red", football.score(FootballMatch.Team.RED));
        goal.put("winner", winner == null ? null : winner.key());
        broadcast(goal);
        later(GOAL_PAUSE_MILLIS, () -> {
            football.kickOff();
            broadcast(ballMessage(List.of(), null));
        });
    }

    /** Il campo visto dal pallone: rotola sulle caselle libere e si ferma davanti agli avatar. */
    private FootballMatch.Field ballField(UUID kickerId) {
        return new FootballMatch.Field() {
            @Override
            public boolean ballCanEnter(int x, int y) {
                if (!layout.isTile(x, y) || (x == data.doorX() && y == data.doorY())) return false;
                RoomItemView item = floorItemAt(x, y);
                return item == null || item.def().passable();
            }

            @Override
            public boolean hasAvatar(int x, int y) {
                for (Occupant o : occupants.values()) {
                    if (!o.user.id().equals(kickerId) && o.x == x && o.y == y) return true;
                }
                return false;
            }
        };
    }

    /**
     * I calciatori NPC vanno dietro al pallone, dal lato opposto alla porta da attaccare, e poi ci
     * passano sopra di corsa: cosi' il tiro parte verso la porta. La squadra dipende dalla meta'
     * campo da cui partono. Insegue il pallone solo il piu' vicino di ogni squadra: gli altri
     * tengono la posizione, altrimenti si ammasserebbero tutti sul pallone.
     */
    private void playFootball(Occupant npc, long now) {
        if (now < npc.nextThinkAt) return;
        npc.nextThinkAt = now + 1_200 + random.nextInt(1_300);
        if (football.inNet()) return;
        UUID id = npc.user.id();
        FootballMatch.Field field = ballField(id);
        int bx = football.ballX();
        int by = football.ballY();
        FootballMatch.Team team = football.teamStartingAt(npc.npc.x());
        if (!chasesBall(npc, team, bx, by)) {
            if (npc.path.isEmpty() && Math.max(Math.abs(npc.x - npc.npc.x()), Math.abs(npc.y - npc.npc.y())) > 2) {
                move(id, npc.npc.x(), npc.npc.y());
            }
            return;
        }
        int[] spot = football.kickSpot(team);
        if (npc.x == spot[0] && npc.y == spot[1]) {
            // Di corsa attraverso il pallone, fino alla casella dopo.
            int tx = 2 * bx - spot[0];
            int ty = 2 * by - spot[1];
            if (field.ballCanEnter(tx, ty) && !isOccupiedByOther(id, tx, ty)) move(id, tx, ty);
            else move(id, bx, by);
            return;
        }
        if (!npc.path.isEmpty() && npc.targetX == spot[0] && npc.targetY == spot[1]) return;
        if (field.ballCanEnter(spot[0], spot[1]) && !isOccupiedByOther(id, spot[0], spot[1])) move(id, spot[0], spot[1]);
        else move(id, bx, by);
    }

    /** Il calciatore e' il piu' vicino al pallone della sua squadra (a parita', decide l'id). */
    private boolean chasesBall(Occupant npc, FootballMatch.Team team, int bx, int by) {
        int mine = Math.max(Math.abs(npc.x - bx), Math.abs(npc.y - by));
        for (Occupant other : occupants.values()) {
            if (other == npc || !other.isNpc() || other.npc.role() != NpcRoster.Role.FOOTBALLER) continue;
            if (football.teamStartingAt(other.npc.x()) != team) continue;
            int theirs = Math.max(Math.abs(other.x - bx), Math.abs(other.y - by));
            if (theirs < mine || (theirs == mine && other.user.id().compareTo(npc.user.id()) < 0)) return false;
        }
        return true;
    }

    private Map<String, Object> ballMessage(List<int[]> path, String by) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "ball");
        message.put("x", football.ballX());
        message.put("y", football.ballY());
        message.put("path", path);
        message.put("by", by);
        message.put("blue", football.score(FootballMatch.Team.BLUE));
        message.put("red", football.score(FootballMatch.Team.RED));
        return message;
    }

    /** Vicino alla porta non si ferma nessun NPC: bloccherebbe chi entra. */
    private boolean nearDoor(int x, int y) {
        return Math.max(Math.abs(x - data.doorX()), Math.abs(y - data.doorY())) <= 1;
    }

    /** Un posto a sedere libero entro `radius` caselle, per gli ospiti che vogliono sedersi. */
    private int[] freeSeatNear(Occupant npc, int cx, int cy, int radius) {
        List<int[]> seats = new ArrayList<>();
        for (RoomItemView item : items.values()) {
            if (!item.def().sittable()) continue;
            FurniCatalog.FurniDef def = item.def();
            for (int dx = 0; dx < def.footprintX(item.rot()); dx++) {
                for (int dy = 0; dy < def.footprintY(item.rot()); dy++) {
                    int x = item.x() + dx;
                    int y = item.y() + dy;
                    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > radius) continue;
                    if (!isOccupiedByOther(npc.user.id(), x, y)) seats.add(new int[]{x, y});
                }
            }
        }
        return seats.isEmpty() ? null : seats.get(random.nextInt(seats.size()));
    }

    /** Casella libera e raggiungibile entro `radius` da (cx, cy), la piu' vicina a chi si muove. */
    private int[] freeSpotNear(UUID moverId, int cx, int cy, int radius) {
        Occupant mover = occupants.get(moverId);
        int[] best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (int x = cx - radius; x <= cx + radius; x++) {
            for (int y = cy - radius; y <= cy + radius; y++) {
                if ((x == cx && y == cy) || !layout.isTile(x, y)) continue;
                if (isBlocked(moverId, x, y, x, y)) continue;
                int d = Math.abs(x - mover.x) + Math.abs(y - mover.y);
                if (d < bestDistance) {
                    bestDistance = d;
                    best = new int[]{x, y};
                }
            }
        }
        return best;
    }

    private static int distance(Occupant a, Occupant b) {
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    }

    // ------------------------------------------------------------------ chat ed espressioni

    public synchronized void chat(UUID userId, String text, String style) {
        Occupant speaker = occupants.get(userId);
        if (speaker == null) return;
        broadcast(Map.of("type", "chat", "id", userId, "text", text, "style", style));
        if (!speaker.isNpc()) hear(speaker, text);
    }

    /** Sussurro: arriva solo al destinatario e a chi lo scrive. A un NPC si sussurra e lui risponde. */
    public synchronized boolean whisper(UUID fromId, String toUsername, String text) {
        Occupant from = occupants.get(fromId);
        if (from == null) return false;
        // A parita' di nome vince il giocatore vero sull'NPC.
        Occupant to = occupants.values().stream()
                .filter(o -> o.user.username().equalsIgnoreCase(toUsername))
                .min(Comparator.comparing(Occupant::isNpc))
                .orElse(null);
        if (to == null) return false;

        Map<String, Object> message = Map.of("type", "chat", "id", fromId, "text", text, "style", "whisper",
                "to", to.user.username());
        from.send(message);
        if (to != from) to.send(message);
        if (to.isNpc()) respond(to, from, text, true);
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
        if (occupant == null || occupant.isNpc() || data.isOwner(userId)) return false;
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

        Minigames.Game game = Minigames.forFurni(item.type()).orElse(null);
        if (game != null) return useGame(occupant, item, game);

        switch (item.type()) {
            case "bar_counter", "cafe_counter", "coffee_machine", "icecream_cart", "pizza_oven", "beach_bar",
                 "popcorn_machine", "water_cooler" -> {
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

    // ------------------------------------------------------------------ minigiochi

    /**
     * Un mobile da minigioco: se si e' gia' al posto giusto la partita parte subito, altrimenti ci
     * si cammina (sulla panca ci si siede) e parte all'arrivo. Un giocatore alla volta per mobile.
     */
    private String useGame(Occupant occupant, RoomItemView item, Minigames.Game game) {
        if (occupant.isNpc()) return "not_usable";
        UUID userId = occupant.user.id();
        boolean busy = occupants.values().stream()
                .anyMatch(o -> o != occupant && item.id().equals(o.gameItem));
        if (busy) return "item_busy";
        if (occupant.game != null) stopGame(occupant);

        if (game.onItem() && item.def().sittable()) {
            // Panca: ci si siede sopra, su un posto libero.
            if (item.covers(occupant.x, occupant.y)) {
                startGame(occupant, item, game);
                return null;
            }
            int[] seat = null;
            FurniCatalog.FurniDef def = item.def();
            for (int dx = 0; dx < def.footprintX(item.rot()) && seat == null; dx++) {
                for (int dy = 0; dy < def.footprintY(item.rot()) && seat == null; dy++) {
                    if (!isOccupiedByOther(userId, item.x() + dx, item.y() + dy)) seat = new int[]{item.x() + dx, item.y() + dy};
                }
            }
            if (seat == null) return "item_busy";
            move(userId, seat[0], seat[1]);
            if (occupant.path.isEmpty()) return "too_far";
            occupant.pendingUse = item.id();
            return null;
        }
        if (isNextTo(occupant, item)) {
            startGame(occupant, item, game);
            return null;
        }
        int[] spot = freeSpotNextTo(userId, item);
        if (spot == null) return "too_far";
        move(userId, spot[0], spot[1]);
        occupant.pendingUse = item.id();
        return null;
    }

    /** Casella del tapis roulant su cui si corre e direzione in cui si guarda la console. */
    private static int[] beltSpot(RoomItemView item) {
        return switch (item.rot()) {
            case 2 -> new int[]{item.x() + 1, item.y(), 6};
            case 4 -> new int[]{item.x(), item.y(), 4};
            case 6 -> new int[]{item.x(), item.y(), 2};
            default -> new int[]{item.x(), item.y() + 1, 0};
        };
    }

    private void startGame(Occupant occupant, RoomItemView item, Minigames.Game game) {
        occupant.game = game;
        occupant.gameItem = item.id();
        occupant.gameStartedAt = System.currentTimeMillis();
        occupant.gameFromX = occupant.x;
        occupant.gameFromY = occupant.y;
        if (game.onItem() && !item.def().sittable()) {
            // Tapis roulant: si sale sul nastro.
            int[] belt = beltSpot(item);
            occupant.path.clear();
            occupant.path.add(new Pathfinder.Step(belt[0], belt[1], Math.max(0, layout.heightAt(belt[0], belt[1]))));
            broadcast(pathMessage(occupant));
            occupant.path.clear();
            occupant.x = belt[0];
            occupant.y = belt[1];
            occupant.targetX = belt[0];
            occupant.targetY = belt[1];
            occupant.dir = belt[2];
            occupant.status = "idle";
        } else if (item.def().sittable()) {
            occupant.status = "sit";
            occupant.dir = item.def().sitDirFor(item.rot());
        } else {
            int cx = Math.max(item.x(), Math.min(occupant.x, item.x() + item.def().footprintX(item.rot()) - 1));
            int cy = Math.max(item.y(), Math.min(occupant.y, item.y() + item.def().footprintY(item.rot()) - 1));
            occupant.dir = directionBetween(occupant.x, occupant.y, cx, cy, occupant.dir);
            occupant.status = "idle";
        }
        broadcast(statusMessage(occupant));
        broadcast(gameMessage(occupant));

        Map<String, Object> start = new LinkedHashMap<>();
        start.put("type", "minigame_start");
        start.put("game", game.key());
        start.put("title", game.title());
        start.put("unit", game.unit());
        start.put("maxScore", game.maxScore());
        start.put("itemId", item.id());
        start.put("best", records.get(game.key()));
        occupant.send(start);
        trainerSays(occupant, NpcDialog.workoutStart(game.key(), occupant.user.username(), random));
    }

    /** Fine della partita: il mobile si libera e dal tapis roulant si scende. */
    private void stopGame(Occupant occupant) {
        RoomItemView item = occupant.gameItem == null ? null : items.get(occupant.gameItem);
        boolean treadmill = occupant.game != null && occupant.game.onItem() && item != null && !item.def().sittable();
        occupant.game = null;
        occupant.gameItem = null;
        if (treadmill) {
            int[] off = isOccupiedByOther(occupant.user.id(), occupant.gameFromX, occupant.gameFromY)
                    ? freeSpotNextTo(occupant.user.id(), item) : new int[]{occupant.gameFromX, occupant.gameFromY};
            if (off != null) {
                occupant.path.clear();
                occupant.path.add(new Pathfinder.Step(off[0], off[1], Math.max(0, layout.heightAt(off[0], off[1]))));
                occupant.targetX = off[0];
                occupant.targetY = off[1];
                broadcast(pathMessage(occupant));
            }
        }
        broadcast(gameMessage(occupant));
    }

    /**
     * Risultato di una partita: il server lo controlla, aggiorna il record della stanza e lo
     * annuncia a tutti.
     *
     * @return l'esito: un errore, oppure il punteggio accettato e se e' un nuovo record (il premio in
     * gold lo decide chi chiama, che puo' usare il database)
     */
    public synchronized Minigames.Outcome minigameResult(UUID userId, int score) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null || occupant.game == null) return Minigames.Outcome.failed("minigame_not_running");
        Minigames.Game game = occupant.game;
        int valid = Minigames.validScore(game, score, System.currentTimeMillis() - occupant.gameStartedAt);
        stopGame(occupant);
        if (valid < 0) return Minigames.Outcome.failed("minigame_too_fast");

        Minigames.Best best = records.get(game.key());
        boolean record = valid > 0 && (best == null || valid > best.score());
        if (record) records.put(game.key(), best = new Minigames.Best(occupant.user.username(), valid));

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "minigame_score");
        message.put("id", userId);
        message.put("username", occupant.user.username());
        message.put("game", game.key());
        message.put("title", game.title());
        message.put("unit", game.unit());
        message.put("score", valid);
        message.put("record", record);
        message.put("best", best);
        broadcast(message);
        trainerSays(occupant, NpcDialog.workoutDone(game.unit(), occupant.user.username(), valid, record));
        return new Minigames.Outcome(null, game, valid, record);
    }

    /** Il giocatore chiude il minigioco prima della fine. */
    public synchronized void minigameQuit(UUID userId) {
        Occupant occupant = occupants.get(userId);
        if (occupant != null && occupant.game != null) stopGame(occupant);
    }

    /** L'istruttrice della palestra (se c'e') fa il tifo. */
    private void trainerSays(Occupant user, String text) {
        occupants.values().stream()
                .filter(o -> o.isNpc() && o.npc.role() == NpcRoster.Role.TRAINER)
                .findFirst()
                .ifPresent(trainer -> say(trainer, text, user, false, 400));
    }

    private static Map<String, Object> gameMessage(Occupant o) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "minigame");
        message.put("id", o.user.id());
        message.put("game", o.game == null ? null : o.game.key());
        return message;
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
        if (occupant == null || occupant.isNpc()) return false;
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

    // ------------------------------------------------------------------ NPC visti da fuori (sfide, scambi)

    /** L'NPC come "utente": nome e aspetto, per i messaggi di sfide e scambi. Null se non c'e'. */
    public synchronized HotelUser npcUser(UUID npcId) {
        Occupant npc = occupants.get(npcId);
        return npc != null && npc.isNpc() ? npc.user : null;
    }

    public synchronized NpcRoster.Role npcRole(UUID npcId) {
        Occupant npc = occupants.get(npcId);
        return npc != null && npc.isNpc() ? npc.npc.role() : null;
    }

    /** NPC presenti con uno di questi mestieri. */
    public synchronized List<UUID> npcsWithRole(Set<NpcRoster.Role> roles) {
        return occupants.values().stream().filter(o -> o.isNpc() && roles.contains(o.npc.role()))
                .map(o -> o.user.id()).toList();
    }

    /** Giocatori veri presenti e sulla pagina dell'hotel (non "assenti"). */
    public synchronized List<UUID> activePlayers() {
        return occupants.values().stream().filter(o -> !o.isNpc() && !o.away).map(o -> o.user.id()).toList();
    }

    /** Un NPC parla da fuori (per esempio durante una sfida), girato verso chi nomina. */
    public synchronized void npcSay(UUID npcId, String text, UUID towards) {
        Occupant npc = occupants.get(npcId);
        if (npc == null || !npc.isNpc()) return;
        Occupant to = towards == null ? null : occupants.get(towards);
        say(npc, text, to, false, 0);
    }

    /** Durante una sfida l'NPC resta fermo a giocare, senza passeggiare. */
    public synchronized void npcBusy(UUID npcId, boolean busy) {
        Occupant npc = occupants.get(npcId);
        if (npc == null || !npc.isNpc()) return;
        npc.nextThinkAt = busy ? Long.MAX_VALUE : System.currentTimeMillis() + 3_000;
        if (busy) {
            npc.path.clear();
            npc.targetX = npc.x;
            npc.targetY = npc.y;
        }
    }

    public synchronized boolean contains(UUID userId) {
        return occupants.containsKey(userId);
    }

    /**
     * Dal bancone esce una bibita a caso, dalla macchina del caffe' un caffe', dal carretto un gelato,
     * dal chiosco della spiaggia qualcosa di fresco, dal distributore della palestra acqua.
     */
    private void serveDrink(Occupant occupant, String from) {
        occupant.handItem = switch (from) {
            case "coffee_machine" -> "coffee";
            case "icecream_cart" -> "gelato";
            case "pizza_oven" -> "pizza";
            case "popcorn_machine" -> "popcorn";
            case "water_cooler" -> "water";
            case "beach_bar" -> System.nanoTime() % 2 == 0 ? "cocktail" : "juice";
            default -> DRINKS.get(Math.floorMod((int) System.nanoTime(), DRINKS.size()));
        };
        occupant.handItemLeft = HAND_ITEM_SIPS;
        occupant.handItemUntil = System.currentTimeMillis() + DRINK_MILLIS;
        broadcast(handMessage(occupant));
    }

    /**
     * Un sorso (o un morso, o una pagina) dell'oggetto in mano: lo vedono tutti. All'ultimo
     * l'oggetto e' finito e sparisce dalla mano.
     *
     * @return codice d'errore, oppure null
     */
    public synchronized String consume(UUID userId) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null || occupant.handItem == null) return "nothing_in_hand";
        long now = System.currentTimeMillis();
        if (now - occupant.lastSipAt < SIP_PAUSE_MILLIS) return null;
        occupant.lastSipAt = now;
        occupant.handItemLeft = Math.max(0, occupant.handItemLeft - 1);
        broadcast(Map.of("type", "consume", "id", userId, "item", occupant.handItem, "left", occupant.handItemLeft));
        if (occupant.handItemLeft == 0) {
            occupant.handItem = null;
            broadcast(handMessage(occupant));
        }
        return null;
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
        message.put("left", o.handItem == null ? 0 : o.handItemLeft);
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
        if (football != null) {
            state.put("ball", Map.of("x", football.ballX(), "y", football.ballY(),
                    "blue", football.score(FootballMatch.Team.BLUE), "red", football.score(FootballMatch.Team.RED)));
        }
        state.put("serverTime", System.currentTimeMillis());
        state.put("weather", HotelWeather.now().toMap());
        return state;
    }

    private static Map<String, Object> view(Occupant o) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", o.user.id());
        view.put("username", o.user.username());
        view.put("look", o.user.look());
        view.put("level", o.user.level());
        view.put("bestCard", o.user.bestCard());
        view.put("topCards", o.user.topCards());
        view.put("x", o.x);
        view.put("y", o.y);
        view.put("z", o.z);
        view.put("dir", o.dir);
        view.put("status", o.status);
        view.put("game", o.game == null ? null : o.game.key());
        view.put("handItem", o.handItem);
        view.put("handLeft", o.handItem == null ? 0 : o.handItemLeft);
        view.put("away", o.away);
        if (o.isNpc()) {
            view.put("npc", Map.of("role", o.npc.role().name().toLowerCase(), "title", o.npc.role().title(),
                    "menu", o.npc.menu()));
        }
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
        occupants.values().forEach(o -> o.send(message));
    }

    private void broadcastExcept(UUID userId, Object message) {
        occupants.values().forEach(o -> {
            if (!o.user.id().equals(userId)) o.send(message);
        });
    }
}
