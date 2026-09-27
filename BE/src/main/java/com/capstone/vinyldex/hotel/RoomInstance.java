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
    /** Bancone della caffetteria del quartiere. */
    private static final List<String> COFFEE_HOUSE = List.of("latte", "frappe", "coffee");
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
    public static final int JUKEBOX_TRACKS = 10;
    /** Primo brano disco anni 80 (4 e 5): la Disco lo fa partire da sola. */
    static final int DISCO_TRACK = 4;
    /** Glam rock anni 80 (6), poi i brani rock del locale (7, 8, 9). */
    static final int GLAM_TRACK = 6;
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
    /** Partita a squadre fra giocatori veri (solo nelle stanze con il pallone). */
    private final TeamMatch match = new TeamMatch();
    /** Gara dei go-kart fra i giocatori della stanza. */
    private final KartRace kartRace = new KartRace();
    /** Dopo un gol il pallone resta in rete un attimo, poi torna a centrocampo. */
    private static final long GOAL_PAUSE_MILLIS = 2_500;
    /** Il tick gira ogni mezzo secondo: i controlli "ogni 5 secondi" cadono in questa finestra. */
    private static final long TICK_CHECK_MILLIS = 500;
    /** Fatti di gioco da far sapere al resto dell'applicazione (missioni, eventi, classifiche). */
    private java.util.function.Consumer<Object> events = event -> { };
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
        /** NPC che va a giocare a un minigioco: il mobile scelto e fino a quando gioca. */
        UUID npcGameItem;
        long npcGameUntil;
        int npcFx;
        /** Minigioco in corso su un mobile (panca, sacco, arcade...), da quando e da dove si era partiti. */
        Minigames.Game game;
        UUID gameItem;
        long gameStartedAt;
        int gameFromX;
        int gameFromY;
        /** Ultimo evento del minigioco (tiro, lancio...) inoltrato agli altri: si limita la frequenza. */
        long lastFxAt;

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
        this.football = FootballMatch.create(items.values(), layout, data.doorX(), data.doorY());
        // In discoteca e al locale rock la musica c'e' sempre appena si entra.
        int[] playlist = playlist();
        if (playlist != null) {
            jukeboxTrack = playlist[0];
            jukeboxStartedAt = System.currentTimeMillis();
        }
        spawnNpcs();
    }

    /** Gli NPC della stanza entrano con lei, ognuno al suo posto. */
    private void spawnNpcs() {
        long now = System.currentTimeMillis();
        for (NpcRoster.NpcSpec spec : NpcRoster.forRoom(data.id())) {
            if (!layout.isTile(spec.x(), spec.y())) continue;
            // Le leggende del Locale Rock portano la loro carta leggendaria sopra la testa.
            NpcRoster.Legend legend = NpcRoster.legend(spec.key());
            HotelUser user = legend == null ? new HotelUser(spec.id(data.id()), spec.name(), spec.look(), 0)
                    : new HotelUser(spec.id(data.id()), spec.name(), spec.look(), 0, legend.cardView(), List.of(legend.cardView()),
                    null, null, null);
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

    /** Chi ascolta i fatti di gioco della stanza (il RoomRegistry lo collega agli eventi Spring). */
    public void setEvents(java.util.function.Consumer<Object> events) {
        this.events = events == null ? event -> { } : events;
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
        if (football != null && match.isPlayer(userId)) {
            if (match.onLeave(userId) == TeamMatch.Outcome.END) endMatch();
            else broadcast(match.view());
        }
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
        if (now % 5_000 < TICK_CHECK_MILLIS) closeKartRace();
        if (quiz != null && now > quiz.deadline()) endQuiz(null);
        if (football != null && match.playing()) {
            TeamMatch.Outcome outcome = match.onTick(now, football.score(FootballMatch.Team.BLUE), football.score(FootballMatch.Team.RED));
            if (outcome == TeamMatch.Outcome.EXTRA_TIME) {
                Map<String, Object> view = match.view();
                view.put("notice", "Pareggio! Supplementari: il primo gol vince.");
                broadcast(view);
            } else if (outcome == TeamMatch.Outcome.END) {
                endMatch();
            }
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
            // Su skate, bici o auto (solo all'aperto) si fanno piu' caselle per tick.
            for (int extra = 1; extra < rideSpeed(occupant) && occupant.path.size() > 1; extra++) {
                occupant.path.pollFirst();
                occupant.dir = directionBetween(occupant.x, occupant.y, next.x(), next.y(), occupant.dir);
                occupant.x = next.x();
                occupant.y = next.y();
                occupant.z = next.z();
                next = occupant.path.peekFirst();
            }

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
                if (game != null && (atGameSpot(occupant, target) || isNextTo(occupant, target) || target.covers(occupant.x, occupant.y))) {
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
            NpcRoster.Legend legend = NpcRoster.legend(spec.key());
            String line = legend != null ? legend.lines().get(random.nextInt(legend.lines().size()))
                    : random.nextInt(4) == 0 ? HotelWeather.now().remark() : NpcDialog.idle(spec.role(), random);
            say(npc, line, null, false, 0);
        }
        if ((spec.role() == NpcRoster.Role.FOOTBALLER || spec.role() == NpcRoster.Role.HOCKEY_PLAYER) && football != null) {
            playFootball(npc, now);
            return;
        }
        if (now < npc.nextThinkAt || !npc.path.isEmpty()) return;
        npc.nextThinkAt = now + 4_000 + random.nextInt(6_000);
        if (npcPlays(npc, now)) return;

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

    /** Minigiochi che gli NPC giocano nelle stanze (quelli che si animano senza un vero giocatore). */
    static final java.util.Set<String> NPC_GAMES = java.util.Set.of("pong", "box", "sing", "rhythm", "run", "curl", "disco", "hockey", "rock", "drums");

    /**
     * Gli ospiti ogni tanto vanno a giocare a un minigioco libero vicino (ping pong, sacco, karaoke,
     * arcade, tapis roulant, manubri), ci restano un po' e poi lo lasciano libero. Solo scena: i
     * punteggi degli NPC nelle gare li registra NpcPlayers.
     *
     * @return true se l'NPC in questo turno e' occupato col minigioco
     */
    private boolean npcPlays(Occupant npc, long now) {
        if (npc.game != null) {
            if (now > npc.npcGameUntil) {
                stopGame(npc);
                npc.npcGameItem = null;
                return true;
            }
            // A ping pong si vede lo scambio: un colpo a ogni turno, da una parte e dall'altra.
            if ("pong".equals(npc.game.key())) minigameFx(npc.user.id(), Map.of("kind", "rally", "x", (npc.npcFx++) % 2));
            else if ("box".equals(npc.game.key())) minigameFx(npc.user.id(), Map.of("kind", "hit"));
            npc.nextThinkAt = now + 900 + random.nextInt(500);
            return true;
        }
        if (npc.npcGameItem != null) {
            RoomItemView item = items.get(npc.npcGameItem);
            boolean free = item != null && occupants.values().stream().noneMatch(o -> o != npc && item.id().equals(o.gameItem));
            if (free && isNextTo(npc, item)) {
                Minigames.forFurni(item.type()).ifPresent(game -> {
                    startGame(npc, item, game);
                    npc.npcGameUntil = now + 25_000 + random.nextInt(30_000);
                });
                npc.nextThinkAt = now + 1_000;
            }
            npc.npcGameItem = null;
            return npc.game != null;
        }
        if (npc.npc.role() != NpcRoster.Role.GUEST || random.nextInt(5) != 0) return false;
        List<RoomItemView> games = items.values().stream()
                .filter(i -> Minigames.forFurni(i.type()).map(g -> NPC_GAMES.contains(g.key())).orElse(false))
                .filter(i -> occupants.values().stream().noneMatch(o -> i.id().equals(o.gameItem) || i.id().equals(o.npcGameItem)))
                .filter(i -> Math.abs(i.x() - npc.npc.x()) + Math.abs(i.y() - npc.npc.y()) <= npc.npc.radius() + 8)
                .toList();
        if (games.isEmpty()) return false;
        RoomItemView item = games.get(random.nextInt(games.size()));
        int[] spot = freeSpotNextTo(npc.user.id(), item);
        if (spot == null) return false;
        npc.npcGameItem = item.id();
        move(npc.user.id(), spot[0], spot[1]);
        return true;
    }

    // ------------------------------------------------------------------ calcio

    /** Chi arriva sulla casella del pallone lo calcia: di corsa lontano, fermandosi un passaggio corto. */
    private void kickBall(Occupant occupant) {
        if (football.inNet() || occupant.x != football.ballX() || occupant.y != football.ballY()) return;
        // Durante una partita a squadre calciano solo i giocatori in campo.
        if (match.playing() && !match.isPlayer(occupant.user.id())) return;
        int power = occupant.path.isEmpty() ? football.tapPower() : football.runPower();
        FootballMatch.Kick kick = football.kick(occupant.dir, power, ballField(occupant.user.id()));
        broadcast(ballMessage(kick.path(), occupant.user.username(), occupant.user.id()));
        if (kick.scored() == null) return;
        if (!occupant.isNpc()) {
            events.accept(new HotelGameEvents.GoalScored(data.id(), occupant.user.id(), occupant.user.username(), kick.scored().key()));
        }

        FootballMatch.Team winner = football.winner();
        Map<String, Object> goal = new LinkedHashMap<>();
        goal.put("type", "goal");
        goal.put("team", kick.scored().key());
        goal.put("label", kick.scored().label());
        goal.put("by", occupant.user.username());
        goal.put("blue", football.score(FootballMatch.Team.BLUE));
        goal.put("red", football.score(FootballMatch.Team.RED));
        goal.put("winner", winner == null ? null : winner.key());
        goal.put("match", match.playing());
        broadcast(goal);
        if (match.afterGoal(football.score(FootballMatch.Team.BLUE), football.score(FootballMatch.Team.RED)) == TeamMatch.Outcome.END) {
            later(GOAL_PAUSE_MILLIS, this::endMatch);
            return;
        }
        later(GOAL_PAUSE_MILLIS, () -> {
            football.kickOff();
            broadcast(ballMessage(List.of(), null));
        });
    }

    /** Entra in una squadra ("blue", "red") o ne esce (altro valore). Restituisce l'errore o null. */
    public synchronized String matchJoin(UUID userId, String team) {
        Occupant occupant = occupants.get(userId);
        if (football == null || occupant == null || occupant.isNpc()) return "no_match_here";
        FootballMatch.Team chosen = "blue".equals(team) ? FootballMatch.Team.BLUE : "red".equals(team) ? FootballMatch.Team.RED : null;
        String error = match.join(userId, occupant.user.username(), chosen);
        if (error == null) broadcast(match.view());
        return error;
    }

    /** Fischio d'inizio: serve almeno un giocatore per squadra, e deve fischiare uno di loro. */
    public synchronized String matchStart(UUID userId) {
        if (football == null) return "no_match_here";
        if (!match.isPlayer(userId)) return "match_not_player";
        if (!match.canStart()) return "match_not_ready";
        football.resetScore();
        football.kickOff();
        match.start(System.currentTimeMillis());
        broadcast(ballMessage(List.of(), null));
        broadcast(match.view());
        return null;
    }

    /** Fischio finale: premi (via evento), risultato a tutti, pallone a centrocampo e punteggio a zero. */
    private synchronized void endMatch() {
        if (!match.playing()) return;
        int blueScore = football.score(FootballMatch.Team.BLUE);
        int redScore = football.score(FootballMatch.Team.RED);
        FootballMatch.Team winner = match.winner(blueScore, redScore);
        List<UUID> bluePlayers = match.players(FootballMatch.Team.BLUE);
        List<UUID> redPlayers = match.players(FootballMatch.Team.RED);
        List<UUID> winners = winner == null ? List.of() : winner == FootballMatch.Team.BLUE ? bluePlayers : redPlayers;
        List<UUID> losers = winner == null ? List.of() : winner == FootballMatch.Team.BLUE ? redPlayers : bluePlayers;
        List<UUID> all = new ArrayList<>(bluePlayers);
        all.addAll(redPlayers);
        events.accept(new HotelGameEvents.MatchPlayed(data.id(), winner == null ? all : winners, winner == null ? List.of() : losers, winner == null));

        Map<String, Object> end = new LinkedHashMap<>();
        end.put("type", "match_end");
        end.put("winner", winner == null ? null : winner.key());
        end.put("label", winner == null ? null : winner.label());
        end.put("blue", blueScore);
        end.put("red", redScore);
        broadcast(end);
        match.finish();
        football.resetScore();
        football.kickOff();
        broadcast(ballMessage(List.of(), null));
        broadcast(match.view());
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
        if (match.playing()) {
            // Partita fra giocatori: gli NPC tornano al loro posto e guardano.
            if (npc.path.isEmpty() && (npc.x != npc.npc.x() || npc.y != npc.npc.y())) move(npc.user.id(), npc.npc.x(), npc.npc.y());
            return;
        }
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
            if (other == npc || !other.isNpc()
                    || (other.npc.role() != NpcRoster.Role.FOOTBALLER && other.npc.role() != NpcRoster.Role.HOCKEY_PLAYER)) continue;
            if (football.teamStartingAt(other.npc.x()) != team) continue;
            int theirs = Math.max(Math.abs(other.x - bx), Math.abs(other.y - by));
            if (theirs < mine || (theirs == mine && other.user.id().compareTo(npc.user.id()) < 0)) return false;
        }
        return true;
    }

    private Map<String, Object> ballMessage(List<int[]> path, String by) {
        return ballMessage(path, by, null);
    }

    private Map<String, Object> ballMessage(List<int[]> path, String by, UUID kickerId) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "ball");
        message.put("x", football.ballX());
        message.put("y", football.ballY());
        message.put("path", path);
        message.put("by", by);
        message.put("byId", kickerId);
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
        if (quiz != null && !speaker.isNpc() && quiz.guessed(text)) endQuiz(speaker);
    }

    // ------------------------------------------------------------------ mostra una carta

    /** Tra una carta mostrata e l'altra: niente raffiche sopra la testa. */
    static final long SHOW_CARD_COOLDOWN_MILLIS = 4_000;
    /** Quanto resta la carta sopra la testa (lo usa anche il client). */
    public static final long SHOW_CARD_MILLIS = 6_000;
    private final Map<UUID, Long> lastShownCard = new HashMap<>();

    /** Il giocatore mostra una sua carta a tutta la stanza, grande sopra la testa. */
    public synchronized boolean showCard(UUID userId, Map<String, Object> card) {
        Occupant occupant = occupants.get(userId);
        long now = System.currentTimeMillis();
        if (occupant == null || occupant.isNpc() || now - lastShownCard.getOrDefault(userId, 0L) < SHOW_CARD_COOLDOWN_MILLIS) return false;
        lastShownCard.put(userId, now);
        broadcast(Map.of("type", "show_card", "id", userId, "card", card, "until", now + SHOW_CARD_MILLIS));
        return true;
    }

    // ------------------------------------------------------------------ quiz "Indovina la carta"

    /** Durata di una domanda del quiz. */
    public static final long QUIZ_MILLIS = 60_000;
    static final long QUIZ_COOLDOWN_MILLIS = 8_000;

    /** Domanda in corso: la carta (senza nome per i client) e le risposte giuste. */
    record Quiz(String name, List<String> answers, Map<String, Object> card, long startedAt, long deadline) {
        boolean guessed(String text) {
            String guess = NpcDialog.normalize(text).replace(" ", "");
            return guess.length() >= 3 && answers.stream().anyMatch(guess::equals);
        }
    }

    private Quiz quiz;
    private long quizCooldownUntil;

    /** Risposte accettate: il nome intero o la sua prima parte ("Charizard ex" -> "charizard"). */
    static List<String> quizAnswers(String name) {
        List<String> answers = new ArrayList<>();
        String full = NpcDialog.normalize(name).replace(" ", "");
        if (!full.isEmpty()) answers.add(full);
        String main = name.split("//|,| - |\\(")[0];
        String mainNorm = NpcDialog.normalize(main).replace(" ", "");
        if (mainNorm.length() >= 3 && !answers.contains(mainNorm)) answers.add(mainNorm);
        return answers;
    }

    /**
     * Parte una domanda: la carta arriva sfocata ai client, chi scrive il nome giusto in chat vince.
     *
     * @param card la carta per i client, senza il nome
     */
    public synchronized String startQuiz(UUID userId, String name, Map<String, Object> card) {
        long now = System.currentTimeMillis();
        if (!occupants.containsKey(userId)) return "not_in_room";
        if (quiz != null) return "quiz_running";
        if (now < quizCooldownUntil) return "quiz_cooldown";
        quiz = new Quiz(name, quizAnswers(name), card, now, now + QUIZ_MILLIS);
        broadcast(quizMessage());
        broadcast(Map.of("type", "chat", "id", userId, "text", "Quiz! Chi indovina il nome della carta?", "style", "shout"));
        return "ok";
    }

    private Map<String, Object> quizMessage() {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "quiz_start");
        message.put("card", quiz.card());
        message.put("letters", quiz.name().replaceAll("[^\\p{L}\\p{N}]", "").length());
        message.put("initial", quiz.name().substring(0, 1).toUpperCase());
        message.put("startedAt", quiz.startedAt());
        message.put("deadline", quiz.deadline());
        return message;
    }

    private void endQuiz(Occupant winner) {
        Quiz done = quiz;
        quiz = null;
        quizCooldownUntil = System.currentTimeMillis() + QUIZ_COOLDOWN_MILLIS;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "quiz_end");
        message.put("name", done.name());
        message.put("card", done.card());
        message.put("winner", winner == null ? null : winner.user.username());
        message.put("winnerId", winner == null ? null : winner.user.id());
        broadcast(message);
        if (winner != null) events.accept(new HotelGameEvents.QuizWon(data.id(), winner.user.id(), winner.user.username(), done.name()));
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
            case "bar_counter", "cafe_counter", "coffee_machine", "icecream_cart", "pizza_oven", "beach_bar", "espresso_bar",
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
        // Un NPC che ci sta giocando lascia subito il posto a un giocatore vero.
        occupants.values().stream().filter(o -> o != occupant && o.isNpc() && item.id().equals(o.gameItem)).toList()
                .forEach(npc -> {
                    stopGame(npc);
                    npc.npcGameUntil = 0;
                });
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
        // Canestro, pista e buca hanno un posto preciso da cui si gioca (la lunetta, la linea di lancio,
        // la partenza): ci si va li'. Se e' occupato si gioca da accanto al mobile.
        int[] place = gameSpot(item);
        if (place != null && layout.isTile(place[0], place[1]) && !isBlocked(userId, place[0], place[1], place[0], place[1])) {
            if (atGameSpot(occupant, item)) {
                startGame(occupant, item, game);
                return null;
            }
            move(userId, place[0], place[1]);
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

    /** Verso in cui guarda il davanti di un mobile per ogni rotazione (0 sud, 2 est, 4 nord, 6 ovest). */
    private static final int[][] FACING = {{0, 1}, {1, 0}, {0, -1}, {-1, 0}};

    /**
     * Posto da cui si gioca: tiro libero quattro caselle davanti al canestro, la casella prima della
     * linea di lancio della pista, la partenza della buca del minigolf. null = da accanto al mobile.
     */
    static int[] gameSpot(RoomItemView item) {
        int rot = Math.floorMod(item.rot(), 8) / 2;
        if ("basket_hoop".equals(item.type())) {
            int[] d = FACING[rot];
            return new int[]{item.x() + d[0] * 4, item.y() + d[1] * 4};
        }
        if ("bowling_lane".equals(item.type())) {
            int length = item.def().length();
            return switch (rot) {
                case 1 -> new int[]{item.x() - 1, item.y()};
                case 2 -> new int[]{item.x(), item.y() + length};
                case 3 -> new int[]{item.x() + length, item.y()};
                default -> new int[]{item.x(), item.y() - 1};
            };
        }
        if (item.type().startsWith("golf_hole_")) return new int[]{item.x() - 1, item.y()};
        // Paletto da pesca: si sta sulla sabbia a ovest, rivolti verso il mare.
        if ("fishing_post".equals(item.type())) return new int[]{item.x() - 1, item.y()};
        // Freccette: si tira da due caselle di distanza, davanti al bersaglio.
        if ("dart_board".equals(item.type())) return new int[]{item.x() - 2, item.y()};
        return null;
    }

    private static boolean atGameSpot(Occupant occupant, RoomItemView item) {
        int[] spot = gameSpot(item);
        return spot != null && occupant.x == spot[0] && occupant.y == spot[1];
    }

    /**
     * Evento di un minigioco (il tiro a canestro, il lancio della boccia, la pallina del golf):
     * il gioco si svolge nel browser di chi gioca, gli altri lo vedono animato nella stanza.
     * Il punteggio non dipende da questi messaggi: servono solo alle animazioni.
     */
    public synchronized void minigameFx(UUID userId, Map<String, Object> fx) {
        Occupant occupant = occupants.get(userId);
        if (occupant == null || occupant.game == null || fx == null) return;
        long now = System.currentTimeMillis();
        if (now - occupant.lastFxAt < 80) return;
        occupant.lastFxAt = now;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "game_fx");
        message.put("id", userId);
        message.put("game", occupant.game.key());
        message.put("item", occupant.gameItem);
        message.put("fx", fx);
        broadcast(message);
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
        if ("kart".equals(game.key())) {
            // Go-kart: stessa partenza per chi sale sui kart nei prossimi secondi.
            long now = System.currentTimeMillis();
            start.put("raceStart", kartRace.join(occupant.user.id(), occupant.user.username(), now));
            start.put("serverTime", now);
            broadcast(kartRace.view());
        }
        occupant.send(start);
        trainerSays(occupant, NpcDialog.workoutStart(game.key(), occupant.user.username(), random));
    }

    /** Fine della partita: il mobile si libera e dal tapis roulant si scende. */
    private void stopGame(Occupant occupant) {
        RoomItemView item = occupant.gameItem == null ? null : items.get(occupant.gameItem);
        boolean treadmill = occupant.game != null && occupant.game.onItem() && item != null && !item.def().sittable();
        if (occupant.game != null && "kart".equals(occupant.game.key())) {
            kartRace.leave(occupant.user.id());
            later(0, this::closeKartRace);
        }
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
        if ("kart".equals(game.key())) kartRace.finish(userId, valid);
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
        events.accept(new HotelGameEvents.MinigamePlayed(data.id(), userId, occupant.user.username(), game.key(), valid));
        if ("rock".equals(game.key()) || "drums".equals(game.key())) rockDuel(occupant, game, valid);
        trainerSays(occupant, NpcDialog.workoutDone(game.unit(), occupant.user.username(), valid, record));
        return new Minigames.Outcome(null, game, valid, record);
    }

    /** Fine della gara dei go-kart: classifica a tutti e premi al podio (via evento). */
    private synchronized void closeKartRace() {
        List<KartRace.Placing> ranking = kartRace.ended(System.currentTimeMillis());
        if (ranking == null || ranking.isEmpty()) return;
        broadcast(Map.of("type", "kart_race_end", "ranking",
                ranking.stream().map(p -> Map.of("id", p.id(), "name", p.name(), "score", p.score())).toList()));
        events.accept(new HotelGameEvents.KartRaceFinished(data.id(),
                ranking.stream().filter(p -> p.score() > 0).map(KartRace.Placing::id).toList()));
    }

    /** Voti rock appena consegnati: chi finisce entro due minuti da un altro lo sfida. */
    private final Map<UUID, long[]> rockResults = new HashMap<>();
    static final long ROCK_DUEL_MILLIS = 120_000;

    /**
     * Sfida rock: due giocatori sulle pedane del locale. Quando il secondo consegna il voto (entro
     * due minuti dal primo) si annuncia chi ha vinto, e la band lo dice ad alta voce.
     */
    private void rockDuel(Occupant occupant, Minigames.Game game, int score) {
        long now = System.currentTimeMillis();
        Occupant legend = rockRivals.containsKey(occupant.user.id()) ? occupants.get(rockRivals.remove(occupant.user.id())) : null;
        if (legend != null && legend.isNpc()) {
            legendDuel(occupant, legend, game, score);
            return;
        }
        rockResults.entrySet().removeIf(e -> now - e.getValue()[1] > ROCK_DUEL_MILLIS);
        UUID me = occupant.user.id();
        Map.Entry<UUID, long[]> rival = rockResults.entrySet().stream()
                .filter(e -> !e.getKey().equals(me) && occupants.containsKey(e.getKey())).findFirst().orElse(null);
        if (rival == null) {
            rockResults.put(me, new long[]{score, now});
            return;
        }
        rockResults.remove(rival.getKey());
        Occupant other = occupants.get(rival.getKey());
        int otherScore = (int) rival.getValue()[0];
        boolean iWin = score >= otherScore;
        Occupant winner = iWin ? occupant : other;
        Occupant loser = iWin ? other : occupant;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "rock_duel");
        message.put("game", game.key());
        message.put("winner", winner.user.username());
        message.put("loser", loser.user.username());
        message.put("winnerScore", Math.max(score, otherScore));
        message.put("loserScore", Math.min(score, otherScore));
        broadcast(message);
        occupants.values().stream()
                .filter(o -> o.isNpc() && o.npc.role() == NpcRoster.Role.MUSICIAN)
                .findFirst()
                .ifPresent(band -> say(band, winner.user.username() + " vince la sfida rock contro " + loser.user.username()
                        + ": " + Math.max(score, otherScore) + " a " + Math.min(score, otherScore) + "!", winner, false, 400));
    }

    /** Per i test: il minigioco in corso sembra cominciato da un po' (i voti troppo veloci si scartano). */
    synchronized void backdateGame(UUID userId, long millis) {
        Occupant occupant = occupants.get(userId);
        if (occupant != null) occupant.gameStartedAt -= millis;
    }

    /** Chi ha sfidato una leggenda (id del giocatore, id dell'NPC), fino al voto. */
    private final Map<UUID, UUID> rockRivals = new HashMap<>();

    /**
     * Sfida a una leggenda del Locale Rock, scelta nel gioco prima della canzone (indice in
     * NpcRoster.LEGEND_KEYS): la leggenda accetta ad alta voce e suona anche lei, sul palco.
     */
    public synchronized void rockChallenge(UUID userId, int legendIndex) {
        Occupant player = occupants.get(userId);
        if (player == null || player.game == null || legendIndex < 0 || legendIndex >= NpcRoster.LEGEND_KEYS.size()) return;
        if (!"rock".equals(player.game.key()) && !"drums".equals(player.game.key())) return;
        String key = NpcRoster.LEGEND_KEYS.get(legendIndex);
        Occupant legend = occupants.values().stream().filter(o -> o.isNpc() && key.equals(o.npc.key())).findFirst().orElse(null);
        if (legend == null) return;
        rockRivals.put(userId, legend.user.id());
        say(legend, pick(List.of("Sfida accettata, " + player.user.username() + "! Fammi sentire cosa sai fare.",
                player.user.username() + " contro " + legend.user.username() + "? Il pubblico e' pronto!",
                "Accordo la chitarra... " + player.user.username() + ", preparati a perdere!")), player, false, 300);
    }

    private String pick(List<String> lines) {
        return lines.get(random.nextInt(lines.size()));
    }

    /**
     * Voto della leggenda: la sua bravura, con una serata piu' o meno ispirata. Poi il verdetto
     * a tutta la stanza, come nella sfida fra due giocatori, e la leggenda commenta.
     */
    private void legendDuel(Occupant player, Occupant legend, Minigames.Game game, int score) {
        NpcRoster.Legend info = NpcRoster.legend(legend.npc.key());
        int skill = info == null ? 800 : info.skill();
        int npcScore = Math.max(0, Math.min(1000, skill - 90 + random.nextInt(140)));
        boolean playerWins = score > npcScore;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "rock_duel");
        message.put("game", game.key());
        message.put("winner", playerWins ? player.user.username() : legend.user.username());
        message.put("loser", playerWins ? legend.user.username() : player.user.username());
        message.put("winnerScore", Math.max(score, npcScore));
        message.put("loserScore", Math.min(score, npcScore));
        message.put("legend", legend.user.username());
        message.put("playerId", player.user.id());
        broadcast(message);
        String name = player.user.username();
        say(legend, playerWins
                ? pick(List.of("Incredibile, " + name + "! " + score + " a " + npcScore + ": questa volta hai vinto tu.",
                        "Mi inchino, " + name + ". Un assolo cosi' non lo sentivo da anni!",
                        name + " batte " + legend.user.username() + " " + score + " a " + npcScore + "! Rivincita domani?"))
                : pick(List.of("Bel tentativo, " + name + "! Ma " + npcScore + " a " + score + " per me.",
                        "La leggenda resta leggenda: " + npcScore + " a " + score + ". Riprova, " + name + "!",
                        "Ci vuole ancora un po' di pratica, " + name + ": " + npcScore + " a " + score + ".")), player, false, 600);
    }

    // ------------------------------------------------------------------ feste a tema

    private String partyTheme;
    private long partyEndsAt;

    /** Brano del jukebox per ogni tema (indici di src/hotel/music.js). */
    static final Map<String, Integer> PARTY_TRACKS = Map.of("disco", DISCO_TRACK, "rock", 7, "neon", 2, "lounge", 3, "classic", 0);

    /** Festa a tema: parte la sua musica e i client accendono le luci del tema. */
    public synchronized void startParty(String theme, long endsAt) {
        partyTheme = theme;
        partyEndsAt = endsAt;
        jukeboxTrack = PARTY_TRACKS.getOrDefault(theme, 0);
        jukeboxStartedAt = System.currentTimeMillis();
        broadcast(jukeboxMessage());
        broadcast(partyMessage());
    }

    public synchronized void stopParty() {
        partyTheme = null;
        partyEndsAt = 0;
        broadcast(partyMessage());
    }

    private Map<String, Object> partyMessage() {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "party_theme");
        message.put("theme", partyActive() ? partyTheme : null);
        message.put("endsAt", partyEndsAt);
        return message;
    }

    private boolean partyActive() {
        return partyTheme != null && partyEndsAt > System.currentTimeMillis();
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

    /** Stanze all'aperto dove si va in skate, bici o auto (non negli stadi): come RIDE_WALLS in src/hotel/HotelEngine.js. */
    static final java.util.Set<String> RIDE_WALLS = java.util.Set.of("hedge", "skyline", "seaside", "street");

    boolean rideable() {
        return RIDE_WALLS.contains(data.wallStyle());
    }

    /** Caselle per tick: il veicolo del codice aspetto, solo all'aperto e mentre non si gioca. */
    private int rideSpeed(Occupant occupant) {
        if (!rideable() || occupant.game != null) return 1;
        return LuxuryCatalog.speedOf(occupant.user.look());
    }

    /**
     * Brani dei locali (indici di src/hotel/music.js): la Disco alterna la disco e il glam rock anni
     * 80, il locale rock i brani rock. null = tutti i brani, uno dopo l'altro.
     */
    int[] playlist() {
        if (!data.publicRoom()) return null;
        if ("disco".equals(data.floorStyle())) return new int[]{DISCO_TRACK, DISCO_TRACK + 1, GLAM_TRACK};
        if ("rockclub".equals(data.floorStyle())) return new int[]{7, 8, 9, GLAM_TRACK};
        return null;
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
        // In discoteca e al locale rock si gira solo fra i brani del locale.
        int[] playlist = playlist();
        if (playlist == null) {
            jukeboxTrack = (jukeboxTrack + 1) % JUKEBOX_TRACKS;
        } else {
            int at = 0;
            for (int i = 0; i < playlist.length; i++) if (playlist[i] == jukeboxTrack) at = i;
            jukeboxTrack = playlist[(at + 1) % playlist.length];
        }
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

    /** Giocatori veri presenti (per i premi delle feste). */
    public synchronized List<UUID> humanIds() {
        return occupants.values().stream().filter(o -> !o.isNpc()).map(o -> o.user.id()).toList();
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
            case "espresso_bar" -> COFFEE_HOUSE.get(Math.floorMod((int) System.nanoTime(), COFFEE_HOUSE.size()));
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
        if (partyActive()) state.put("party", Map.of("theme", partyTheme, "endsAt", partyEndsAt));
        if (football != null) {
            state.put("ball", Map.of("x", football.ballX(), "y", football.ballY(),
                    "blue", football.score(FootballMatch.Team.BLUE), "red", football.score(FootballMatch.Team.RED)));
            state.put("match", match.view());
        }
        state.put("serverTime", System.currentTimeMillis());
        state.put("weather", HotelWeather.now().toMap());
        if (quiz != null) state.put("quiz", quizMessage());
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
        view.put("pet", o.user.pet());
        view.put("club", o.user.club());
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
            NpcRoster.Legend legend = NpcRoster.legend(o.npc.key());
            if (legend == null) {
                view.put("npc", Map.of("role", o.npc.role().name().toLowerCase(), "title", o.npc.role().title(),
                        "menu", o.npc.menu()));
            } else {
                view.put("npc", Map.of("role", o.npc.role().name().toLowerCase(), "title", "Leggenda · " + legend.artistClass(),
                        "menu", o.npc.menu(), "legend", Map.of("key", o.npc.key(), "instrument", legend.instrument(),
                                "skill", legend.skill(), "card", legend.card())));
            }
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
