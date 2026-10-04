package com.capstone.vinyldex.casino;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

/**
 * Regole e pagamenti dei giochi del casino, senza soldi ne' database: le estrae il server e le
 * provano i test. I pagamenti sono quelli classici dei casino veri (roulette europea a uno zero,
 * blackjack 3:2, video poker Jacks or Better 9/6, baccarat con il 5% sul banco).
 *
 * Ogni metodo restituisce quanto torna al giocatore: la puntata piu' la vincita (0 se perde).
 */
public final class CasinoGames {

    private CasinoGames() {
    }

    // ------------------------------------------------------------------ carte

    /** Carta: valore da 2 a 14 (11 J, 12 Q, 13 K, 14 A) e seme (S picche, H cuori, D quadri, C fiori). */
    public record Card(int rank, char suit) {

        /** Come la legge il client: "AS", "10H", "QD". */
        public String code() {
            String r = switch (rank) {
                case 11 -> "J";
                case 12 -> "Q";
                case 13 -> "K";
                case 14 -> "A";
                default -> String.valueOf(rank);
            };
            return r + suit;
        }
    }

    /** Uno o piu' mazzi da 52 carte mescolati. */
    public static List<Card> shoe(int decks, RandomGenerator random) {
        List<Card> cards = new ArrayList<>();
        for (int d = 0; d < decks; d++) {
            for (char suit : new char[]{'S', 'H', 'D', 'C'}) {
                for (int rank = 2; rank <= 14; rank++) cards.add(new Card(rank, suit));
            }
        }
        Collections.shuffle(cards, new java.util.Random(random.nextLong()));
        return cards;
    }

    public static List<String> codes(List<Card> cards) {
        return cards.stream().map(Card::code).toList();
    }

    // ------------------------------------------------------------------ slot

    /** Simboli dei rulli, dal piu' comune al piu' raro, con il peso sul rullo e la paga per tre uguali. */
    public enum Symbol {
        CHERRY(18, 15), LEMON(16, 12), ORANGE(14, 18), PLUM(12, 25), BELL(9, 40), BAR(6, 80), SEVEN(3, 150), VINYL(2, 500);

        final int weight;
        final int triple;

        Symbol(int weight, int triple) {
            this.weight = weight;
            this.triple = triple;
        }
    }

    private static final int SYMBOL_WEIGHTS = java.util.Arrays.stream(Symbol.values()).mapToInt(s -> s.weight).sum();

    static Symbol drawSymbol(RandomGenerator random) {
        int roll = random.nextInt(SYMBOL_WEIGHTS);
        for (Symbol symbol : Symbol.values()) {
            roll -= symbol.weight;
            if (roll < 0) return symbol;
        }
        return Symbol.CHERRY;
    }

    /** Giro di slot: tre rulli da tre simboli, si vince sulla riga centrale. */
    public record SlotSpin(List<List<String>> reels, List<String> line, int multiplier, String win) {
    }

    public static SlotSpin spinSlot(RandomGenerator random) {
        List<List<String>> reels = new ArrayList<>();
        List<Symbol> line = new ArrayList<>();
        for (int r = 0; r < 3; r++) {
            List<String> reel = new ArrayList<>();
            for (int row = 0; row < 3; row++) {
                Symbol s = drawSymbol(random);
                reel.add(s.name());
                if (row == 1) line.add(s);
            }
            reels.add(reel);
        }
        int multiplier = 0;
        String win = null;
        if (line.get(0) == line.get(1) && line.get(1) == line.get(2)) {
            multiplier = line.get(0).triple;
            win = "Tris di " + line.get(0).name();
        } else {
            long cherries = line.stream().filter(s -> s == Symbol.CHERRY).count();
            long bars = line.stream().filter(s -> s == Symbol.BAR || s == Symbol.SEVEN).count();
            if (cherries == 2) {
                multiplier = 2;
                win = "Due ciliegie";
            } else if (bars == 3) {
                multiplier = 20;
                win = "Bar e sette misti";
            } else if (line.get(0) == Symbol.CHERRY) {
                multiplier = 1;
                win = "Ciliegia sul primo rullo";
            }
        }
        return new SlotSpin(reels, line.stream().map(Symbol::name).toList(), multiplier, win);
    }

    // ------------------------------------------------------------------ roulette europea

    private static final java.util.Set<Integer> RED = java.util.Set.of(1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36);

    public static boolean isRed(int n) {
        return RED.contains(n);
    }

