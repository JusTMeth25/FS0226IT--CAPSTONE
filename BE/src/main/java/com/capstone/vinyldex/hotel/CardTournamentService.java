package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserWalletTransactionRepository;
import com.capstone.vinyldex.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Torneo di carte a eliminazione diretta, in Arena e nella pagina Battaglie.
 *
 * Sedici posti: ottavi, quarti, semifinali e finale. Si iscrivono i giocatori collegati; il primo
 * iscritto fa partire il conto alla rovescia delle iscrizioni e allo scadere (o a tabellone pieno)
 * i posti liberi li prendono gli NPC. Ogni partita e' una sfida PvP normale (squadra di 3 carte,
 * 3 round) giocata in tempo reale con PvpService: contro un giocatore vero o contro un NPC che fa
 * le sue mosse da solo. Le partite fra due NPC le simula il server. Pareggio: passa chi ha fatto
 * piu' punti nei tre round. Un turno comincia quando sono finite tutte le partite del precedente.
 *
 * Montepremi di 1000 gold, solo ai giocatori veri: 500 al vincitore, 250 al finalista, 125 a
 * ciascun semifinalista. Per non farne una fabbrica di gold contro gli NPC, i premi si prendono
 * al massimo in MAX_PRIZED_PER_DAY tornei al giorno.
 *
 * Tutto lo stato passa da synchronized(this); i messaggi vanno a chi guarda il tabellone
 * (tournament_watch) e agli iscritti.
 */
@Service
public class CardTournamentService {

    private static final Logger log = LoggerFactory.getLogger(CardTournamentService.class);

    static final int SIZE = 16;
    static final int ROUNDS = 4;
    static final List<String> ROUND_NAMES = List.of("Ottavi di finale", "Quarti di finale", "Semifinali", "Finale");
    static final int PRIZE_POOL = 1000;
    static final int[] PRIZES = {500, 250, 125};
    static final int MAX_PRIZED_PER_DAY = 3;
    static final long REGISTRATION_MILLIS = 90_000;
    static final long ROUND_PAUSE_MILLIS = 10_000;
    static final long RESULTS_MILLIS = 60_000;
    static final String RELATED_PREFIX = "cardcup:";

    private static final List<String> BOT_NAMES = List.of(
            "Vinile Nero", "DJ Scratch", "Lady Groove", "Mister Bassline", "Synthia", "Rocco Riff",
            "Nota Blu", "Kappa Beat", "Marta Mixer", "Sax Tony", "Luna Loop", "Grande Giradischi",
            "Eco Remix", "Bianca B-side", "Tempo Max", "Vera Vibe", "Il Maestro", "Polvere di Stelle");

    public enum Status { OPEN, RUNNING, FINISHED }

    static final class Entrant {
        final UUID id;
        final String name;
        final boolean npc;
        final String look;
        final int level;
        final List<PvpGame.CardInfo> botTeam;

        Entrant(UUID id, String name, boolean npc, String look, int level, List<PvpGame.CardInfo> botTeam) {
            this.id = id;
            this.name = name;
            this.npc = npc;
            this.look = look;
            this.level = level;
            this.botTeam = botTeam;
        }

        HotelUser asUser() {
            return new HotelUser(id, name, look, level);
        }
    }

    static final class Match {
        final int round;
        final int slot;
        Entrant a;
        Entrant b;
        Entrant winner;
        int scoreA;
        int scoreB;
        String status = "waiting"; // waiting, live, done
        boolean forfeit;
        boolean tiebreak;

        Match(int round, int slot) {
            this.round = round;
            this.slot = slot;
        }

        Entrant loser() {
            if (winner == null) return null;
            return winner == a ? b : a;
        }
    }

    private final RoomRegistry registry;
    private final PvpService pvp;
    private final NpcDeals npcDeals;
    private final UserCardRepository userCards;
    private final WalletService wallet;
    private final UserWalletTransactionRepository transactions;
    private final TransactionTemplate tx;
    private final Clock clock = Clock.systemDefaultZone();
    private final SecureRandom random = new SecureRandom();

    private final Set<UUID> watchers = ConcurrentHashMap.newKeySet();

    private UUID id;
    private int number;
    private Status status;
    private final List<Entrant> entrants = new ArrayList<>();
    private List<List<Match>> rounds;
    private int currentRound;
    private long startsAt;
    private long nextRoundAt;
    private ScheduledFuture<?> timer;
    private final Map<UUID, Integer> prizes = new LinkedHashMap<>();
    private final Set<UUID> eliminated = ConcurrentHashMap.newKeySet();
    private final Set<UUID> playing = ConcurrentHashMap.newKeySet();

