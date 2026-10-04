package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.casino.CasinoGames.Card;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Valutazione delle mani del Texas Hold'em: la migliore combinazione di cinque carte fra le sette
 * (due in mano e cinque sul tavolo). Il punteggio e' un numero confrontabile: piu' alto vince,
 * uguale e' pareggio (il piatto si divide).
 */
public final class PokerEval {

    private PokerEval() {
    }

    /** Categorie dalla piu' bassa alla piu' alta. */
    public static final String[] CATEGORIES = {"Carta alta", "Coppia", "Doppia coppia", "Tris", "Scala", "Colore", "Full", "Poker",
            "Scala colore", "Scala reale"};

    /** Mano valutata: punteggio confrontabile, categoria (0-9) e le cinque carte che la formano. */
    public record Hand(long score, int category, List<Card> cards, String name) {
    }

    private static final String[] RANK_NAMES = {"", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"};
    private static final String[] RANK_PLURAL = {"", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Donne", "Re", "Assi"};

    /** Punteggio di cinque carte. */
    static long score5(List<Card> five, int[] categoryOut, List<Integer> ranksOut) {
        int[] counts = new int[15];
        for (Card c : five) counts[c.rank()]++;
        boolean flush = five.stream().map(Card::suit).distinct().count() == 1;
        List<Integer> distinct = new ArrayList<>();
        for (int r = 14; r >= 2; r--) if (counts[r] > 0) distinct.add(r);
        int straightHigh = 0;
        if (distinct.size() == 5) {
            if (distinct.get(0) - distinct.get(4) == 4) straightHigh = distinct.get(0);
            else if (distinct.equals(List.of(14, 5, 4, 3, 2))) straightHigh = 5;
        }
        // Ranghi ordinati per numero di carte uguali, poi per valore: [tris, coppia] nel full, ecc.
        List<Integer> ordered = new ArrayList<>(distinct);
        ordered.sort((a, b) -> counts[b] != counts[a] ? counts[b] - counts[a] : b - a);
        int category;
        List<Integer> kickers;
        if (straightHigh > 0 && flush) {
            category = straightHigh == 14 ? 9 : 8;
            kickers = List.of(straightHigh);
        } else if (counts[ordered.get(0)] == 4) {
            category = 7;
            kickers = ordered;
        } else if (counts[ordered.get(0)] == 3 && ordered.size() > 1 && counts[ordered.get(1)] == 2) {
            category = 6;
            kickers = ordered;
        } else if (flush) {
            category = 5;
            kickers = distinct;
        } else if (straightHigh > 0) {
            category = 4;
            kickers = List.of(straightHigh);
        } else if (counts[ordered.get(0)] == 3) {
            category = 3;
            kickers = ordered;
        } else if (counts[ordered.get(0)] == 2 && counts[ordered.get(1)] == 2) {
            category = 2;
            kickers = ordered;
        } else if (counts[ordered.get(0)] == 2) {
            category = 1;
            kickers = ordered;
        } else {
            category = 0;
            kickers = distinct;
        }
        long score = category;
        for (int i = 0; i < 5; i++) score = score * 15 + (i < kickers.size() ? kickers.get(i) : 0);
        if (categoryOut != null) categoryOut[0] = category;
        if (ranksOut != null) ranksOut.addAll(kickers);
        return score;
    }

    /** La migliore mano di cinque carte fra quelle date (da cinque a sette): si provano tutte le cinquine. */
    public static Hand best(List<Card> cards) {
        int n = cards.size();
        if (n < 5) throw new IllegalArgumentException("servono almeno cinque carte");
        long bestScore = -1;
        List<Card> bestFive = null;
        int bestCategory = 0;
        List<Integer> bestRanks = null;
        for (int mask = 0; mask < (1 << n); mask++) {
            if (Integer.bitCount(mask) != 5) continue;
            List<Card> five = new ArrayList<>(5);
            for (int i = 0; i < n; i++) if ((mask & (1 << i)) != 0) five.add(cards.get(i));
            int[] cat = new int[1];
            List<Integer> ranks = new ArrayList<>();
            long s = score5(five, cat, ranks);
            if (s > bestScore) {
                bestScore = s;
                bestFive = five;
                bestCategory = cat[0];
                bestRanks = ranks;
            }
        }
        bestFive.sort(Collections.reverseOrder((x, y) -> Integer.compare(x.rank(), y.rank())));
        return new Hand(bestScore, bestCategory, bestFive, describe(bestCategory, bestRanks));
    }

    /** Nome della mano in italiano: "Coppia di Assi", "Full di Re e 7", "Scala al 9". */
    static String describe(int category, List<Integer> r) {
        return switch (category) {
            case 0 -> "Carta alta: " + RANK_NAMES[r.get(0)];
            case 1 -> "Coppia di " + RANK_PLURAL[r.get(0)];
            case 2 -> "Doppia coppia, " + RANK_PLURAL[r.get(0)] + " e " + RANK_PLURAL[r.get(1)];
            case 3 -> "Tris di " + RANK_PLURAL[r.get(0)];
            case 4 -> "Scala al " + RANK_NAMES[r.get(0)];
            case 5 -> "Colore all'" + (r.get(0) == 14 ? "Asso" : RANK_NAMES[r.get(0)]);
            case 6 -> "Full di " + RANK_PLURAL[r.get(0)] + " e " + RANK_PLURAL[r.get(1)];
            case 7 -> "Poker di " + RANK_PLURAL[r.get(0)];
            case 8 -> "Scala colore al " + RANK_NAMES[r.get(0)];
            default -> "Scala reale!";
        };
    }

    /**
     * Forza grezza di due carte prima del flop, da 0 a 1 (per gli NPC): coppie alte in cima, poi
     * assi e figure, carte dello stesso seme e vicine.
     */
    public static double preflopStrength(Card a, Card b) {
        int hi = Math.max(a.rank(), b.rank());
        int lo = Math.min(a.rank(), b.rank());
        double score;
        if (hi == lo) {
            score = 0.5 + (hi - 2) / 24.0;
        } else {
            score = (hi + lo - 4) / 40.0;
            if (hi >= 13) score += 0.08;
            if (a.suit() == b.suit()) score += 0.06;
            int gap = hi - lo;
            if (gap == 1) score += 0.05;
            else if (gap == 2) score += 0.02;
            else if (gap > 4) score -= 0.05;
        }
        return Math.max(0, Math.min(1, score));
    }

    /** Forza dopo il flop (per gli NPC): dalla categoria della mano, con un po' di peso al valore. */
    public static double madeStrength(Hand hand, List<Card> board) {
        double base = switch (hand.category()) {
            case 0 -> 0.12;
            case 1 -> 0.38;
            case 2 -> 0.62;
            case 3 -> 0.74;
            case 4 -> 0.84;
            case 5 -> 0.88;
            case 6 -> 0.94;
            default -> 0.99;
        };
        // La mano e' davvero nostra solo se non sta tutta sul tavolo.
        if (!board.isEmpty() && board.size() >= 5) {
            Hand boardOnly = best(board);
            if (boardOnly.score() == hand.score()) base = Math.min(base, 0.2);
        }
        int top = hand.cards().getFirst().rank();
        return Math.min(1, base + (top - 8) / 60.0);
    }
}