    /**
     * Quanto torna di una puntata sul numero uscito: "n:17" pieno (35 a 1), "red"/"black",
     * "even"/"odd", "low"/"high" (1 a 1), "dozen:1..3", "column:1..3" (2 a 1). 0 se perde, -1 se
     * la puntata non esiste.
     */
    public static int rouletteReturn(String bet, int stake, int number) {
        if (bet == null) return -1;
        if (bet.startsWith("n:")) {
            int n = parse(bet.substring(2), -1);
            if (n < 0 || n > 36) return -1;
            return n == number ? stake * 36 : 0;
        }
        if (bet.startsWith("dozen:") || bet.startsWith("column:")) {
            int k = parse(bet.substring(bet.indexOf(':') + 1), 0);
            if (k < 1 || k > 3) return -1;
            if (number == 0) return 0;
            boolean hit = bet.startsWith("dozen:") ? (number - 1) / 12 + 1 == k : (number - 1) % 3 + 1 == k;
            return hit ? stake * 3 : 0;
        }
        Boolean hit = switch (bet) {
            case "red" -> isRed(number);
            case "black" -> number != 0 && !isRed(number);
            case "even" -> number != 0 && number % 2 == 0;
            case "odd" -> number % 2 == 1;
            case "low" -> number >= 1 && number <= 18;
            case "high" -> number >= 19;
            default -> null;
        };
        if (hit == null) return -1;
        return hit ? stake * 2 : 0;
    }

    private static int parse(String s, int fallback) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    // ------------------------------------------------------------------ blackjack

    /** Punteggio di una mano di blackjack (gli assi valgono 11 finche' non si sballa). */
    public static int blackjackValue(List<Card> hand) {
        int total = 0;
        int aces = 0;
        for (Card c : hand) {
            if (c.rank() == 14) {
                aces++;
                total += 11;
            } else {
                total += Math.min(10, c.rank());
            }
        }
        while (total > 21 && aces-- > 0) total -= 10;
        return total;
    }

    public static boolean isBlackjack(List<Card> hand) {
        return hand.size() == 2 && blackjackValue(hand) == 21;
    }

    /** Il banco pesca fino a 17 e si ferma su ogni 17. */
    public static void dealerPlays(List<Card> dealer, List<Card> shoe) {
        while (blackjackValue(dealer) < 17) dealer.add(shoe.removeFirst());
    }

    /** Quanto torna a fine mano: blackjack 3:2, vittoria 1:1, pareggio la puntata. */
    public static int blackjackReturn(List<Card> player, List<Card> dealer, int stake) {
        int p = blackjackValue(player);
        int d = blackjackValue(dealer);
        if (p > 21) return 0;
        boolean playerBj = isBlackjack(player);
        boolean dealerBj = isBlackjack(dealer);
        if (playerBj && !dealerBj) return stake + stake * 3 / 2;
        if (dealerBj && !playerBj) return 0;
        if (d > 21 || p > d) return stake * 2;
        if (p == d) return stake;
        return 0;
    }

    // ------------------------------------------------------------------ video poker

    /** Mani del video poker Jacks or Better, con la paga 9/6 per una moneta. */
    public enum PokerHand {
        ROYAL_FLUSH("Scala reale", 250), STRAIGHT_FLUSH("Scala colore", 50), FOUR_OF_A_KIND("Poker", 25),
        FULL_HOUSE("Full", 9), FLUSH("Colore", 6), STRAIGHT("Scala", 4), THREE_OF_A_KIND("Tris", 3),
        TWO_PAIR("Doppia coppia", 2), JACKS_OR_BETTER("Coppia di J o piu'", 1), NOTHING("Niente", 0);

        public final String label;
        public final int pays;

        PokerHand(String label, int pays) {
            this.label = label;
            this.pays = pays;
        }
    }

    public static PokerHand evaluatePoker(List<Card> hand) {
        Map<Integer, Integer> counts = new java.util.TreeMap<>();
        for (Card c : hand) counts.merge(c.rank(), 1, Integer::sum);
        boolean flush = hand.stream().map(Card::suit).distinct().count() == 1;
        List<Integer> ranks = hand.stream().map(Card::rank).sorted().toList();
        boolean straight = counts.size() == 5 && (ranks.get(4) - ranks.get(0) == 4
                || ranks.equals(List.of(2, 3, 4, 5, 14)));
        List<Integer> groups = counts.values().stream().sorted(Collections.reverseOrder()).toList();
        if (straight && flush) return ranks.get(0) == 10 ? PokerHand.ROYAL_FLUSH : PokerHand.STRAIGHT_FLUSH;
        if (groups.get(0) == 4) return PokerHand.FOUR_OF_A_KIND;
        if (groups.get(0) == 3 && groups.get(1) == 2) return PokerHand.FULL_HOUSE;
        if (flush) return PokerHand.FLUSH;
        if (straight) return PokerHand.STRAIGHT;
        if (groups.get(0) == 3) return PokerHand.THREE_OF_A_KIND;
        if (groups.get(0) == 2 && groups.get(1) == 2) return PokerHand.TWO_PAIR;
        boolean highPair = counts.entrySet().stream().anyMatch(e -> e.getValue() == 2 && e.getKey() >= 11);
        return highPair ? PokerHand.JACKS_OR_BETTER : PokerHand.NOTHING;
    }