    public CardTournamentService(RoomRegistry registry, PvpService pvp, NpcDeals npcDeals, UserCardRepository userCards,
                                 WalletService wallet, UserWalletTransactionRepository transactions,
                                 PlatformTransactionManager transactionManager) {
        this.registry = registry;
        this.pvp = pvp;
        this.npcDeals = npcDeals;
        this.userCards = userCards;
        this.wallet = wallet;
        this.transactions = transactions;
        this.tx = new TransactionTemplate(transactionManager);
        pvp.setTournamentFilter(playing::contains);
        reset();
    }

    // ------------------------------------------------------------------ comandi

    public void watch(HotelSession session) {
        watchers.add(session.user().id());
        session.send(state());
    }

    public void unwatch(UUID userId) {
        watchers.remove(userId);
    }

    /** @return codice d'errore oppure null */
    public synchronized String join(HotelSession session) {
        UUID userId = session.user().id();
        if (status != Status.OPEN) return "tournament_running";
        if (entrants.stream().anyMatch(e -> e.id.equals(userId))) return null;
        if (entrants.size() >= SIZE) return "tournament_full";
        if (pvp.isBusy(userId)) return "already_in_match";
        long cards = userCards.findByUserIdWithCard(userId).stream().filter(uc -> uc.getQuantity() > 0).count();
        if (cards < PvpGame.TEAM_SIZE) return "tournament_need_cards";

        HotelUser user = session.user();
        entrants.add(new Entrant(userId, user.username(), false, user.look(), user.level(), null));
        playing.add(userId);
        watchers.add(userId);
        if (entrants.size() == 1) {
            startsAt = System.currentTimeMillis() + REGISTRATION_MILLIS;
            schedule(this::start, REGISTRATION_MILLIS);
        }
        if (entrants.size() >= SIZE) {
            cancelTimer();
            registry.schedule(this::start, 0);
        }
        broadcast();
        return null;
    }

    /** Ritiro: prima che parta si libera il posto, dopo si perde la partita in corso o la prossima. */
    public synchronized String leave(UUID userId) {
        Entrant me = entrants.stream().filter(e -> e.id.equals(userId) && !e.npc).findFirst().orElse(null);
        if (me == null) return "not_in_tournament";
        if (status == Status.OPEN) {
            entrants.remove(me);
            playing.remove(userId);
            if (entrants.isEmpty()) {
                cancelTimer();
                startsAt = 0;
            }
            broadcast();
            return null;
        }
        if (status == Status.RUNNING && playing.contains(userId)) {
            eliminated.add(userId);
            playing.remove(userId);
            // La partita in corso la vince l'avversario (PvpService richiama onMatchEnd).
            if (pvp.isBusy(userId)) registry.schedule(() -> pvp.userLeft(userId), 0);
        }
        return null;
    }

    /**
     * Connessione chiusa: alle iscrizioni si perde il posto. A torneo in corso la partita in corso
     * la chiude PvpService (a tavolino); per la prossima conta se all'inizio del turno si e'
     * collegati, cosi' ricaricare la pagina fra un turno e l'altro non elimina.
     */
    public void disconnected(UUID userId) {
        watchers.remove(userId);
        synchronized (this) {
            if (status == Status.OPEN && entrants.stream().anyMatch(e -> e.id.equals(userId))) leave(userId);
        }
    }

    public boolean isPlaying(UUID userId) {
        return playing.contains(userId);
    }

    // ------------------------------------------------------------------ svolgimento

    private synchronized void reset() {
        cancelTimer();
        id = UUID.randomUUID();
        number++;
        status = Status.OPEN;
        entrants.clear();
        prizes.clear();
        eliminated.clear();
        playing.clear();
        currentRound = 0;
        startsAt = 0;
        nextRoundAt = 0;
        rounds = new ArrayList<>();
        for (int r = 0; r < ROUNDS; r++) {
            List<Match> matches = new ArrayList<>();
            for (int i = 0; i < SIZE >> (r + 1); i++) matches.add(new Match(r, i));
            rounds.add(matches);
        }
        broadcast();
    }

    private synchronized void start() {
        if (status != Status.OPEN || entrants.isEmpty()) return;
        cancelTimer();
        List<String> names = new ArrayList<>(BOT_NAMES);
        Collections.shuffle(names, random);
        int n = 0;
        while (entrants.size() < SIZE) {
            // Avversari di forza diversa: piu' della meta' sono sfidanti veri, gli altri piu' alla mano.
            NpcRoster.Role role = random.nextInt(10) < 6 ? NpcRoster.Role.FIGHTER : NpcRoster.Role.REFEREE;
            String name = names.get(n++ % names.size()) + " (NPC)";
            entrants.add(new Entrant(UUID.randomUUID(), name, true, HotelLook.orDefault(null), 5 + random.nextInt(25),
                    npcDeals.team(role, random)));
        }
        List<Entrant> seeded = new ArrayList<>(entrants);
        Collections.shuffle(seeded, random);
        List<Match> first = rounds.getFirst();
        for (int i = 0; i < first.size(); i++) {
            first.get(i).a = seeded.get(i * 2);
            first.get(i).b = seeded.get(i * 2 + 1);
        }
        status = Status.RUNNING;
        log.info("Torneo di carte #{} al via con {} giocatori", number, entrants.stream().filter(e -> !e.npc).count());
        playRound(0);
    }

