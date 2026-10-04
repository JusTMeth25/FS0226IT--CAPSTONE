package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.casino.CasinoGames.Card;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

/**
 * Tavolo di Texas Hold'em No Limit da sei posti: giocatori veri e NPC del casino.
 *
 * Il tavolo e' un oggetto a se' (senza soldi ne' rete): chi lo usa gli passa il tempo (tick) e
 * le azioni dei giocatori, e riceve a voce (Listener) quando c'e' da rimandare lo stato e quando
 * un giocatore si alza con le sue fiches. Tutto e' sincronizzato sul tavolo.
 *
 * Regole: bui 5/10, mano da due carte, giri di puntate preflop, flop, turn e river, rilancio
 * minimo pari all'ultimo rilancio, all-in con piatti laterali, showdown con la mano migliore di
 * cinque carte (PokerEval). Gli NPC si siedono nei posti liberi e giocano da soli.
 */
public final class PokerTable {

    public static final int SEATS = 6;
    public static final int SMALL_BLIND = 5;
    public static final int BIG_BLIND = 10;
    public static final int MIN_BUY_IN = 100;
    public static final int MAX_BUY_IN = 2_000;
    /** Tempo per decidere: poi si passa (check) o si lascia (fold) da soli. */
    public static final long TURN_MILLIS = 20_000;
    private static final long SHOWDOWN_MILLIS = 6_500;
    private static final long UNCONTESTED_MILLIS = 3_500;
    private static final long RUNOUT_MILLIS = 1_400;
    private static final int BOT_STACK = 1_000;

    /** Avvisi del tavolo: stato cambiato e fiches da restituire a chi si alza. */
    public interface Listener {
        void changed();

        void cashOut(String playerId, int chips, String reason);
    }

    /** Carattere di un NPC: quanto e' prudente, quanto aggressivo e quanto bluffa (da 0 a 1). */
    record Style(double tight, double aggression, double bluff) {
    }

    /** NPC che si siedono al tavolo: nome, aspetto (codice avatar) e carattere. */
    record Bot(String key, String name, String look, Style style) {
    }

    static final List<Bot> BOTS = List.of(
            new Bot("asso_nino", "Asso Nino", "s1.h0.hc7.sh8.p1.t3.f0.a2.b0.o1", new Style(0.6, 0.4, 0.05)),
            new Bot("donna_picche", "Donna Picche", "s3.h2.hc7.sh6.p1.t3.f2.a0.b1.o3", new Style(0.4, 0.7, 0.12)),
            new Bot("professore", "Il Professore", "s0.h9.hc9.sh9.p1.t2.f0.a1.b0.o11", new Style(0.8, 0.3, 0.03)),
            new Bot("zia_fiche", "Zia Fiche", "s2.h8.hc3.sh4.p1.t3.f0.a0.b1.o8", new Style(0.3, 0.5, 0.08)),
            new Bot("big_blind_bob", "Big Blind Bob", "s4.h5.hc7.sh9.p0.t1.f1.a3.b0", new Style(0.2, 0.85, 0.2)),
            new Bot("contessa", "La Contessa", "s1.h3.hc0.sh7.p1.t3.f0.a0.b1.o10", new Style(0.65, 0.55, 0.06)));

    static final class Seat {
        final String id;
        final String name;
        final String look;
        final Bot bot;
        int stack;
        final List<Card> hole = new ArrayList<>();
        int bet;
        int committed;
        boolean inHand;
        boolean folded;
        boolean allIn;
        boolean acted;
        boolean leaving;
        boolean show;
        int timeouts;
        int won;
        String lastAction;
        String handName;

        Seat(String id, String name, String look, Bot bot, int stack) {
            this.id = id;
            this.name = name;
            this.look = look;
            this.bot = bot;
            this.stack = stack;
        }

        boolean canAct() {
            return inHand && !folded && !allIn;
        }

        boolean live() {
            return inHand && !folded;
        }
    }

    private final String id;
    private final String name;
    private final RandomGenerator random;
    private final Listener listener;
    private final Seat[] seats = new Seat[SEATS];
    private final List<Card> board = new ArrayList<>();
    private final Deque<String> log = new ArrayDeque<>();
    private List<Card> deck = new ArrayList<>();
    private String phase = "waiting";
    private int button = -1;
    private int turn = -1;
    private int currentBet;
    private int minRaise = BIG_BLIND;
    private int pot;
    private int handNo;
    private long deadline;
    private long nextAt;
    private long botAt;
    private List<Map<String, Object>> results = List.of();

