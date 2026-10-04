package com.capstone.vinyldex.casino;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;

/**
 * Bingo a 90 numeri (quello europeo, parente della tombola): cartelle da tre righe e nove colonne
 * con quindici numeri (cinque per riga; la prima colonna va da 1 a 9, la seconda da 10 a 19...
 * l'ultima da 80 a 90). Il banditore estrae una pallina alla volta; si vince la linea (una riga
 * completa), la doppia linea (due righe) e il bingo (tutta la cartella). Chi completa alla stessa
 * pallina divide il premio.
 *
 * Il gioco e' un oggetto a se' (senza soldi ne' rete): chi lo usa gli passa il tempo (tick) e gli
 * acquisti delle cartelle, e riceve i vincitori dal Listener per pagarli.
 *
 * Il montepremi e' il 90% delle cartelle vendute (anche quelle degli NPC, cosi' la vincita attesa
 * di ogni cartella e' la stessa per tutti): 15% alla linea, 25% alla doppia linea, 60% al bingo. Il
 * 10% che resta va nel jackpot, che si vince facendo bingo entro JACKPOT_CALLS numeri.
 */
public final class BingoGame {

    public static final int CARD_PRICE = 10;
    public static final int MAX_CARDS = 6;
    public static final int JACKPOT_CALLS = 45;
    public static final int JACKPOT_SEED = 500;
    static final long SALE_MILLIS = 45_000;
    static final long CALL_MILLIS = 2_800;
    static final long PRIZE_PAUSE_MILLIS = 4_000;
    static final long END_MILLIS = 12_000;

    /** I tre premi, nell'ordine in cui si vincono, con la quota del montepremi (in centesimi). */
    public enum Prize {
        LINE("Linea", 15), TWO_LINES("Doppia linea", 25), BINGO("Bingo", 60);

        public final String label;
        final int share;

        Prize(String label, int share) {
            this.label = label;
            this.share = share;
        }
    }

    public interface Listener {
        /** Vincita da pagare (i giocatori veri; quelle degli NPC si ignorano). */
        void pay(String playerId, int chips, String reason);
    }

    /** Cartella: tre righe da nove caselle, 0 dove non c'e' numero. */
    public record Card(int[][] rows) {

        boolean rowDone(int r, Set<Integer> drawn) {
            for (int n : rows[r]) if (n != 0 && !drawn.contains(n)) return false;
            return true;
        }

        int linesDone(Set<Integer> drawn) {
            int lines = 0;
            for (int r = 0; r < 3; r++) if (rowDone(r, drawn)) lines++;
            return lines;
        }

        /** Numeri che mancano alla prossima vincita di questo tipo (la riga piu' vicina, o la cartella). */
        int missingFor(Prize prize, Set<Integer> drawn) {
            int[] missing = new int[3];
            for (int r = 0; r < 3; r++) for (int n : rows[r]) if (n != 0 && !drawn.contains(n)) missing[r]++;
            int[] sorted = missing.clone();
            java.util.Arrays.sort(sorted);
            return switch (prize) {
                case LINE -> sorted[0];
                case TWO_LINES -> sorted[0] + sorted[1];
                case BINGO -> sorted[0] + sorted[1] + sorted[2];
            };
        }

        List<List<Integer>> view() {
            List<List<Integer>> list = new ArrayList<>();
            for (int[] row : rows) {
                List<Integer> r = new ArrayList<>();
                for (int n : row) r.add(n);
                list.add(r);
            }
            return list;
        }
    }