    private void playRound(int r) {
        currentRound = r;
        nextRoundAt = 0;
        for (Match match : rounds.get(r)) playMatch(match);
        broadcast();
    }

    private void playMatch(Match match) {
        match.status = "live";
        Entrant a = match.a;
        Entrant b = match.b;
        boolean aOut = !a.npc && (eliminated.contains(a.id) || registry.sessionOf(a.id) == null);
        boolean bOut = !b.npc && (eliminated.contains(b.id) || registry.sessionOf(b.id) == null);
        if (aOut || bOut) {
            // Chi si e' ritirato o non e' collegato perde a tavolino.
            Entrant winner = aOut && bOut ? (random.nextBoolean() ? a : b) : aOut ? b : a;
            registry.schedule(() -> onMatchEnd(match, new PvpService.MatchEnd(winner.id, 0, 0, true, false)), 1_500);
            return;
        }
        if (a.npc && b.npc) {
            long delay = 12_000 + random.nextInt(14_000);
            registry.schedule(() -> onMatchEnd(match, simulate(a, b)), delay);
            return;
        }
        Map<UUID, List<PvpGame.CardInfo>> bots = new LinkedHashMap<>();
        if (a.npc) bots.put(a.id, a.botTeam);
        if (b.npc) bots.put(b.id, b.botTeam);
        boolean started = pvp.startTournamentMatch(a.asUser(), b.asUser(), bots, ROUND_NAMES.get(match.round),
                end -> onMatchEnd(match, end));
        if (!started) {
            // Uno dei due e' ancora in un'altra sfida: perde il turno.
            Entrant winner = pvp.isBusy(a.id) ? b : a;
            registry.schedule(() -> onMatchEnd(match, new PvpService.MatchEnd(winner.id, 0, 0, true, false)), 1_500);
        }
    }

    /** Partita fra due NPC: stesse regole, mosse a caso, nessuno la guarda giocare. */
    private PvpService.MatchEnd simulate(Entrant a, Entrant b) {
        PvpGame game = new PvpGame(a.id, a.name, b.id, b.name, random);
        game.setTeam(a.id, a.botTeam);
        game.setTeam(b.id, b.botTeam);
        while (game.phase() != PvpGame.Phase.ENDED) {
            if (game.phase() == PvpGame.Phase.CATEGORY) game.autoCategory();
            game.autoPicks();
            game.resolve();
        }
        UUID winner = game.winner();
        boolean tiebreak = winner == null;
        if (tiebreak) winner = PvpService.tiebreakWinner(game, random);
        return new PvpService.MatchEnd(winner, game.a().score(), game.b().score(), false, tiebreak);
    }

    private synchronized void onMatchEnd(Match match, PvpService.MatchEnd end) {
        if (status != Status.RUNNING || "done".equals(match.status)) return;
        match.winner = match.a.id.equals(end.winnerId()) ? match.a : match.b;
        match.scoreA = end.scoreA();
        match.scoreB = end.scoreB();
        match.forfeit = end.forfeit();
        match.tiebreak = end.tiebreak();
        match.status = "done";
        Entrant loser = match.loser();
        if (loser != null && !loser.npc) {
            playing.remove(loser.id);
            send(loser.id, Map.of("type", "tournament_out", "round", ROUND_NAMES.get(match.round)));
        }

        if (match.round + 1 < ROUNDS) {
            Match next = rounds.get(match.round + 1).get(match.slot / 2);
            if (match.slot % 2 == 0) next.a = match.winner;
            else next.b = match.winner;
        }

        boolean roundDone = rounds.get(match.round).stream().allMatch(m -> "done".equals(m.status));
        if (roundDone) {
            if (match.round + 1 >= ROUNDS) {
                finish();
            } else {
                int next = match.round + 1;
                nextRoundAt = System.currentTimeMillis() + ROUND_PAUSE_MILLIS;
                schedule(() -> {
                    synchronized (this) {
                        if (status == Status.RUNNING) playRound(next);
                    }
                }, ROUND_PAUSE_MILLIS);
            }
        }
        broadcast();
    }

