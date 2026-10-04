package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.hotel.NpcRoster;
import com.capstone.vinyldex.hotel.RoomInstance;
import com.capstone.vinyldex.hotel.RoomItemView;
import com.capstone.vinyldex.hotel.RoomRegistry;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.random.RandomGenerator;

/**
 * I clienti NPC del casino giocano davvero: ogni tanto uno va a una slot, alla roulette, al
 * blackjack, al baccarat o ai dadi, punta e gioca con le stesse regole e le stesse probabilita' dei
 * giocatori (CasinoGames). Quello che perde entra nella cassa del banco, quello che vince esce:
 * come per i giocatori, in media il banco guadagna.
 *
 * Solo quando nel casino c'e' almeno un giocatore vero (altrimenti la stanza non e' caricata).
 */
@Service
public class CasinoPatrons {

    private static final Logger log = LoggerFactory.getLogger(CasinoPatrons.class);
    static final Set<String> TABLES = Set.of("slot_machine", "poker_machine", "roulette_table", "blackjack_table", "baccarat_table", "craps_table");
    private static final long PLAY_AFTER_MILLIS = 6_000;
    private static final long STAY_MILLIS = 25_000;

    private final RoomRegistry registry;
    private final CasinoBank bank;
    private final RandomGenerator random = new SecureRandom();
    private final Map<UUID, Long> busyUntil = new ConcurrentHashMap<>();
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "casino-patrons");
        t.setDaemon(true);
        return t;
    });

    public CasinoPatrons(RoomRegistry registry, CasinoBank bank) {
        this.registry = registry;
        this.bank = bank;
        clock.scheduleWithFixedDelay(this::round, 15, 9, TimeUnit.SECONDS);
    }

    /** Il risultato di una giocata di un NPC: quanto ha puntato, quanto torna e cosa dice. */
    record Play(String game, int stake, int returned, String line) {
    }

    private void round() {
        try {
            RoomInstance room = registry.get(CasinoService.CASINO_ROOM);
            if (room == null || room.activePlayers().isEmpty()) return;
            long now = System.currentTimeMillis();
            List<UUID> free = new ArrayList<>(room.idleNpcs(Set.of(NpcRoster.Role.GUEST)));
            free.removeIf(id -> busyUntil.getOrDefault(id, 0L) > now);
            List<RoomItemView> tables = room.itemsOfTypes(TABLES);
            if (free.isEmpty() || tables.isEmpty()) return;
            UUID npc = free.get(random.nextInt(free.size()));
            RoomItemView table = tables.get(random.nextInt(tables.size()));
            if (!room.npcGoTo(npc, table, STAY_MILLIS)) return;
            busyUntil.put(npc, now + STAY_MILLIS + 10_000);
            clock.schedule(() -> play(room, npc, table.type()), PLAY_AFTER_MILLIS, TimeUnit.MILLISECONDS);
        } catch (Exception ex) {
            log.debug("Casino: giro degli NPC non riuscito", ex);
        }
    }

    private void play(RoomInstance room, UUID npc, String table) {
        try {
            Play play = play(table, random);
            bank.record(CasinoService.Currency.CHIPS, play.stake() - play.returned());
            room.npcSay(npc, play.line(), null);
        } catch (Exception ex) {
            log.debug("Casino: giocata dell'NPC non riuscita", ex);
        }
    }

    /** Una giocata con le regole vere del casino. Statico e col generatore da fuori: si prova nei test. */
    static Play play(String table, RandomGenerator random) {
        int stake = (1 + random.nextInt(20)) * 10;
        return switch (table) {
            case "slot_machine", "poker_machine" -> {
                CasinoGames.SlotSpin spin = CasinoGames.spinSlot(random);
                int back = stake * spin.multiplier();
                yield new Play("slot", stake, back, back > stake ? spin.win() + "! Ho vinto " + (back - stake) + " fiches!"
                        : back == stake ? "Ciliegia: almeno mi riprendo la puntata." : pick(random, "Niente... la prossima e' quella buona.", "Questa slot mi odia.", "Un altro giro, dai."));
            }
            case "roulette_table" -> {
                int number = random.nextInt(37);
                String[] bets = {"red", "black", "even", "odd", "low", "high", "dozen:1", "dozen:2", "dozen:3", "n:" + random.nextInt(37)};
                String bet = bets[random.nextInt(bets.length)];
                int back = CasinoGames.rouletteReturn(bet, stake, number);
                yield new Play("roulette", stake, back, back > 0 ? "E' uscito il " + number + "! Vinco " + (back - stake) + " fiches!"
                        : "Il " + number + "... e io avevo puntato altrove.");
            }
            case "blackjack_table" -> {
                List<CasinoGames.Card> shoe = new ArrayList<>(CasinoGames.shoe(6, random));
                List<CasinoGames.Card> player = new ArrayList<>(List.of(shoe.removeFirst(), shoe.removeFirst()));
                List<CasinoGames.Card> dealer = new ArrayList<>(List.of(shoe.removeFirst(), shoe.removeFirst()));
                while (CasinoGames.blackjackValue(player) < 17) player.add(shoe.removeFirst());
                if (CasinoGames.blackjackValue(player) <= 21) CasinoGames.dealerPlays(dealer, shoe);
                int back = CasinoGames.blackjackReturn(player, dealer, stake);
                int points = CasinoGames.blackjackValue(player);
                yield new Play("blackjack", stake, back, points > 21 ? "Sballato a " + points + "!"
                        : back > stake ? "Blackjack o quasi: " + points + ", vinco!" : back == stake ? "Pareggio col banco." : "Il banco mi batte, " + points + " non basta.");
            }
            case "baccarat_table" -> {
                CasinoGames.BaccaratCoup coup = CasinoGames.playBaccarat(random);
                String bet = random.nextInt(10) < 9 ? (random.nextBoolean() ? "player" : "banker") : "tie";
                int back = CasinoGames.baccaratReturn(bet, stake, coup.winner());
                yield new Play("baccarat", stake, back, back > stake ? "Ho puntato sul " + label(bet) + " ed e' andata!" : "Peccato, vince il " + label(coup.winner()) + ".");
            }
            default -> {
                boolean pass = random.nextInt(10) < 7;
                CasinoGames.CrapsRound round = CasinoGames.playCraps(pass, random);
                int back = switch (round.outcome()) {
                    case "win" -> stake * 2;
                    case "push" -> stake;
                    default -> 0;
                };
                yield new Play("dadi", stake, back, back > stake ? "Dadi caldi stasera! Ho vinto!" : back == stake ? "Pari, si rilancia." : "Sette! Ho perso tutto.");
            }
        };
    }

    private static String label(String bet) {
        return switch (bet) {
            case "player" -> "giocatore";
            case "banker" -> "banco";
            default -> "pareggio";
        };
    }

    private static String pick(RandomGenerator random, String... lines) {
        return lines[random.nextInt(lines.length)];
    }

    @PreDestroy
    void shutdown() {
        clock.shutdownNow();
    }
}