    public PokerTable(String id, String name, RandomGenerator random, Listener listener) {
        this.id = id;
        this.name = name;
        this.random = random;
        this.listener = listener;
    }

    public String id() {
        return id;
    }

    // ------------------------------------------------------------------ posti

    private int seatOf(String playerId) {
        for (int i = 0; i < SEATS; i++) if (seats[i] != null && seats[i].id.equals(playerId)) return i;
        return -1;
    }

    public synchronized boolean isSeated(String playerId) {
        int i = seatOf(playerId);
        return i >= 0 && !seats[i].leaving;
    }

    private int humans() {
        int n = 0;
        for (Seat s : seats) if (s != null && s.bot == null && !s.leaving) n++;
        return n;
    }

    /** Un giocatore vero si siede con le fiches gia' scalate. null se seduto, altrimenti l'errore. */
    public synchronized String sit(String playerId, String playerName, String look, int buyIn, long now) {
        if (seatOf(playerId) >= 0) return "poker_already_seated";
        int free = -1;
        for (int i = 0; i < SEATS && free < 0; i++) if (seats[i] == null) free = i;
        // Tavolo pieno di NPC: uno si alza (se e' in una mano, appena finisce).
        if (free < 0) {
            for (int i = 0; i < SEATS; i++) {
                if (seats[i] != null && seats[i].bot != null && !seats[i].inHand) {
                    say(seats[i].name + " cede il posto.");
                    seats[i] = null;
                    free = i;
                    break;
                }
            }
        }
        if (free < 0) return "poker_table_full";
        seats[free] = new Seat(playerId, playerName, look, null, buyIn);
        say(playerName + " si siede con " + buyIn + " fiches.");
        balanceBots();
        if ("waiting".equals(phase)) nextAt = now + 1_500;
        return null;
    }

    /**
     * Un giocatore si alza: se non e' in una mano le fiches tornano subito, altrimenti lascia la
     * mano (fold) e le fiches che gli restano tornano a fine mano.
     */
    public synchronized void stand(String playerId, long now) {
        int i = seatOf(playerId);
        if (i < 0) return;
        Seat s = seats[i];
        if (s.inHand && !s.folded && !"showdown".equals(phase) && !"waiting".equals(phase)) {
            s.leaving = true;
            if (turn == i) act(playerId, "fold", 0, now);
            else {
                s.folded = true;
                s.lastAction = "Lascia";
                advance(now);
            }
            say(s.name + " si alza dal tavolo.");
            return;
        }
        seats[i] = null;
        listener.cashOut(s.id, s.stack, "stand");
        say(s.name + " si alza con " + s.stack + " fiches.");
        balanceBots();
        if (turn == i) advance(now);
    }

    /** NPC al tavolo: tanti da arrivare a cinque giocatori, lasciando un posto libero per chi arriva. */
    private void balanceBots() {
        int humans = humans();
        int target = humans == 0 ? 3 : Math.max(0, Math.min(4, 5 - humans));
        int bots = 0;
        for (Seat s : seats) if (s != null && s.bot != null) bots++;
        while (bots < target) {
            int free = -1;
            for (int i = 0; i < SEATS && free < 0; i++) if (seats[i] == null) free = i;
            if (free < 0) break;
            Bot bot = pickBot();
            if (bot == null) break;
            seats[free] = new Seat("bot:" + bot.key(), bot.name(), bot.look(), bot, BOT_STACK);
            bots++;
        }
        // Troppi NPC (sono arrivati giocatori): si alzano quelli che non sono in una mano.
        for (int i = SEATS - 1; i >= 0 && bots > target; i--) {
            if (seats[i] != null && seats[i].bot != null && !seats[i].inHand) {
                seats[i] = null;
                bots--;
            }
        }
    }

    private Bot pickBot() {
        List<Bot> free = new ArrayList<>();
        for (Bot b : BOTS) if (seatOf("bot:" + b.key()) < 0) free.add(b);
        return free.isEmpty() ? null : free.get(random.nextInt(free.size()));
    }

    // ------------------------------------------------------------------ mano

    private int next(int from, java.util.function.Predicate<Seat> ok) {
        for (int k = 1; k <= SEATS; k++) {
            int i = Math.floorMod(from + k, SEATS);
            if (seats[i] != null && ok.test(seats[i])) return i;
        }
        return -1;
    }