    /** Cartella a caso valida: cinque numeri per riga in colonne diverse, ogni colonna usata. */
    static Card randomCard(RandomGenerator random) {
        while (true) {
            int[][] rows = new int[3][9];
            int[] perColumn = new int[9];
            for (int r = 0; r < 3; r++) {
                List<Integer> cols = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5, 6, 7, 8));
                Collections.shuffle(cols, new java.util.Random(random.nextLong()));
                for (int k = 0; k < 5; k++) {
                    rows[r][cols.get(k)] = -1;
                    perColumn[cols.get(k)]++;
                }
            }
            boolean ok = true;
            for (int c : perColumn) if (c == 0) ok = false;
            if (!ok) continue;
            for (int c = 0; c < 9; c++) {
                int from = c == 0 ? 1 : c * 10;
                int to = c == 8 ? 90 : c * 10 + 9;
                List<Integer> pool = new ArrayList<>();
                for (int n = from; n <= to; n++) pool.add(n);
                Collections.shuffle(pool, new java.util.Random(random.nextLong()));
                List<Integer> picked = new ArrayList<>(pool.subList(0, perColumn[c]));
                Collections.sort(picked);
                int i = 0;
                for (int r = 0; r < 3; r++) if (rows[r][c] == -1) rows[r][c] = picked.get(i++);
            }
            return new Card(rows);
        }
    }

    /** Chi gioca: giocatore vero o NPC, con le sue cartelle. */
    static final class Player {
        final String id;
        final String name;
        final boolean bot;
        final List<Card> cards = new ArrayList<>();
        int paid;
        int won;

        Player(String id, String name, boolean bot) {
            this.id = id;
            this.name = name;
            this.bot = bot;
        }
    }

    /** Giocatori del Bingo fra gli NPC del casino (comprano qualche cartella a ogni partita). */
    static final List<String> BOT_NAMES = List.of("Nonna Pina", "Zio Gennaro", "Signora Carmela", "Il Ragioniere", "Donna Assunta",
            "Peppino", "Zia Titina", "Il Commendatore", "Rosetta", "Don Ciccio");

    private final RandomGenerator random;
    private final Listener listener;
    private final Map<String, Player> players = new LinkedHashMap<>();
    private final List<Integer> drawn = new ArrayList<>();
    private final Set<Integer> drawnSet = new LinkedHashSet<>();
    private final List<Map<String, Object>> winners = new ArrayList<>();
    private final List<Map<String, Object>> lastRound = new ArrayList<>();
    private List<Integer> bag = new ArrayList<>();
    private String phase = "idle";
    private Prize next = Prize.LINE;
    private long nextAt;
    private int round;
    private int jackpot = JACKPOT_SEED;
    private String lastJackpotWinner;

    public BingoGame(RandomGenerator random, Listener listener) {
        this.random = random;
        this.listener = listener;
    }

    private int ticketsSold() {
        int n = 0;
        for (Player p : players.values()) n += p.cards.size();
        return n;
    }

    private int humanTickets() {
        int n = 0;
        for (Player p : players.values()) if (!p.bot) n += p.cards.size();
        return n;
    }

    /** Montepremi della partita: il 90% delle cartelle vendute. */
    public synchronized int pot() {
        return ticketsSold() * CARD_PRICE * 9 / 10;
    }

    int prizeAmount(Prize prize) {
        return pot() * prize.share / 100;
    }

    /**
     * Un giocatore vero compra `count` cartelle (le fiches sono gia' scalate da chi chiama).
     * null se va bene, altrimenti il codice d'errore. Si compra solo durante la vendita (o
     * quando il tavolo e' fermo: la prima cartella fa partire la vendita).
     */
    public synchronized String buy(String playerId, String name, int count, long now) {
        if (!"sale".equals(phase) && !"idle".equals(phase)) return "bingo_not_selling";
        Player p = players.computeIfAbsent(playerId, id -> new Player(id, name, false));
        if (count < 1 || p.cards.size() + count > MAX_CARDS) return "bingo_too_many";
        for (int i = 0; i < count; i++) p.cards.add(randomCard(random));
        p.paid += count * CARD_PRICE;
        // La casa mette il 10% delle cartelle dei giocatori nel jackpot.
        jackpot += count * CARD_PRICE / 10;
        if ("idle".equals(phase)) {
            phase = "sale";
            nextAt = now + SALE_MILLIS;
            round++;
        }
        return null;
    }

    /** Chi esce dal casino prima dell'estrazione riprende le fiches delle cartelle. */
    public synchronized int refund(String playerId) {
        if (!"sale".equals(phase)) return 0;
        Player p = players.get(playerId);
        if (p == null || p.bot) return 0;
        players.remove(playerId);
        jackpot -= p.cards.size() * CARD_PRICE / 10;
        if (humanTickets() == 0) {
            players.clear();
            phase = "idle";
        }
        return p.paid;
    }

    private void addBots() {
        List<String> names = new ArrayList<>(BOT_NAMES);
        Collections.shuffle(names, new java.util.Random(random.nextLong()));
        int bots = 4 + random.nextInt(5);
        for (int i = 0; i < bots; i++) {
            Player p = new Player("bot:" + names.get(i), names.get(i), true);
            int cards = 1 + random.nextInt(MAX_CARDS);
            for (int c = 0; c < cards; c++) p.cards.add(randomCard(random));
            players.put(p.id, p);
        }
    }

    /** Da chiamare spesso: chiude la vendita, estrae le palline, paga i premi. true se e' cambiato qualcosa. */
    public synchronized boolean tick(long now) {
        if (nextAt == 0 || now < nextAt) return false;
        switch (phase) {
            case "sale" -> {
                addBots();
                bag = new ArrayList<>();
                for (int n = 1; n <= 90; n++) bag.add(n);
                Collections.shuffle(bag, new java.util.Random(random.nextLong()));
                drawn.clear();
                drawnSet.clear();
                winners.clear();
                next = Prize.LINE;
                phase = "calling";
                nextAt = now + 1_500;
                return true;
            }
            case "calling" -> {
                if (bag.isEmpty()) {
                    end(now);
                    return true;
                }
                int ball = bag.removeFirst();
                drawn.add(ball);
                drawnSet.add(ball);
                nextAt = now + CALL_MILLIS;
                checkPrizes(now);
                return true;
            }
            case "ended" -> {
                // Pausa finita: torna la vendita per la partita dopo (se qualcuno compra).
                players.clear();
                phase = "idle";
                nextAt = 0;
                return true;
            }
            default -> {
                return false;
            }
        }
    }

    /** Dopo ogni pallina: chi ha completato la vincita in palio la divide con gli altri alla stessa pallina. */
    private void checkPrizes(long now) {
        while (next != null) {
            List<Player> got = new ArrayList<>();
            for (Player p : players.values()) {
                boolean done = false;
                for (Card c : p.cards) {
                    int lines = c.linesDone(drawnSet);
                    if ((next == Prize.LINE && lines >= 1) || (next == Prize.TWO_LINES && lines >= 2) || (next == Prize.BINGO && lines == 3)) done = true;
                }
                if (done) got.add(p);
            }
            if (got.isEmpty()) return;
            int amount = prizeAmount(next);
            int share = amount / got.size();
            boolean jackpotWin = next == Prize.BINGO && drawn.size() <= JACKPOT_CALLS;
            for (Player p : got) {
                p.won += share;
                if (!p.bot && share > 0) listener.pay(p.id, share, next.label);
            }
            Map<String, Object> w = new LinkedHashMap<>();
            w.put("prize", next.name());
            w.put("label", next.label);
            w.put("names", got.stream().map(p -> p.name).toList());
            w.put("amount", share);
            w.put("ball", drawn.size());
            winners.add(w);
            if (jackpotWin) {
                // Jackpot: ai giocatori veri che hanno fatto bingo entro i 45 numeri.
                List<Player> humans = got.stream().filter(p -> !p.bot).toList();
                if (!humans.isEmpty()) {
                    int each = jackpot / humans.size();
                    for (Player p : humans) {
                        p.won += each;
                        listener.pay(p.id, each, "Jackpot");
                    }
                    w.put("jackpot", each);
                    lastJackpotWinner = String.join(", ", humans.stream().map(p -> p.name).toList());
                }
                jackpot = JACKPOT_SEED;
            }
            nextAt = now + PRIZE_PAUSE_MILLIS;
            next = switch (next) {
                case LINE -> Prize.TWO_LINES;
                case TWO_LINES -> Prize.BINGO;
                case BINGO -> null;
            };
            if (next == null) {
                end(now);
                return;
            }
        }
    }

    private void end(long now) {
        phase = "ended";
        nextAt = now + END_MILLIS;
        lastRound.clear();
        lastRound.addAll(winners);
    }

    // ------------------------------------------------------------------ viste

    /** Lo stato per `viewerId`: le sue cartelle (con quanti numeri mancano), il resto uguale per tutti. */
    public synchronized Map<String, Object> view(String viewerId, long now) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase);
        view.put("round", round);
        view.put("left", nextAt > 0 ? Math.max(0, nextAt - now) : 0);
        view.put("price", CARD_PRICE);
        view.put("maxCards", MAX_CARDS);
        view.put("drawn", List.copyOf(drawn));
        view.put("last", drawn.isEmpty() ? null : drawn.getLast());
        view.put("pot", pot());
        Map<String, Integer> prizes = new LinkedHashMap<>();
        for (Prize p : Prize.values()) prizes.put(p.name(), prizeAmount(p));
        view.put("prizes", prizes);
        view.put("next", next == null ? null : next.name());
        view.put("jackpot", jackpot);
        view.put("jackpotCalls", JACKPOT_CALLS);
        view.put("lastJackpotWinner", lastJackpotWinner);
        view.put("winners", "ended".equals(phase) || "idle".equals(phase) ? List.copyOf(lastRound) : List.copyOf(winners));
        view.put("players", players.size());
        view.put("tickets", ticketsSold());
        // Quante cartelle sono a un numero dalla vincita in palio (la tensione in sala).
        int oneAway = 0;
        if ("calling".equals(phase) && next != null) {
            for (Player p : players.values()) for (Card c : p.cards) if (c.missingFor(next, drawnSet) == 1) oneAway++;
        }
        view.put("oneAway", oneAway);
        Player me = players.get(viewerId);
        if (me != null) {
            List<Map<String, Object>> cards = new ArrayList<>();
            for (Card c : me.cards) {
                Map<String, Object> card = new LinkedHashMap<>();
                card.put("rows", c.view());
                card.put("missing", next == null ? 0 : c.missingFor(next, drawnSet));
                card.put("lines", c.linesDone(drawnSet));
                cards.add(card);
            }
            view.put("myCards", cards);
            view.put("myWon", me.won);
            view.put("myPaid", me.paid);
        } else {
            view.put("myCards", List.of());
        }
        return view;
    }

    /** Il server si ferma: a vendita aperta tutte le cartelle dei giocatori vanno rimborsate. */
    public synchronized Map<String, Integer> refundAll() {
        Map<String, Integer> out = new LinkedHashMap<>();
        if (!"sale".equals(phase)) return out;
        for (Player p : players.values()) if (!p.bot && p.paid > 0) out.put(p.id, p.paid);
        players.clear();
        phase = "idle";
        return out;
    }

    /** Per i test: le fiches pagate in premi e quelle incassate dalle cartelle. */
    synchronized List<Player> playersForTest() {
        return List.copyOf(players.values());
    }

    synchronized String phase() {
        return phase;
    }

    synchronized int jackpot() {
        return jackpot;
    }
}