    // ------------------------------------------------------------------ baccarat

    private static int baccaratPoints(List<Card> hand) {
        int total = 0;
        for (Card c : hand) total += c.rank() == 14 ? 1 : c.rank() >= 10 ? 0 : c.rank();
        return total % 10;
    }

    /** Colpo di baccarat con le regole classiche della terza carta. */
    public record BaccaratCoup(List<String> player, List<String> banker, int playerPoints, int bankerPoints, String winner) {
    }

    public static BaccaratCoup playBaccarat(RandomGenerator random) {
        List<Card> shoe = shoe(8, random);
        List<Card> player = new ArrayList<>(List.of(shoe.removeFirst(), shoe.removeFirst()));
        List<Card> banker = new ArrayList<>(List.of(shoe.removeFirst(), shoe.removeFirst()));
        int p = baccaratPoints(player);
        int b = baccaratPoints(banker);
        if (p < 8 && b < 8) {
            Card third = null;
            if (p <= 5) {
                third = shoe.removeFirst();
                player.add(third);
            }
            if (third == null) {
                if (b <= 5) banker.add(shoe.removeFirst());
            } else {
                int t = third.rank() == 14 ? 1 : third.rank() >= 10 ? 0 : third.rank();
                boolean draw = switch (b) {
                    case 0, 1, 2 -> true;
                    case 3 -> t != 8;
                    case 4 -> t >= 2 && t <= 7;
                    case 5 -> t >= 4 && t <= 7;
                    case 6 -> t == 6 || t == 7;
                    default -> false;
                };
                if (draw) banker.add(shoe.removeFirst());
            }
        }
        p = baccaratPoints(player);
        b = baccaratPoints(banker);
        String winner = p > b ? "player" : b > p ? "banker" : "tie";
        return new BaccaratCoup(codes(player), codes(banker), p, b, winner);
    }

    /** Punto 1:1, Banco 1:1 meno il 5%, Pareggio 8:1; con il pareggio Punto e Banco riprendono la puntata. */
    public static int baccaratReturn(String bet, int stake, String winner) {
        return switch (bet) {
            case "player" -> "player".equals(winner) ? stake * 2 : "tie".equals(winner) ? stake : 0;
            case "banker" -> "banker".equals(winner) ? stake + stake * 95 / 100 : "tie".equals(winner) ? stake : 0;
            case "tie" -> "tie".equals(winner) ? stake * 9 : 0;
            default -> -1;
        };
    }

    // ------------------------------------------------------------------ dadi (craps)

    /** Partita di craps sulla linea: tutti i lanci, dal primo (come out) a quando si decide. */
    public record CrapsRound(List<int[]> rolls, Integer point, String outcome) {
    }

    /**
     * Pass line: al primo lancio 7 o 11 vince, 2, 3 o 12 perde; altrimenti il numero diventa il
     * "punto" e si lancia finche' esce di nuovo (vince) o esce il 7 (perde). Don't pass e' il
     * contrario, ma il 12 al primo lancio e' un pareggio.
     */
    public static CrapsRound playCraps(boolean pass, RandomGenerator random) {
        List<int[]> rolls = new ArrayList<>();
        int[] first = {random.nextInt(1, 7), random.nextInt(1, 7)};
        rolls.add(first);
        int sum = first[0] + first[1];
        Integer point = null;
        boolean passWins;
        if (sum == 7 || sum == 11) {
            passWins = true;
        } else if (sum == 2 || sum == 3 || sum == 12) {
            if (!pass && sum == 12) return new CrapsRound(rolls, null, "push");
            passWins = false;
        } else {
            point = sum;
            while (true) {
                int[] roll = {random.nextInt(1, 7), random.nextInt(1, 7)};
                rolls.add(roll);
                int s = roll[0] + roll[1];
                if (s == point) {
                    passWins = true;
                    break;
                }
                if (s == 7) {
                    passWins = false;
                    break;
                }
            }
        }
        return new CrapsRound(rolls, point, passWins == pass ? "win" : "lose");
    }
}