    private void startHand(long now) {
        // Chi aveva finito le fiches o chiesto di alzarsi lascia il tavolo prima della mano nuova.
        for (int i = 0; i < SEATS; i++) {
            Seat s = seats[i];
            if (s == null) continue;
            if (s.leaving || (s.bot == null && s.stack == 0)) {
                seats[i] = null;
                listener.cashOut(s.id, s.stack, s.stack == 0 ? "busted" : "stand");
                if (s.stack == 0) say(s.name + " ha finito le fiches.");
            } else if (s.bot != null && s.stack < BIG_BLIND * 10) {
                s.stack = BOT_STACK;
                say(s.name + " ricompra le fiches.");
            }
        }
        balanceBots();
        results = List.of();
        board.clear();
        pot = 0;
        int players = 0;
        for (Seat s : seats) {
            if (s == null) continue;
            s.hole.clear();
            s.bet = 0;
            s.committed = 0;
            s.folded = false;
            s.allIn = false;
            s.acted = false;
            s.show = false;
            s.won = 0;
            s.handName = null;
            s.lastAction = null;
            s.inHand = s.stack > 0;
            if (s.inHand) players++;
        }
        // Senza giocatori veri al tavolo non si gioca (gli NPC aspettano).
        if (players < 2 || humans() == 0) {
            phase = "waiting";
            turn = -1;
            for (Seat s : seats) if (s != null) s.inHand = false;
            return;
        }
        handNo++;
        deck = CasinoGames.shoe(1, random);
        button = next(button, Seat::live);
        int sb;
        int bb;
        if (players == 2) {
            sb = button;
            bb = next(button, Seat::live);
        } else {
            sb = next(button, Seat::live);
            bb = next(sb, Seat::live);
        }
        put(seats[sb], SMALL_BLIND);
        seats[sb].lastAction = "Buio piccolo";
        put(seats[bb], BIG_BLIND);
        seats[bb].lastAction = "Buio grande";
        currentBet = BIG_BLIND;
        minRaise = BIG_BLIND;
        for (int round = 0; round < 2; round++) {
            for (int k = 1; k <= SEATS; k++) {
                Seat s = seats[Math.floorMod(button + k, SEATS)];
                if (s != null && s.inHand) s.hole.add(deck.removeFirst());
            }
        }
        phase = "preflop";
        say("Mano #" + handNo + ": bui " + SMALL_BLIND + "/" + BIG_BLIND + ".");
        setTurn(next(bb, Seat::canAct), now);
        if (turn < 0) advance(now);
    }

    private void put(Seat s, int amount) {
        int x = Math.min(amount, s.stack);
        s.stack -= x;
        s.bet += x;
        s.committed += x;
        if (s.stack == 0) s.allIn = true;
    }

    private void setTurn(int seat, long now) {
        turn = seat;
        if (seat < 0) return;
        deadline = now + TURN_MILLIS;
        Seat s = seats[seat];
        botAt = s.bot != null ? now + 900 + random.nextInt(1_400) : 0;
    }

    /** Azione di chi tocca: fold, check, call, raise (a quanto in tutto) o allin. null se valida. */
    public synchronized String act(String playerId, String action, int amount, long now) {
        int i = seatOf(playerId);
        if (i < 0) return "poker_not_seated";
        if (i != turn) return "poker_not_your_turn";
        Seat s = seats[i];
        int toCall = currentBet - s.bet;
        switch (action == null ? "" : action) {
            case "fold" -> {
                s.folded = true;
                s.lastAction = "Lascia";
            }
            case "check" -> {
                if (toCall > 0) return "poker_cannot_check";
                s.lastAction = "Check";
            }
            case "call" -> {
                if (toCall == 0) {
                    s.lastAction = "Check";
                } else {
                    put(s, toCall);
                    s.lastAction = s.allIn ? "All-in" : "Chiama " + s.bet;
                }
            }
            case "raise", "allin" -> {
                int max = s.bet + s.stack;
                int to = "allin".equals(action) ? max : Math.min(amount, max);
                if (to <= currentBet) {
                    // Non e' un rilancio: con tutte le fiches e' un call all-in.
                    if (to < max) return "poker_bad_raise";
                    put(s, to - s.bet);
                    s.lastAction = "All-in";
                } else {
                    if (to < currentBet + minRaise && to < max) return "poker_bad_raise";
                    int raiseBy = to - currentBet;
                    boolean opening = currentBet == 0;
                    put(s, to - s.bet);
                    if (raiseBy >= minRaise) minRaise = raiseBy;
                    currentBet = to;
                    s.lastAction = s.allIn ? "All-in " + to : opening ? "Punta " + to : "Rilancia a " + to;
                    // Dopo un rilancio tutti devono rispondere di nuovo.
                    for (Seat o : seats) if (o != null && o != s && o.canAct()) o.acted = false;
                }
            }
            default -> {
                return "poker_bad_action";
            }
        }
        s.acted = true;
        if (s.bot == null) s.timeouts = 0;
        advance(now);
        return null;
    }