    private void finish() {
        status = Status.FINISHED;
        Match fin = rounds.getLast().getFirst();
        List<Entrant> placed = new ArrayList<>();
        List<Integer> amounts = new ArrayList<>();
        placed.add(fin.winner);
        amounts.add(PRIZES[0]);
        placed.add(fin.loser());
        amounts.add(PRIZES[1]);
        for (Match semi : rounds.get(ROUNDS - 2)) {
            placed.add(semi.loser());
            amounts.add(PRIZES[2]);
        }
        for (int i = 0; i < placed.size(); i++) {
            Entrant e = placed.get(i);
            if (e == null || e.npc) continue;
            int place = i < 2 ? i + 1 : 3;
            int paid = pay(e.id, amounts.get(i), place);
            prizes.put(e.id, paid);
            send(e.id, Map.of("type", "tournament_prize", "place", place, "gold", paid, "capped", paid == 0));
        }
        playing.clear();
        log.info("Torneo di carte #{} vinto da {}", number, fin.winner.name);
        RoomInstance arena = registry.get(NpcRoster.ARENA);
        if (arena != null) {
            Map<String, Object> announce = new LinkedHashMap<>();
            announce.put("type", "tournament_champion");
            announce.put("winner", fin.winner.name);
            announce.put("runnerUp", fin.loser().name);
            arena.announce(announce);
        }
        schedule(this::reset, RESULTS_MILLIS);
    }

    /** Premio in gold, entro il limite dei tornei premiati al giorno. @return gold dati (0 = limite) */
    private int pay(UUID userId, int gold, int place) {
        try {
            Integer paid = tx.execute(status -> {
                Instant startOfDay = LocalDate.now(clock).atStartOfDay(clock.getZone()).toInstant();
                long already = transactions.countByUserIdAndTypeAndRelatedIdStartingWithAndCreatedAtAfter(
                        userId, WalletTransactionType.TOURNAMENT, RELATED_PREFIX, startOfDay);
                if (already >= MAX_PRIZED_PER_DAY) return 0;
                wallet.adjustGold(userId, gold, WalletTransactionType.TOURNAMENT, RELATED_PREFIX + id + ":" + place,
                        "Torneo di carte: " + (place == 1 ? "vittoria" : place == 2 ? "finale" : "semifinale"));
                return gold;
            });
            return paid == null ? 0 : paid;
        } catch (RuntimeException ex) {
            log.error("Premio del torneo {} a {} non pagato", id, userId, ex);
            return 0;
        }
    }

    // ------------------------------------------------------------------ messaggi

    private void schedule(Runnable task, long delay) {
        cancelTimer();
        timer = registry.schedule(task, delay);
    }

    private void cancelTimer() {
        if (timer != null) timer.cancel(false);
        timer = null;
    }

    private void send(UUID userId, Object message) {
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(message);
    }

    private void broadcast() {
        Map<String, Object> message = state();
        Set<UUID> to = new java.util.HashSet<>(watchers);
        entrants.stream().filter(e -> !e.npc).forEach(e -> to.add(e.id));
        for (UUID userId : to) send(userId, message);
    }

    synchronized Map<String, Object> state() {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "tournament_state");
        message.put("id", id);
        message.put("number", number);
        message.put("status", status.name().toLowerCase());
        message.put("size", SIZE);
        message.put("startsAt", startsAt);
        message.put("nextRoundAt", nextRoundAt);
        message.put("serverTime", System.currentTimeMillis());
        message.put("round", currentRound);
        message.put("roundNames", ROUND_NAMES);
        message.put("prizePool", PRIZE_POOL);
        message.put("prizes", List.of(PRIZES[0], PRIZES[1], PRIZES[2]));
        message.put("maxPrizedPerDay", MAX_PRIZED_PER_DAY);
        message.put("entrants", entrants.stream().map(this::entrantView).toList());
        List<List<Map<String, Object>>> bracket = new ArrayList<>();
        for (List<Match> round : rounds) {
            bracket.add(round.stream().map(this::matchView).toList());
        }
        message.put("rounds", bracket);
        message.put("paid", prizes.entrySet().stream().map(e -> Map.of("id", e.getKey(), "gold", e.getValue())).toList());
        return message;
    }

    private Map<String, Object> entrantView(Entrant e) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", e.id);
        view.put("name", e.name);
        view.put("npc", e.npc);
        view.put("level", e.level);
        view.put("online", e.npc || registry.sessionOf(e.id) != null);
        view.put("out", eliminated.contains(e.id));
        return view;
    }

    private Map<String, Object> matchView(Match m) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("slot", m.slot);
        view.put("a", m.a == null ? null : entrantView(m.a));
        view.put("b", m.b == null ? null : entrantView(m.b));
        view.put("status", m.status);
        view.put("winner", m.winner == null ? null : m.winner.id);
        view.put("scoreA", m.scoreA);
        view.put("scoreB", m.scoreB);
        view.put("forfeit", m.forfeit);
        view.put("tiebreak", m.tiebreak);
        return view;
    }
}
