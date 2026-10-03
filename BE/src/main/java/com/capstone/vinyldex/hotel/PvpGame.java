package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Regole di una sfida fra due giocatori, senza rete e senza tempi: solo lo stato e le mosse.
 *
 * Stesse regole delle battaglie contro l'IA (BattlePage.jsx): squadra di 3 carte, 3 round, in
 * ogni round si sceglie una categoria (fans, style, influence, energy) e vince la carta con il
 * valore piu' alto. La categoria la sceglie lo sfidante nel primo round, il server estrae
 * quella del secondo, lo sfidato sceglie quella del terzo. Ogni giocatore ha un solo bonus
 * del +25% da usare quando vuole.
 *
 * Le carte si scelgono di nascosto: il server rivela entrambe solo quando le ha ricevute tutte e
 * due, cosi' nessuno puo' aspettare la mossa dell'altro per rispondere.
 *
 * Non e' thread-safe: PvpService la usa sempre dentro un blocco synchronized sulla partita.
 */
public class PvpGame {

    public static final List<String> CATEGORIES = List.of("fans", "style", "influence", "energy");
    public static final int ROUNDS = 3;
    public static final int TEAM_SIZE = 3;
    static final double BOOST = 1.25;

    public enum Phase { TEAM, CATEGORY, CARDS, ENDED }

    /** Carta in squadra, con le statistiche fissate all'inizio della partita. */
    public record CardInfo(String id, String name, String rarity, String img, String source, boolean fullImage,
                           Map<String, Integer> stats, String finish, int foil) {
        int stat(String category) {
            return stats.getOrDefault(category, 0);
        }
    }

    public static final class Player {
        final UUID userId;
        final String username;
        List<CardInfo> team;
        final Set<Integer> used = new HashSet<>();
        boolean boostUsed;
        Integer pick;
        boolean pickBoost;
        int score;

        Player(UUID userId, String username) {
            this.userId = userId;
            this.username = username;
        }

        public UUID userId() {
            return userId;
        }

        public String username() {
            return username;
        }

        public int score() {
            return score;
        }

        public List<CardInfo> team() {
            return team;
        }
    }

    /** Esito di un round, dal punto di vista del giocatore A. */
    public record RoundResult(int round, String category, CardInfo cardA, int valueA, boolean boostA,
                              CardInfo cardB, int valueB, boolean boostB, UUID winnerId) {
    }

    private final UUID id = UUID.randomUUID();
    private final Player a;
    private final Player b;
    private final Random random;
    private final List<Map<String, Object>> history = new ArrayList<>();
    private Phase phase = Phase.TEAM;
    private int round = 1;
    private String category;

    public PvpGame(UUID challengerId, String challengerName, UUID challengedId, String challengedName, Random random) {
        this.a = new Player(challengerId, challengerName);
        this.b = new Player(challengedId, challengedName);
        this.random = random;
    }

    public UUID id() {
        return id;
    }

    public Player a() {
        return a;
    }

    public Player b() {
        return b;
    }

    public Phase phase() {
        return phase;
    }

    public int round() {
        return round;
    }

    public String category() {
        return category;
    }

    public List<Map<String, Object>> history() {
        return history;
    }

    public Player player(UUID userId) {
        if (a.userId.equals(userId)) return a;
        if (b.userId.equals(userId)) return b;
        return null;
    }

    public Player opponent(UUID userId) {
        return a.userId.equals(userId) ? b : a;
    }

    /** Chi sceglie la categoria in questo round; null se la estrae il server. */
    public UUID chooser() {
        return switch (round) {
            case 1 -> a.userId;
            case 3 -> b.userId;
            default -> null;
        };
    }

    /** @return true quando entrambe le squadre sono pronte e la partita puo' cominciare */
    public boolean setTeam(UUID userId, List<CardInfo> team) {
        Player player = player(userId);
        if (player == null || phase != Phase.TEAM || team.size() != TEAM_SIZE) return false;
        player.team = List.copyOf(team);
        if (a.team != null && b.team != null) {
            startRound();
            return true;
        }
        return false;
    }