    private int countLive() {
        int n = 0;
        for (Seat s : seats) if (s != null && s.live()) n++;
        return n;
    }

    private int countCanAct() {
        int n = 0;
        for (Seat s : seats) if (s != null && s.canAct()) n++;
        return n;
    }

    private void advance(long now) {
        if (!List.of("preflop", "flop", "turn", "river").contains(phase)) return;
        if (countLive() <= 1) {
            winUncontested(now);
            return;
        }
        boolean complete = true;
        for (Seat s : seats) if (s != null && s.canAct() && (!s.acted || s.bet < currentBet)) complete = false;
        if (complete) {
            nextStreet(now);
            return;
        }
        setTurn(next(turn, o -> o.canAct() && (!o.acted || o.bet < currentBet)), now);
    }

    private void collectBets() {
        for (Seat s : seats) {
            if (s == null) continue;
            pot += s.bet;
            s.bet = 0;
            s.acted = false;
        }
        currentBet = 0;
        minRaise = BIG_BLIND;
    }

    private void nextStreet(long now) {
        collectBets();
        switch (phase) {
            case "preflop" -> {
                phase = "flop";
                deck.removeFirst();
                for (int k = 0; k < 3; k++) board.add(deck.removeFirst());
            }
            case "flop" -> {
                phase = "turn";
                deck.removeFirst();
                board.add(deck.removeFirst());
            }
            case "turn" -> {
                phase = "river";
                deck.removeFirst();
                board.add(deck.removeFirst());
            }
            default -> {
                showdown(now);
                return;
            }
        }
        for (Seat s : seats) if (s != null && s.live()) s.lastAction = s.allIn ? "All-in" : null;
        if (countCanAct() <= 1) {
            // Tutti (o tutti meno uno) all-in: le carte escono da sole, una strada alla volta.
            turn = -1;
            for (Seat s : seats) if (s != null && s.live()) s.show = true;
            nextAt = now + RUNOUT_MILLIS;
            return;
        }
        setTurn(next(button, Seat::canAct), now);
    }

    private void winUncontested(long now) {
        collectBets();
        Seat winner = null;
        for (Seat s : seats) if (s != null && s.live()) winner = s;
        if (winner != null) {
            winner.stack += pot;
            winner.won = pot;
            say(winner.name + " vince " + pot + " fiches (gli altri hanno lasciato).");
            results = List.of(Map.of("name", winner.name, "amount", pot, "hand", ""));
        }
        pot = 0;
        phase = "showdown";
        turn = -1;
        nextAt = now + UNCONTESTED_MILLIS;
    }

    /** Showdown: si scoprono le carte e si dividono il piatto principale e quelli laterali. */
    private void showdown(long now) {
        Map<Seat, PokerEval.Hand> hands = new LinkedHashMap<>();
        for (Seat s : seats) {
            if (s == null || !s.live()) continue;
            List<Card> seven = new ArrayList<>(s.hole);
            seven.addAll(board);
            PokerEval.Hand h = PokerEval.best(seven);
            hands.put(s, h);
            s.show = true;
            s.handName = h.name();
        }
        // Livelli dei piatti: le puntate totali di chi e' ancora in gioco, dalla piu' piccola.
        List<Integer> levels = hands.keySet().stream().map(s -> s.committed).distinct().sorted().toList();
        int previous = 0;
        List<Map<String, Object>> out = new ArrayList<>();
        int distributed = 0;
        int total = pot;
        for (int li = 0; li < levels.size(); li++) {
            int level = levels.get(li);
            int part = 0;
            for (Seat s : seats) if (s != null) part += Math.max(0, Math.min(s.committed, level) - Math.min(s.committed, previous));
            // Le fiches di chi ha lasciato oltre l'ultimo livello finiscono nell'ultimo piatto.
            if (li == levels.size() - 1) part = total - distributed;
            previous = level;
            int lvl = level;
            List<Seat> eligible = hands.keySet().stream().filter(s -> s.committed >= lvl).toList();
            long best = eligible.stream().mapToLong(s -> hands.get(s).score()).max().orElse(0);
            List<Seat> winners = eligible.stream().filter(s -> hands.get(s).score() == best)
                    .sorted(Comparator.comparingInt(s -> Math.floorMod(indexOf(s) - button - 1, SEATS))).toList();
            if (winners.isEmpty() || part <= 0) continue;
            int share = part / winners.size();
            int odd = part - share * winners.size();
            for (int w = 0; w < winners.size(); w++) {
                Seat s = winners.get(w);
                int amount = share + (w < odd ? 1 : 0);
                s.stack += amount;
                s.won += amount;
            }
            distributed += part;
            String who = String.join(" e ", winners.stream().map(s -> s.name).toList());
            String label = li == 0 ? "piatto" : "piatto laterale";
            say(who + " vince il " + label + " di " + part + " con " + hands.get(winners.getFirst()).name() + ".");
            out.add(Map.of("name", who, "amount", part, "hand", hands.get(winners.getFirst()).name(), "side", li > 0));
        }
        results = out;
        pot = 0;
        phase = "showdown";
        turn = -1;
        nextAt = now + SHOWDOWN_MILLIS;
    }

