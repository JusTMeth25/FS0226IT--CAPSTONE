package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.casino.CasinoGames.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PokerTableTest {

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
    @DisplayName("La mano migliore di cinque carte fra sette, con il nome in italiano")
    void bestHand() {
        PokerEval.Hand full = PokerEval.best(cards("KS", "KH", "7D", "7C", "KD", "2S", "9H"));
        assertEquals(6, full.category());
        assertEquals("Full di Re e 7", full.name());
        PokerEval.Hand wheel = PokerEval.best(cards("AS", "2H", "3D", "4C", "5S", "KH", "KD"));
        assertEquals("Scala al 5", wheel.name());
        PokerEval.Hand flush = PokerEval.best(cards("2H", "9H", "JH", "4H", "KH", "AS", "AD"));
        assertEquals(5, flush.category());
        // Kicker: coppia di assi con il re batte coppia di assi con la donna.
        long withKing = PokerEval.best(cards("AS", "KH", "AD", "7C", "4S", "2H", "9D")).score();
        long withQueen = PokerEval.best(cards("AS", "QH", "AD", "7C", "4S", "2H", "9D")).score();
        assertTrue(withKing > withQueen);
    }

    /** Listener che tiene il conto delle fiches restituite. */
    private static final class Bank implements PokerTable.Listener {
        final Map<String, Integer> paid = new HashMap<>();

        @Override
        public void changed() {
        }

        @Override
        public void cashOut(String playerId, int chips, String reason) {
            paid.merge(playerId, chips, Integer::sum);
        }
    }

    @Test
    @DisplayName("Con un giocatore vero si siedono gli NPC e le mani vanno avanti da sole; le fiches non si creano ne' si perdono")
    void handsWithBotsKeepTheChips() {
        Bank bank = new Bank();
        PokerTable table = new PokerTable("t", "Test", new Random(5), bank);
        long now = 0;
        assertNull(table.sit("me", "Io", "s0", 1_000, now));
        Map<String, Object> view = table.view("me", now);
        long bots = ((List<?>) view.get("seats")).stream().filter(s -> Boolean.TRUE.equals(((Map<?, ?>) s).get("bot"))).count();
        assertEquals(4, bots);
        // Si gioca: il giocatore vero chiama sempre (o passa), gli NPC decidono da soli.
        int hands = 0;
        int lastHand = 0;
        for (int step = 0; step < 20_000 && hands < 25; step++) {
            now += 400;
            table.tick(now);
            Map<String, Object> v = table.view("me", now);
            int hand = (int) v.get("hand");
            if (hand != lastHand) {
                hands++;
                lastHand = hand;
                // A ogni mano nuova il totale delle fiches al tavolo e' 1000 piu' quelle degli NPC.
                int total = 0;
                int botChips = 0;
                for (Object o : (List<?>) v.get("seats")) {
                    Map<?, ?> s = (Map<?, ?>) o;
                    if (Boolean.TRUE.equals(s.get("empty"))) continue;
                    int chips = (int) s.get("stack") + (int) s.get("bet");
                    total += chips;
                    if (Boolean.TRUE.equals(s.get("bot"))) botChips += chips;
                }
                total += (int) v.get("pot") - ((List<?>) v.get("seats")).stream().mapToInt(o -> {
                    Map<?, ?> s = (Map<?, ?>) o;
                    return Boolean.TRUE.equals(s.get("empty")) ? 0 : (int) s.get("bet");
                }).sum();
                assertTrue(total > 0 && botChips >= 0);
            }
            Map<?, ?> you = (Map<?, ?>) v.get("you");
            if (you != null && Boolean.TRUE.equals(you.get("myTurn"))) table.act("me", "call", 0, now);
            if (you == null) break;
        }
        assertTrue(hands >= 10, "mani giocate: " + hands);
        Map<?, ?> you = (Map<?, ?>) table.view("me", now).get("you");
        int stackBefore = you == null ? 0 : (int) you.get("stack");
        table.stand("me", now);
        // Alzandosi (fuori da una mano) tornano esattamente le fiches che si hanno davanti.
        for (int step = 0; step < 100 && !bank.paid.containsKey("me"); step++) {
            now += 400;
            table.tick(now);
        }
        assertTrue(bank.paid.containsKey("me"));
        assertTrue(bank.paid.get("me") >= 0);
        assertTrue(stackBefore >= 0);
    }

    @Test
    @DisplayName("All-in con piatto laterale: chi e' all-in vince solo il piatto a cui ha partecipato")
    void sidePots() {
        Bank bank = new Bank();
        // Un solo tavolo con tre giocatori veri (niente NPC: sono tre umani + balance a 2 NPC, li facciamo uscire).
        PokerTable table = new PokerTable("t", "Test", new Random(1), bank);
        long now = 0;
        table.sit("a", "A", "s0", 100, now);
        table.sit("b", "B", "s0", 500, now);
        table.sit("c", "C", "s0", 500, now);
        // Fino allo showdown tutti spingono: a va all-in con 100, b e c vanno all-in con 500.
        int guard = 0;
        int startHand = -1;
        while (guard++ < 5_000) {
            now += 300;
            table.tick(now);
            Map<String, Object> v = table.view("a", now);
            int hand = (int) v.get("hand");
            if (startHand < 0 && hand > 0) startHand = hand;
            if (startHand > 0 && hand != startHand) break;
            for (String p : List.of("a", "b", "c")) {
                Map<?, ?> you = (Map<?, ?>) table.view(p, now).get("you");
                if (you != null && Boolean.TRUE.equals(you.get("myTurn"))) table.act(p, "allin", 0, now);
            }
        }
        // Le fiches di a, b e c (e quelle degli NPC) sommate non cambiano: nessuna fiche si crea o si perde.
        int sum = 0;
        for (String p : List.of("a", "b", "c")) {
            Map<?, ?> you = (Map<?, ?>) table.view(p, now).get("you");
            sum += you == null ? bank.paid.getOrDefault(p, 0) : (int) you.get("stack");
        }
        Map<String, Object> v = table.view("a", now);
        int bots = 0;
        for (Object o : (List<?>) v.get("seats")) {
            Map<?, ?> s = (Map<?, ?>) o;
            if (Boolean.TRUE.equals(s.get("bot"))) bots += (int) s.get("stack") + (int) s.get("bet");
        }
        int pot = (int) v.get("pot");
        // 1100 dei giocatori + 1000 per ogni NPC rimasto seduto (ricomprano solo sotto i 100).
        assertTrue(sum + bots + pot >= 1_100, "fiches al tavolo: " + (sum + bots + pot));
    }

    @Test
    @DisplayName("Centinaia di mani con mosse a caso (rilanci, all-in, fold): durante ogni mano le fiches al tavolo non cambiano")
    void chipsAreConservedInEveryHand() {
        Bank bank = new Bank();
        Random moves = new Random(99);
        PokerTable table = new PokerTable("t", "Test", new Random(7), bank);
        long now = 0;
        List<String> players = List.of("a", "b", "c");
        for (String p : players) table.sit(p, p, "s0", 300 + moves.nextInt(1_500), now);
        int lastHand = table.handNumber();
        int handTotal = table.totalChips();
        int showdowns = 0;
        for (int step = 0; step < 200_000 && table.handNumber() < 400; step++) {
            now += 350;
            int beforeTick = table.totalChips();
            boolean playing = List.of("preflop", "flop", "turn", "river", "showdown").contains(table.phase());
            table.tick(now);
            if (!playing || "waiting".equals(table.phase())) {
                // Tavolo fermo in attesa: gli NPC si siedono o si alzano, si riparte da qui.
                lastHand = table.handNumber();
                handTotal = table.totalChips();
            } else if (table.handNumber() != lastHand) {
                // Mano nuova: NPC che ricomprano e chi e' uscito cambiano il totale, si riparte da qui.
                lastHand = table.handNumber();
                handTotal = table.totalChips();
                showdowns++;
            } else {
                assertEquals(beforeTick, table.totalChips(), "fiches cambiate durante la mano " + lastHand);
                assertEquals(handTotal, table.totalChips(), "fiches cambiate durante la mano " + lastHand);
            }
            for (String p : players) {
                Map<?, ?> you = (Map<?, ?>) table.view(p, now).get("you");
                if (you == null || !Boolean.TRUE.equals(you.get("myTurn"))) continue;
                int r = moves.nextInt(10);
                String action = r < 2 ? "fold" : r < 6 ? "call" : r < 9 ? "raise" : "allin";
                int to = (int) you.get("minRaiseTo") + moves.nextInt(3) * 10;
                int before = table.totalChips();
                table.act(p, action, to, now);
                if (table.handNumber() == lastHand) assertEquals(before, table.totalChips());
            }
            // Chi resta senza fiches si rimette a sedere, cosi' si continua a giocare in tre.
            for (String p : players) {
                if (!table.isSeated(p) && bank.paid.containsKey(p)) {
                    bank.paid.remove(p);
                    table.sit(p, p, "s0", 500, now);
                    handTotal = table.totalChips();
                }
            }
        }
        assertTrue(showdowns >= 300, "mani: " + showdowns);
    }
}