    private void startRound() {
        category = null;
        a.pick = null;
        b.pick = null;
        if (chooser() == null) {
            category = CATEGORIES.get(random.nextInt(CATEGORIES.size()));
            phase = Phase.CARDS;
        } else {
            phase = Phase.CATEGORY;
        }
    }

    public boolean chooseCategory(UUID userId, String chosen) {
        if (phase != Phase.CATEGORY || !userId.equals(chooser()) || !CATEGORIES.contains(chosen)) return false;
        category = chosen;
        phase = Phase.CARDS;
        return true;
    }

    /** Tempo scaduto sulla categoria: la estrae il server. */
    public void autoCategory() {
        if (phase != Phase.CATEGORY) return;
        category = CATEGORIES.get(random.nextInt(CATEGORIES.size()));
        phase = Phase.CARDS;
    }

    /**
     * Scelta della carta per il round. Il bonus si puo' usare una sola volta per partita.
     * @return true se la scelta e' valida ed e' stata registrata (vedi bothPicked per sapere
     * se il round si puo' risolvere)
     */
    public boolean pickCard(UUID userId, int index, boolean boost) {
        Player player = player(userId);
        if (player == null || phase != Phase.CARDS || player.pick != null) return false;
        if (index < 0 || index >= TEAM_SIZE || player.used.contains(index)) return false;
        if (boost && player.boostUsed) return false;
        player.pick = index;
        player.pickBoost = boost;
        return true;
    }

    /** Entrambi hanno scelto la carta: il round si puo' risolvere. */
    public boolean bothPicked() {
        return a.pick != null && b.pick != null;
    }

    public boolean hasPicked(UUID userId) {
        Player player = player(userId);
        return player != null && player.pick != null;
    }

    /** Tempo scaduto sulle carte: chi non ha scelto gioca una carta a caso, senza bonus. */
    public void autoPicks() {
        for (Player player : List.of(a, b)) {
            if (player.pick != null) continue;
            List<Integer> free = new ArrayList<>();
            for (int i = 0; i < TEAM_SIZE; i++) if (!player.used.contains(i)) free.add(i);
            player.pick = free.get(random.nextInt(free.size()));
            player.pickBoost = false;
        }
    }

    public RoundResult resolve() {
        if (phase != Phase.CARDS || a.pick == null || b.pick == null) throw new IllegalStateException("round non pronto");
        CardInfo cardA = a.team.get(a.pick);
        CardInfo cardB = b.team.get(b.pick);
        int valueA = value(cardA, a.pickBoost);
        int valueB = value(cardB, b.pickBoost);
        UUID winner = valueA > valueB ? a.userId : valueB > valueA ? b.userId : null;
        if (winner != null) player(winner).score++;

        a.used.add(a.pick);
        b.used.add(b.pick);
        if (a.pickBoost) a.boostUsed = true;
        if (b.pickBoost) b.boostUsed = true;

        RoundResult result = new RoundResult(round, category, cardA, valueA, a.pickBoost, cardB, valueB, b.pickBoost, winner);
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("round", round);
        entry.put("category", category);
        entry.put("cardA", cardA.id());
        entry.put("valueA", valueA);
        entry.put("cardB", cardB.id());
        entry.put("valueB", valueB);
        entry.put("winner", winner == null ? "draw" : winner.equals(a.userId) ? "a" : "b");
        history.add(entry);

        round++;
        if (round > ROUNDS) phase = Phase.ENDED;
        else startRound();
        return result;
    }

    private int value(CardInfo card, boolean boost) {
        int base = card.stat(category);
        return boost ? (int) Math.round(base * BOOST) : base;
    }

    /** Vincitore a partita finita; null per il pareggio. */
    public UUID winner() {
        if (a.score > b.score) return a.userId;
        if (b.score > a.score) return b.userId;
        return null;
    }

    public void end() {
        phase = Phase.ENDED;
    }
}
