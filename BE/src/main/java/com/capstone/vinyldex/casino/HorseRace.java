package com.capstone.vinyldex.casino;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Ippodromo del casino: una corsa di otto cavalli per tutto il server, a ciclo continuo.
 *
 * Fasi: "betting" (si punta, 45 s), "racing" (la corsa, circa 20 s), "result" (l'arrivo e i
 * pagamenti, 10 s), poi la corsa dopo con un campo nuovo.
 *
 * Le quote sono fisse, come dal bookmaker: ogni cavallo ha una forza (valutazione piu' la forma
 * del giorno) e l'ordine d'arrivo si estrae col modello di Plackett-Luce, in cui la probabilita'
 * di vincere e' la forza diviso la somma delle forze. Da li' si calcolano esattamente le
 * probabilita' di ogni scommessa, e la quota e' {@link #MARGIN} diviso la probabilita': in media
 * torna ai giocatori l'88% di quanto puntano, qualunque scommessa scelgano.
 *
 * Scommesse: vincente (primo), piazzato (fra i primi tre), accoppiata (primo e secondo in ordine),
 * trio (i primi tre in ordine). La quota si blocca quando si punta e la vincita (posta compresa)
 * arriva appena i cavalli tagliano il traguardo, anche a chi intanto e' uscito dal casino.
 *
 * Classe pura, senza Spring: il tempo arriva da fuori, cosi' i test girano senza aspettare.
 */
public class HorseRace {

    public static final int FIELD = 8;
    public static final int MIN_STAKE = 5;
    public static final int MAX_STAKE = 500;
    public static final int MAX_BETS = 12;
    public static final double MARGIN = 0.88;
    static final long BETTING_MS = 45_000;
    static final long RESULT_MS = 10_000;
    /** Tempo del vincitore: gli altri arrivano dopo, a qualche decimo l'uno dall'altro. */
    static final long WINNER_MS = 18_000;

    public enum Type {
        WIN(1, "Vincente"), PLACE(1, "Piazzato"), EXACTA(2, "Accoppiata"), TRIFECTA(3, "Trio");

        final int horses;
        final String label;

        Type(int horses, String label) {
            this.horses = horses;
            this.label = label;
        }
    }

    /** Chi riceve le vincite (il servizio, che le accredita). */
    public interface Listener {
        void pay(String playerId, int chips, String reason);
    }

    record Stable(String name, String silk, int rating) {
    }

    /** Scuderia: si pescano otto cavalli a corsa. Nomi inventati, nessun cavallo vero. */
    static final List<Stable> STABLE = List.of(
            new Stable("Saetta Nera", "#111827", 92), new Stable("Fulmine di Romagna", "#dc2626", 90),
            new Stable("Vento del Sud", "#2563eb", 88), new Stable("Stella d'Agnano", "#facc15", 86),
            new Stable("Re di Coppe", "#7c3aed", 84), new Stable("Capitan Trottola", "#ea580c", 80),
            new Stable("Nebbia Padana", "#9ca3af", 79), new Stable("Bella Vinile", "#ec4899", 78),
            new Stable("Dama di Picche", "#0f766e", 77), new Stable("Ciuccio Veloce", "#a16207", 72),
            new Stable("Groove Express", "#22c55e", 82), new Stable("Mezzanotte", "#1e3a8a", 85),
            new Stable("Pizza e Fichi", "#b91c1c", 70), new Stable("Ultimo Treno", "#64748b", 74),
            new Stable("Brivido Blu", "#0ea5e9", 81), new Stable("Sogno d'Oro", "#ca8a04", 76));

    static final class Horse {
        final int number;
        final String name;
        final String silk;
        final int rating;
        final int form;
        final double strength;
        double p;
        long finishMs;
        double[] splits;

        Horse(int number, Stable s, int form) {
            this.number = number;
            this.name = s.name();
            this.silk = s.silk();
            this.rating = s.rating();
            this.form = form;
            this.strength = Math.exp((s.rating() + form - 80) / 7.0);
        }
    }

    static final class Bet {
        final String playerId;
        final String name;
        final Type type;
        final int[] horses;
        final int stake;
        final double odds;
        Integer paid;

        Bet(String playerId, String name, Type type, int[] horses, int stake, double odds) {
            this.playerId = playerId;
            this.name = name;
            this.type = type;
            this.horses = horses;
            this.stake = stake;
            this.odds = odds;
        }
    }

    private static final String[] PUNTERS = {"Zio Gennaro", "Nonna Pina", "Il Professore", "Don Ciccio", "Signora Carmela",
            "Asso Nino", "Donna Picche", "Il Barone", "Tonino Totip", "Lady Luck", "High Roller", "Rosetta"};

    private final Random random;
    private final Listener listener;
    private String phase = "betting";
    private int round = 0;
    private long phaseEnds;
    private long raceStart;
    private List<Horse> horses = new ArrayList<>();
    private final List<Bet> bets = new ArrayList<>();
    private final List<Map<String, Object>> feed = new ArrayList<>();
    private final List<Map<String, Object>> history = new ArrayList<>();
    private int[] order = new int[0];

    public HorseRace(Random random, Listener listener) {
        this.random = random;
        this.listener = listener;
    }

    // ------------------------------------------------------------------ corsa

    /** Fa avanzare la corsa; true se lo stato visibile e' cambiato (va mandato a tutti). */
    public synchronized boolean tick(long now) {
        if (round == 0) {
            newRace(now);
            return true;
        }
        switch (phase) {
            case "betting" -> {
                if (now >= phaseEnds) {
                    startRace(now);
                    return true;
                }
                // Gli habitue' puntano anche loro: solo per la cronaca, non toccano le quote.
                if (random.nextInt(40) == 0 && feed.size() < 60) {
                    npcBet();
                    return true;
                }
                return false;
            }
            case "racing" -> {
                if (now >= phaseEnds) {
                    finish(now);
                    return true;
                }
                return false;
            }
            default -> {
                if (now >= phaseEnds) {
                    newRace(now);
                    return true;
                }
                return false;
            }
        }
    }

    private void newRace(long now) {
        round++;
        phase = "betting";
        phaseEnds = now + BETTING_MS;
        bets.clear();
        feed.clear();
        order = new int[0];
        List<Stable> pool = new ArrayList<>(STABLE);
        horses = new ArrayList<>();
        for (int i = 0; i < FIELD; i++) {
            Stable s = pool.remove(random.nextInt(pool.size()));
            horses.add(new Horse(i + 1, s, random.nextInt(13) - 6));
        }
        double total = horses.stream().mapToDouble(h -> h.strength).sum();
        for (Horse h : horses) h.p = h.strength / total;
    }

    private void startRace(long now) {
        phase = "racing";
        raceStart = now;
        // Ordine d'arrivo (Plackett-Luce): si estrae il primo fra tutti, il secondo fra i rimasti...
        List<Horse> left = new ArrayList<>(horses);
        order = new int[FIELD];
        long time = WINNER_MS;
        for (int place = 0; place < FIELD; place++) {
            double total = left.stream().mapToDouble(h -> h.strength).sum();
            double r = random.nextDouble() * total;
            Horse pick = left.getLast();
            for (Horse h : left) {
                r -= h.strength;
                if (r <= 0) {
                    pick = h;
                    break;
                }
            }
            left.remove(pick);
            order[place] = pick.number;
            pick.finishMs = time;
            time += 120 + random.nextInt(place < 3 ? 380 : 700);
            pick.splits = splits();
        }
        phaseEnds = now + time + 600;
    }

    /**
     * Distanza percorsa (da 0 a 1) a un quarto, meta' e tre quarti del proprio tempo: un po' di
     * caso, cosi' la testa della corsa cambia, ma all'arrivo l'ordine e' quello estratto.
     */
    private double[] splits() {
        double[] s = new double[3];
        double prev = 0;
        for (int k = 0; k < 3; k++) {
            double v = (k + 1) / 4.0 + (random.nextDouble() - 0.5) * 0.12;
            prev = Math.max(prev + 0.08, Math.min(0.97, v));
            s[k] = Math.round(prev * 1000) / 1000.0;
        }
        return s;
    }

    private void finish(long now) {
        phase = "result";
        phaseEnds = now + RESULT_MS;
        for (Bet bet : bets) {
            bet.paid = wins(bet) ? (int) Math.floor(bet.stake * bet.odds) : 0;
            if (bet.paid > 0 && bet.playerId != null) {
                listener.pay(bet.playerId, bet.paid, bet.type.label + " " + describe(bet.horses));
            }
        }
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("round", round);
        h.put("winner", order[0]);
        h.put("name", horse(order[0]).name);
        h.put("silk", horse(order[0]).silk);
        h.put("odds", oddsOf(Type.WIN, new int[]{order[0]}));
        history.addFirst(h);
        while (history.size() > 6) history.removeLast();
    }

    boolean wins(Bet bet) {
        int[] h = bet.horses;
        return switch (bet.type) {
            case WIN -> order[0] == h[0];
            case PLACE -> order[0] == h[0] || order[1] == h[0] || order[2] == h[0];
            case EXACTA -> order[0] == h[0] && order[1] == h[1];
            case TRIFECTA -> order[0] == h[0] && order[1] == h[1] && order[2] == h[2];
        };
    }

    // ------------------------------------------------------------------ quote

    Horse horse(int number) {
        return horses.stream().filter(h -> h.number == number).findFirst().orElse(null);
    }

    /** Probabilita' esatta che la scommessa vinca, col modello di Plackett-Luce. */
    double probability(Type type, int[] h) {
        return switch (type) {
            case WIN -> p(h[0]);
            case EXACTA -> p(h[0]) * p(h[1]) / (1 - p(h[0]));
            case TRIFECTA -> p(h[0]) * p(h[1]) / (1 - p(h[0])) * p(h[2]) / (1 - p(h[0]) - p(h[1]));
            case PLACE -> {
                double sum = p(h[0]);
                for (Horse a : horses) {
                    if (a.number == h[0]) continue;
                    sum += probability(Type.EXACTA, new int[]{a.number, h[0]});
                    for (Horse b : horses) {
                        if (b.number == h[0] || b.number == a.number) continue;
                        sum += probability(Type.TRIFECTA, new int[]{a.number, b.number, h[0]});
                    }
                }
                yield sum;
            }
        };
    }

    private double p(int number) {
        return horse(number).p;
    }

    /** Quota (posta compresa), a due decimali, almeno 1,01 e al massimo 999. */
    public double oddsOf(Type type, int[] h) {
        double q = MARGIN / probability(type, h);
        return Math.max(1.01, Math.min(999, Math.floor(q * 100) / 100.0));
    }

    // ------------------------------------------------------------------ puntate

    /** Punta: null se va bene, altrimenti il codice d'errore. Le fiches le scala il servizio prima. */
    public synchronized String bet(String playerId, String name, Type type, int[] picks, int stake) {
        if (!"betting".equals(phase) || round == 0) return "horse_not_betting";
        if (type == null || picks == null || picks.length != type.horses) return "horse_bad_bet";
        if (stake < MIN_STAKE || stake > MAX_STAKE) return "horse_bad_stake";
        if (Arrays.stream(picks).distinct().count() != picks.length) return "horse_bad_bet";
        for (int n : picks) if (horse(n) == null) return "horse_bad_bet";
        if (bets.stream().filter(b -> playerId.equals(b.playerId)).count() >= MAX_BETS) return "horse_too_many";
        Bet bet = new Bet(playerId, name, type, picks.clone(), stake, oddsOf(type, picks));
        bets.add(bet);
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("name", name);
        f.put("bet", type.label + " " + describe(picks));
        f.put("stake", stake);
        feed.addFirst(f);
        return null;
    }

    private void npcBet() {
        Type type = Type.values()[random.nextInt(10) < 6 ? 0 : random.nextInt(4)];
        // Gli habitue' puntano piu' spesso sui favoriti.
        List<Horse> byP = new ArrayList<>(horses);
        byP.sort((a, b) -> Double.compare(b.p, a.p));
        List<Integer> picks = new ArrayList<>();
        while (picks.size() < type.horses) {
            int n = byP.get(Math.min(FIELD - 1, (int) Math.floor(Math.pow(random.nextDouble(), 1.6) * FIELD))).number;
            if (!picks.contains(n)) picks.add(n);
        }
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("name", PUNTERS[random.nextInt(PUNTERS.length)]);
        f.put("bet", type.label + " " + describe(picks.stream().mapToInt(Integer::intValue).toArray()));
        f.put("stake", (1 + random.nextInt(20)) * 10);
        f.put("npc", true);
        feed.addFirst(f);
    }

    private String describe(int[] picks) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < picks.length; i++) {
            if (i > 0) s.append(" - ");
            Horse h = horse(picks[i]);
            s.append(picks[i]).append(' ').append(h == null ? "?" : h.name);
        }
        return s.toString();
    }

    /** Server che si ferma prima dell'arrivo: le puntate ancora aperte tornano indietro. */
    public synchronized Map<String, Integer> refundAll() {
        Map<String, Integer> out = new HashMap<>();
        if (!"result".equals(phase)) {
            for (Bet b : bets) if (b.playerId != null && b.paid == null) out.merge(b.playerId, b.stake, Integer::sum);
        }
        bets.clear();
        return out;
    }

    // ------------------------------------------------------------------ vista

    public synchronized Map<String, Object> view(String viewerId, long now) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("phase", phase);
        v.put("round", round);
        v.put("left", Math.max(0, phaseEnds - now));
        v.put("minStake", MIN_STAKE);
        v.put("maxStake", MAX_STAKE);
        v.put("maxBets", MAX_BETS);
        v.put("margin", MARGIN);
        boolean running = !"betting".equals(phase);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Horse h : horses) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("number", h.number);
            m.put("name", h.name);
            m.put("silk", h.silk);
            m.put("rating", h.rating);
            m.put("form", h.form);
            m.put("p", h.p);
            m.put("win", oddsOf(Type.WIN, new int[]{h.number}));
            m.put("place", oddsOf(Type.PLACE, new int[]{h.number}));
            // La corsa si conosce solo quando parte.
            if (running) {
                m.put("finishMs", h.finishMs);
                m.put("splits", h.splits);
            }
            list.add(m);
        }
        v.put("horses", list);
        if (running) v.put("elapsed", now - raceStart);
        if ("result".equals(phase)) v.put("order", order);
        v.put("feed", feed.subList(0, Math.min(10, feed.size())));
        v.put("history", history);
        List<Map<String, Object>> mine = new ArrayList<>();
        int staked = 0;
        int won = 0;
        for (Bet b : bets) {
            if (!b.playerId.equals(viewerId)) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", b.type.name());
            m.put("label", b.type.label);
            m.put("horses", b.horses);
            m.put("stake", b.stake);
            m.put("odds", b.odds);
            if (b.paid != null) m.put("paid", b.paid);
            mine.add(m);
            staked += b.stake;
            if (b.paid != null) won += b.paid;
        }
        v.put("myBets", mine);
        v.put("myStaked", staked);
        v.put("myWon", won);
        return v;
    }

    // Per i test.
    String phase() {
        return phase;
    }

    int[] order() {
        return order.clone();
    }

    List<Horse> horsesForTest() {
        return horses;
    }
}