    private int indexOf(Seat s) {
        for (int i = 0; i < SEATS; i++) if (seats[i] == s) return i;
        return -1;
    }

    // ------------------------------------------------------------------ tempo e NPC

    /** Da chiamare spesso: fa giocare gli NPC, scadere i turni e partire le mani. true se e' cambiato qualcosa. */
    public synchronized boolean tick(long now) {
        switch (phase) {
            case "waiting" -> {
                if (nextAt > 0 && now >= nextAt) {
                    nextAt = 0;
                    startHand(now);
                    return true;
                }
                return false;
            }
            case "showdown" -> {
                if (now >= nextAt) {
                    startHand(now);
                    return true;
                }
                return false;
            }
            default -> {
                if (turn < 0) {
                    if (now >= nextAt) {
                        nextStreet(now);
                        return true;
                    }
                    return false;
                }
                Seat s = seats[turn];
                if (s == null) {
                    advance(now);
                    return true;
                }
                if (s.bot != null && now >= botAt) {
                    botAct(s, now);
                    return true;
                }
                if (s.bot == null && now >= deadline) {
                    // Tempo scaduto: check se si puo', altrimenti si lascia. Due volte di fila: ci si alza.
                    int missed = s.timeouts + 1;
                    act(s.id, currentBet - s.bet == 0 ? "check" : "fold", 0, now);
                    s.timeouts = missed;
                    if (missed >= 2) {
                        s.leaving = true;
                        say(s.name + " non risponde: si alza alla fine della mano.");
                    }
                    return true;
                }
                return false;
            }
        }
    }

    private void botAct(Seat s, long now) {
        Style style = s.bot.style();
        double strength = board.isEmpty() ? PokerEval.preflopStrength(s.hole.get(0), s.hole.get(1))
                : PokerEval.madeStrength(PokerEval.best(concat(s.hole, board)), board);
        strength += random.nextDouble() * 0.16 - 0.08;
        int toCall = currentBet - s.bet;
        int potTotal = pot;
        for (Seat o : seats) if (o != null) potTotal += o.bet;
        double odds = toCall == 0 ? 0 : (double) toCall / (potTotal + toCall);
        boolean bluff = random.nextDouble() < style.bluff();
        String result;
        if (toCall == 0) {
            if (strength > 0.66 - style.aggression() * 0.12 || bluff) {
                result = act(s.id, "raise", raiseTo(potTotal, 0.5 + random.nextDouble() * 0.3, s), now);
            } else {
                result = act(s.id, "check", 0, now);
            }
        } else if ((strength > 0.82 - style.aggression() * 0.12 && random.nextDouble() < 0.65) || (bluff && toCall <= BIG_BLIND * 3)) {
            result = act(s.id, "raise", raiseTo(potTotal, 0.7 + random.nextDouble() * 0.4, s), now);
        } else if (strength >= odds + style.tight() * 0.14 || (toCall <= BIG_BLIND && strength > 0.28)) {
            result = act(s.id, "call", 0, now);
        } else {
            result = act(s.id, "fold", 0, now);
        }
        if (result != null) act(s.id, toCall == 0 ? "check" : "call", 0, now);
    }

