package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.casino.CasinoGames.Card;
import com.capstone.vinyldex.casino.CasinoGames.PokerHand;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CasinoGamesTest {

    private static List<Card> cards(String... codes) {
        List<Card> list = new ArrayList<>();
        for (String code : codes) {
            String r = code.substring(0, code.length() - 1);
            int rank = switch (r) {
                case "J" -> 11;
                case "Q" -> 12;
                case "K" -> 13;
                case "A" -> 14;
                default -> Integer.parseInt(r);
            };
            list.add(new Card(rank, code.charAt(code.length() - 1)));
        }
        return list;
    }

    @Test
    @DisplayName("La slot restituisce al giocatore fra l'85% e il 100% delle puntate, come una slot vera")
    void slotReturnToPlayer() {
        Random random = new Random(7);
        long paid = 0;
        int spins = 300_000;
        for (int i = 0; i < spins; i++) paid += CasinoGames.spinSlot(random).multiplier();
        double rtp = (double) paid / spins;
        assertTrue(rtp > 0.85 && rtp < 1.0, "RTP " + rtp);
    }

    @Test
    @DisplayName("Roulette europea: pieno 35 a 1, colori e dozzine, lo zero fa perdere le puntate semplici")
    void roulettePayouts() {
        assertEquals(360, CasinoGames.rouletteReturn("n:17", 10, 17));
        assertEquals(0, CasinoGames.rouletteReturn("n:17", 10, 18));
        assertEquals(20, CasinoGames.rouletteReturn("red", 10, 1));
        assertEquals(0, CasinoGames.rouletteReturn("red", 10, 0));
        assertEquals(0, CasinoGames.rouletteReturn("black", 10, 0));
        assertEquals(30, CasinoGames.rouletteReturn("dozen:2", 10, 13));
        assertEquals(30, CasinoGames.rouletteReturn("column:1", 10, 34));
        assertEquals(-1, CasinoGames.rouletteReturn("n:37", 10, 1));
        assertEquals(-1, CasinoGames.rouletteReturn("purple", 10, 1));
    }

    @Test
    @DisplayName("Blackjack: assi da 1 o 11, blackjack pagato 3 a 2, pareggio rende la puntata")
    void blackjack() {
        assertEquals(21, CasinoGames.blackjackValue(cards("AS", "KH")));
        assertEquals(13, CasinoGames.blackjackValue(cards("AS", "AH", "AD", "10C")));
        assertEquals(25, CasinoGames.blackjackReturn(cards("AS", "KH"), cards("10S", "9H"), 10));
        assertEquals(20, CasinoGames.blackjackReturn(cards("10S", "9H"), cards("10C", "8D"), 10));
        assertEquals(10, CasinoGames.blackjackReturn(cards("10S", "9H"), cards("10C", "9D"), 10));
        assertEquals(0, CasinoGames.blackjackReturn(cards("10S", "9H", "5C"), cards("10C", "8D"), 10));
    }

    @Test
    @DisplayName("Video poker: riconosce le mani di Jacks or Better")
    void poker() {
        assertEquals(PokerHand.ROYAL_FLUSH, CasinoGames.evaluatePoker(cards("10S", "JS", "QS", "KS", "AS")));
        assertEquals(PokerHand.STRAIGHT, CasinoGames.evaluatePoker(cards("AS", "2H", "3D", "4C", "5S")));
        assertEquals(PokerHand.FULL_HOUSE, CasinoGames.evaluatePoker(cards("9S", "9H", "9D", "4C", "4S")));
        assertEquals(PokerHand.TWO_PAIR, CasinoGames.evaluatePoker(cards("9S", "9H", "4D", "4C", "KS")));
        assertEquals(PokerHand.JACKS_OR_BETTER, CasinoGames.evaluatePoker(cards("JS", "JH", "4D", "7C", "2S")));
        assertEquals(PokerHand.NOTHING, CasinoGames.evaluatePoker(cards("10S", "10H", "4D", "7C", "2S")));
    }

    @Test
    @DisplayName("Baccarat: banco con il 5%, pareggio 8 a 1, e i colpi rispettano le regole della terza carta")
    void baccarat() {
        assertEquals(19, CasinoGames.baccaratReturn("banker", 10, "banker"));
        assertEquals(90, CasinoGames.baccaratReturn("tie", 10, "tie"));
        assertEquals(10, CasinoGames.baccaratReturn("player", 10, "tie"));
        Random random = new Random(3);
        for (int i = 0; i < 2_000; i++) {
            CasinoGames.BaccaratCoup coup = CasinoGames.playBaccarat(random);
            assertTrue(coup.player().size() >= 2 && coup.player().size() <= 3);
            assertTrue(coup.banker().size() >= 2 && coup.banker().size() <= 3);
        }
    }

    @Test
    @DisplayName("Dadi: la linea vince intorno al 49% delle volte")
    void craps() {
        Random random = new Random(11);
        int wins = 0;
        int rounds = 100_000;
        for (int i = 0; i < rounds; i++) if ("win".equals(CasinoGames.playCraps(true, random).outcome())) wins++;
        double rate = (double) wins / rounds;
        assertTrue(rate > 0.48 && rate < 0.50, "pass " + rate);
    }
}