    private int raiseTo(int potTotal, double fraction, Seat s) {
        int size = Math.max(minRaise, (int) Math.round(potTotal * fraction / 5.0) * 5);
        int to = currentBet + size;
        int max = s.bet + s.stack;
        return to >= max * 0.8 ? max : to;
    }

    private static List<Card> concat(List<Card> a, List<Card> b) {
        List<Card> all = new ArrayList<>(a);
        all.addAll(b);
        return all;
    }

    private void say(String line) {
        log.addLast(line);
        while (log.size() > 8) log.removeFirst();
    }

    /** Tutti i giocatori veri seduti, con le fiches davanti (per restituirle se il server si ferma). */
    public synchronized Map<String, Integer> humanStacks() {
        Map<String, Integer> map = new LinkedHashMap<>();
        // A meta' mano tornano anche le fiches gia' puntate (la mano non si gioca piu').
        boolean betting = List.of("preflop", "flop", "turn", "river").contains(phase);
        for (Seat s : seats) if (s != null && s.bot == null) map.put(s.id, s.stack + (betting ? s.committed : 0));
        return map;
    }

    /** Fiches sul tavolo (davanti ai giocatori, puntate e nel piatto): per i test. */
    synchronized int totalChips() {
        int total = pot;
        for (Seat x : seats) if (x != null) total += x.stack + x.bet;
        return total;
    }

    synchronized int handNumber() {
        return handNo;
    }

    synchronized String phase() {
        return phase;
    }

    // ------------------------------------------------------------------ viste

    /** Lo stato del tavolo come lo vede `viewerId`: le sue carte coperte, quelle degli altri no. */
    public synchronized Map<String, Object> view(String viewerId, long now) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", id);
        view.put("name", name);
        view.put("smallBlind", SMALL_BLIND);
        view.put("bigBlind", BIG_BLIND);
        view.put("minBuyIn", MIN_BUY_IN);
        view.put("maxBuyIn", MAX_BUY_IN);
        view.put("phase", phase);
        view.put("hand", handNo);
        view.put("board", CasinoGames.codes(board));
        int bets = 0;
        for (Seat s : seats) if (s != null) bets += s.bet;
        view.put("pot", pot + bets);
        view.put("currentBet", currentBet);
        view.put("button", button);
        view.put("turn", turn);
        view.put("turnLeft", turn >= 0 ? Math.max(0, deadline - now) : 0);
        view.put("turnMillis", TURN_MILLIS);
        view.put("results", results);
        view.put("log", List.copyOf(log));
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < SEATS; i++) {
            Seat s = seats[i];
            Map<String, Object> seat = new LinkedHashMap<>();
            seat.put("seat", i);
            if (s == null) {
                seat.put("empty", true);
                list.add(seat);
                continue;
            }
            seat.put("name", s.name);
            seat.put("look", s.look);
            seat.put("bot", s.bot != null);
            seat.put("me", s.id.equals(viewerId));
            seat.put("stack", s.stack);
            seat.put("bet", s.bet);
            seat.put("inHand", s.inHand);
            seat.put("folded", s.folded);
            seat.put("allIn", s.allIn);
            seat.put("action", s.lastAction);
            seat.put("won", s.won);
            seat.put("handName", s.show ? s.handName : null);
            boolean visible = s.id.equals(viewerId) || (s.show && !s.folded);
            seat.put("cards", s.hole.isEmpty() ? List.of() : visible ? CasinoGames.codes(s.hole) : List.of("??", "??"));
            list.add(seat);
        }
        view.put("seats", list);
        int me = seatOf(viewerId);
        if (me >= 0) {
            Seat s = seats[me];
            Map<String, Object> you = new LinkedHashMap<>();
            you.put("seat", me);
            you.put("stack", s.stack);
            boolean myTurn = turn == me;
            you.put("myTurn", myTurn);
            int toCall = Math.max(0, Math.min(currentBet - s.bet, s.stack));
            you.put("toCall", toCall);
            you.put("canCheck", currentBet - s.bet <= 0);
            you.put("minRaiseTo", Math.min(currentBet + minRaise, s.bet + s.stack));
            you.put("maxRaiseTo", s.bet + s.stack);
            you.put("leaving", s.leaving);
            if (s.hole.size() == 2 && !s.folded) {
                List<Card> mine = concat(s.hole, board);
                you.put("handName", mine.size() >= 5 ? PokerEval.best(mine).name() : null);
            }
            view.put("you", you);
        }
        return view;
    }
}
