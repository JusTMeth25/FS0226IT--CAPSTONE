package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Sfide in tempo reale fra giocatori della stessa stanza.
 *
 * Qui stanno le parti "vive": chi ha sfidato chi, le partite in corso, i tempi limite, i
 * messaggi ai due giocatori. Le regole sono in PvpGame, ricompense e salvataggio in
 * PvpRewardService.
 *
 * Tempi: 20 secondi per accettare, 60 per scegliere la squadra, 20 per la categoria e 20 per
 * la carta. Allo scadere decide il server (categoria e carta a caso); chi non sceglie la
 * squadra, chi esce dalla stanza o chiude la connessione perde a tavolino.
 *
 * In Arena si gioca anche contro gli sfidanti NPC: accettano le sfide, ogni tanto sfidano
 * loro i giocatori e fanno le loro mosse da soli, con qualche secondo di "riflessione".
 */
@Service
public class PvpService {

    private static final Logger log = LoggerFactory.getLogger(PvpService.class);

    static final long CHALLENGE_MILLIS = 20_000;
    static final long TEAM_MILLIS = 60_000;
    static final long CATEGORY_MILLIS = 20_000;
    static final long CARD_MILLIS = 20_000;
    static final long REVEAL_PAUSE_MILLIS = 3_500;

    private record Challenge(UUID id, UUID from, UUID to, UUID roomId) {
    }

    /** Partita in corso con il suo timer: tutto l'accesso passa da synchronized(live). */
    private static final class LiveGame {
        final PvpGame game;
        final UUID roomId;
        ScheduledFuture<?> timer;
        boolean finished;

        LiveGame(PvpGame game, UUID roomId) {
            this.game = game;
            this.roomId = roomId;
        }
    }

    /** NPC che giocano: gli sfidanti dell'Arena. */
    static final Set<NpcRoster.Role> PLAYING_NPCS = Set.of(NpcRoster.Role.FIGHTER);
    /** Dopo una sfida di un NPC, lo stesso giocatore non viene risfidato per qualche minuto. */
    private static final long NPC_CHALLENGE_COOLDOWN_MILLIS = 4 * 60_000;

    private final RoomRegistry registry;
    private final UserCardRepository userCardRepository;
    private final PvpRewardService rewardService;
    private final NpcDeals npcDeals;
    private final SecureRandom random = new SecureRandom();

    private final Map<UUID, Challenge> challenges = new ConcurrentHashMap<>();
    private final Map<UUID, LiveGame> gamesByUser = new ConcurrentHashMap<>();
    private final Map<UUID, Long> npcChallengedAt = new ConcurrentHashMap<>();

    public PvpService(RoomRegistry registry, UserCardRepository userCardRepository, PvpRewardService rewardService,
                      NpcDeals npcDeals) {
        this.registry = registry;
        this.userCardRepository = userCardRepository;
        this.rewardService = rewardService;
        this.npcDeals = npcDeals;
    }

    // ------------------------------------------------------------------ sfida

    /** @return codice d'errore oppure null */
    public String challenge(HotelSession from, UUID toId) {
        UUID fromId = from.user().id();
        RoomInstance room = registry.get(from.roomId());
        if (toId == null || toId.equals(fromId)) return "cannot_challenge_yourself";
        if (room == null || !room.contains(toId)) return "user_not_here";
        if (isBusy(fromId)) return "already_in_match";
        if (room.isNpc(toId)) return challengeNpc(from, room, toId);
        if (isBusy(toId)) return "opponent_busy";

        HotelSession to = registry.sessionOf(toId);
        if (to == null) return "user_not_here";

        Challenge challenge = new Challenge(UUID.randomUUID(), fromId, toId, room.data().id());
        challenges.put(challenge.id(), challenge);
        to.send(Map.of("type", "challenge_received", "challengeId", challenge.id(),
                "from", Map.of("id", fromId, "username", from.user().username()), "expiresIn", CHALLENGE_MILLIS));
        from.send(Map.of("type", "challenge_sent", "challengeId", challenge.id(),
                "to", Map.of("id", toId, "username", to.user().username())));

        registry.schedule(() -> {
            if (challenges.remove(challenge.id()) != null) {
                send(fromId, Map.of("type", "challenge_expired", "challengeId", challenge.id()));
                send(toId, Map.of("type", "challenge_expired", "challengeId", challenge.id()));
            }
        }, CHALLENGE_MILLIS);
        return null;
    }

    public String reply(HotelSession session, UUID challengeId, boolean accept) {
        Challenge challenge = challengeId == null ? null : challenges.get(challengeId);
        UUID userId = session.user().id();
        if (challenge == null || !challenge.to().equals(userId)) return "challenge_expired";
        challenges.remove(challengeId);
        RoomInstance room = registry.get(challenge.roomId());
        boolean fromNpc = room != null && room.isNpc(challenge.from());

        if (!accept) {
            if (fromNpc) room.npcSay(challenge.from(), NpcDialog.tradeDeclined(session.user().username()), userId);
            else send(challenge.from(), Map.of("type", "challenge_declined", "challengeId", challengeId,
                    "by", session.user().username()));
            return null;
        }

        HotelUser challenger = fromNpc ? room.npcUser(challenge.from()) : userOf(challenge.from());
        if (challenger == null || room == null || !room.contains(challenge.from()) || !room.contains(userId)) {
            return "user_not_here";
        }
        if (isBusy(challenge.from()) || isBusy(userId)) return "opponent_busy";
        start(room, challenge.roomId(), challenger, session.user());
        return null;
    }

    private HotelUser userOf(UUID userId) {
        HotelSession session = registry.sessionOf(userId);
        return session == null ? null : session.user();
    }

    /** Avvia la partita fra lo sfidante (a) e lo sfidato (b); se uno dei due e' un NPC, gioca da solo. */
    private void start(RoomInstance room, UUID roomId, HotelUser a, HotelUser b) {
        PvpGame game = new PvpGame(a.id(), a.username(), b.id(), b.username(), random);
        LiveGame live = new LiveGame(game, roomId);
        gamesByUser.put(a.id(), live);
        gamesByUser.put(b.id(), live);

        synchronized (live) {
            long deadline = System.currentTimeMillis() + TEAM_MILLIS;
            send(a.id(), startMessage(game, a, b, "a", deadline));
            send(b.id(), startMessage(game, b, a, "b", deadline));
            live.timer = registry.schedule(() -> onTeamTimeout(live), TEAM_MILLIS);
        }
        for (HotelUser player : List.of(a, b)) {
            if (room.isNpc(player.id())) {
                room.npcBusy(player.id(), true);
                npcLater(live, 2_500 + random.nextInt(2_000), () -> npcTeam(live, room, player.id()));
            }
        }
    }

    // ------------------------------------------------------------------ NPC in Arena

    /** Un giocatore sfida un NPC: in Arena gli sfidanti accettano dopo un attimo, gli altri no. */
    private String challengeNpc(HotelSession from, RoomInstance room, UUID npcId) {
        NpcRoster.Role role = room.npcRole(npcId);
        if (!NpcRoster.ARENA.equals(room.data().id()) || !PLAYING_NPCS.contains(role)) {
            room.npcSay(npcId, NpcDialog.refuseChallenge(role), from.user().id());
            return "npc_no_challenge";
        }
        if (isBusy(npcId)) {
            room.npcSay(npcId, NpcDialog.refuseChallenge(role), from.user().id());
            return "opponent_busy";
        }
        HotelUser npc = room.npcUser(npcId);
        HotelUser user = from.user();
        from.send(Map.of("type", "challenge_sent", "challengeId", UUID.randomUUID(),
                "to", Map.of("id", npcId, "username", npc.username())));
        registry.schedule(() -> {
            if (isBusy(npcId) || isBusy(user.id()) || !room.contains(user.id())) return;
            room.npcSay(npcId, NpcDialog.acceptChallenge(user.username(), random), user.id());
            start(room, room.data().id(), user, npc);
        }, 1_500);
        return null;
    }

    /**
     * Ogni tanto uno sfidante dell'Arena sfida un giocatore presente, che non stia gia' giocando
     * e che non sia stato sfidato da poco. Il giocatore accetta o rifiuta come per le sfide vere.
     */
    @Scheduled(fixedDelay = 25_000, initialDelay = 30_000)
    public void npcChallenges() {
        RoomInstance room = registry.get(NpcRoster.ARENA);
        if (room == null) return;
        long now = System.currentTimeMillis();
        List<UUID> players = room.activePlayers().stream()
                .filter(id -> !isBusy(id) && now - npcChallengedAt.getOrDefault(id, 0L) > NPC_CHALLENGE_COOLDOWN_MILLIS)
                .filter(id -> challenges.values().stream().noneMatch(c -> c.to().equals(id) || c.from().equals(id)))
                .toList();
        List<UUID> fighters = room.npcsWithRole(PLAYING_NPCS).stream().filter(id -> !isBusy(id)).toList();
        if (players.isEmpty() || fighters.isEmpty() || random.nextInt(3) != 0) return;

        UUID npcId = fighters.get(random.nextInt(fighters.size()));
        UUID userId = players.get(random.nextInt(players.size()));
        HotelSession session = registry.sessionOf(userId);
        HotelUser npc = room.npcUser(npcId);
        if (session == null || npc == null) return;
        npcChallengedAt.put(userId, now);

        Challenge challenge = new Challenge(UUID.randomUUID(), npcId, userId, room.data().id());
        challenges.put(challenge.id(), challenge);
        room.npcSay(npcId, NpcDialog.challengeYou(session.user().username(), random), userId);
        session.send(Map.of("type", "challenge_received", "challengeId", challenge.id(),
                "from", Map.of("id", npcId, "username", npc.username()), "expiresIn", CHALLENGE_MILLIS));
        registry.schedule(() -> {
            if (challenges.remove(challenge.id()) != null) {
                send(userId, Map.of("type", "challenge_expired", "challengeId", challenge.id()));
            }
        }, CHALLENGE_MILLIS);
    }

    /** Mossa di un NPC fra qualche istante, solo se la partita e' ancora in corso. */
    private void npcLater(LiveGame live, long delay, Runnable move) {
        registry.schedule(() -> {
            synchronized (live) {
                if (!live.finished) move.run();
            }
        }, delay);
    }

    private UUID npcIn(LiveGame live, RoomInstance room) {
        if (room == null) return null;
        if (room.isNpc(live.game.a().userId())) return live.game.a().userId();
        if (room.isNpc(live.game.b().userId())) return live.game.b().userId();
        return null;
    }

    private void npcTeam(LiveGame live, RoomInstance room, UUID npcId) {
        PvpGame game = live.game;
        if (game.phase() != PvpGame.Phase.TEAM) return;
        boolean ready = game.setTeam(npcId, npcDeals.team(room.npcRole(npcId), random));
        send(game.opponent(npcId).userId(), Map.of("type", "pvp_opponent_ready"));
        if (ready) beginRound(live);
    }

    /** Categoria scelta dall'NPC: quella in cui la sua carta migliore ancora da giocare e' piu' forte. */
    private void npcCategory(LiveGame live, UUID npcId) {
        PvpGame game = live.game;
        if (game.phase() != PvpGame.Phase.CATEGORY) return;
        PvpGame.Player me = game.player(npcId);
        String best = PvpGame.CATEGORIES.get(0);
        int bestValue = -1;
        for (String category : PvpGame.CATEGORIES) {
            for (int i = 0; i < me.team().size(); i++) {
                if (me.used.contains(i)) continue;
                int value = me.team().get(i).stat(category);
                if (value > bestValue) {
                    bestValue = value;
                    best = category;
                }
            }
        }
        if (game.chooseCategory(npcId, best)) {
            cancelTimer(live);
            announceCategory(live);
        }
    }

    /** Carta scelta dall'NPC: di solito la piu' forte nella categoria, a volte una a sorpresa. */
    private void npcCard(LiveGame live, UUID npcId) {
        PvpGame game = live.game;
        if (game.phase() != PvpGame.Phase.CARDS || game.hasPicked(npcId)) return;
        PvpGame.Player me = game.player(npcId);
        List<Integer> free = new ArrayList<>();
        for (int i = 0; i < me.team().size(); i++) if (!me.used.contains(i)) free.add(i);
        if (free.isEmpty()) return;
        int pick = free.get(0);
        for (int i : free) if (me.team().get(i).stat(game.category()) > me.team().get(pick).stat(game.category())) pick = i;
        if (random.nextInt(4) == 0) pick = free.get(random.nextInt(free.size()));
        boolean boost = !me.boostUsed && (game.round() == PvpGame.ROUNDS || random.nextInt(3) == 0);
        if (!game.pickCard(npcId, pick, boost)) return;
        send(game.opponent(npcId).userId(), Map.of("type", "pvp_opponent_picked"));
        if (game.bothPicked()) {
            cancelTimer(live);
            resolveRound(live);
        }
    }

    // ------------------------------------------------------------------ partita

    /** Squadra di 3 carte, indicate con il code pubblico. Il server verifica che siano tue. */
    public String team(HotelSession session, List<String> codes) {
        LiveGame live = gamesByUser.get(session.user().id());
        if (live == null) return "not_in_match";
        if (codes == null || codes.size() != PvpGame.TEAM_SIZE || new HashSet<>(codes).size() != PvpGame.TEAM_SIZE) {
            return "invalid_team";
        }

        Map<String, Card> owned = new LinkedHashMap<>();
        for (UserCard uc : userCardRepository.findByUserIdWithCard(session.user().id())) {
            if (uc.getQuantity() > 0) owned.put(uc.getCard().getCode(), uc.getCard());
        }
        List<PvpGame.CardInfo> team = new ArrayList<>();
        for (String code : codes) {
            Card card = owned.get(code);
            if (card == null) return "card_not_owned";
            team.add(cardInfo(card));
        }

        synchronized (live) {
            if (live.finished) return "not_in_match";
            PvpGame game = live.game;
            if (game.phase() != PvpGame.Phase.TEAM) return "invalid_phase";
            boolean ready = game.setTeam(session.user().id(), team);
            userCardRepository.countBattle(session.user().id(), codes);
            session.send(Map.of("type", "pvp_team_ok"));
            send(game.opponent(session.user().id()).userId(), Map.of("type", "pvp_opponent_ready"));
            if (ready) beginRound(live);
        }
        return null;
    }

    public String category(HotelSession session, String category) {
        LiveGame live = gamesByUser.get(session.user().id());
        if (live == null) return "not_in_match";
        synchronized (live) {
            if (live.finished || !live.game.chooseCategory(session.user().id(), category)) return "invalid_move";
            cancelTimer(live);
            announceCategory(live);
        }
        return null;
    }

    public String card(HotelSession session, int index, boolean boost) {
        LiveGame live = gamesByUser.get(session.user().id());
        if (live == null) return "not_in_match";
        synchronized (live) {
            if (live.finished || !live.game.pickCard(session.user().id(), index, boost)) return "invalid_move";
            send(live.game.opponent(session.user().id()).userId(), Map.of("type", "pvp_opponent_picked"));
            session.send(Map.of("type", "pvp_card_ok", "index", index));
            if (live.game.bothPicked()) {
                cancelTimer(live);
                resolveRound(live);
            }
        }
        return null;
    }

    /**
     * Resa, uscita dalla stanza o disconnessione: vince l'altro. Annulla anche le sfide in sospeso
     * e lo dice a entrambi, anche a chi se ne va: altrimenti il suo popup resterebbe aperto
     * nella stanza nuova.
     */
    public void userLeft(UUID userId) {
        challenges.values().removeIf(c -> {
            if (!c.from().equals(userId) && !c.to().equals(userId)) return false;
            Map<String, Object> expired = Map.of("type", "challenge_expired", "challengeId", c.id());
            send(c.from(), expired);
            send(c.to(), expired);
            return true;
        });
        LiveGame live = gamesByUser.get(userId);
        if (live == null) return;
        synchronized (live) {
            if (live.finished) return;
            finish(live, live.game.opponent(userId).userId(), true);
        }
    }

    public boolean isBusy(UUID userId) {
        return gamesByUser.containsKey(userId);
    }

    // ------------------------------------------------------------------ svolgimento (chiamati con il lock)

    private void beginRound(LiveGame live) {
        PvpGame game = live.game;
        if (game.phase() == PvpGame.Phase.CATEGORY) {
            long deadline = System.currentTimeMillis() + CATEGORY_MILLIS;
            for (PvpGame.Player p : List.of(game.a(), game.b())) {
                send(p.userId(), roundMessage(game, p, deadline));
            }
            live.timer = registry.schedule(() -> {
                synchronized (live) {
                    if (live.finished || game.phase() != PvpGame.Phase.CATEGORY) return;
                    game.autoCategory();
                    announceCategory(live);
                }
            }, CATEGORY_MILLIS);
            UUID npc = npcIn(live, registry.get(live.roomId));
            if (npc != null && npc.equals(game.chooser())) npcLater(live, 2_000 + random.nextInt(1_500), () -> npcCategory(live, npc));
        } else {
            for (PvpGame.Player p : List.of(game.a(), game.b())) {
                send(p.userId(), roundMessage(game, p, 0));
            }
            announceCategory(live);
        }
    }

    private void announceCategory(LiveGame live) {
        PvpGame game = live.game;
        long deadline = System.currentTimeMillis() + CARD_MILLIS;
        Map<String, Object> message = Map.of("type", "pvp_category", "round", game.round(),
                "category", game.category(), "deadline", deadline, "serverTime", System.currentTimeMillis());
        send(game.a().userId(), message);
        send(game.b().userId(), message);
        live.timer = registry.schedule(() -> {
            synchronized (live) {
                if (live.finished || game.phase() != PvpGame.Phase.CARDS) return;
                game.autoPicks();
                resolveRound(live);
            }
        }, CARD_MILLIS);
        UUID npc = npcIn(live, registry.get(live.roomId));
        if (npc != null) npcLater(live, 1_500 + random.nextInt(3_000), () -> npcCard(live, npc));
    }

    private void resolveRound(LiveGame live) {
        PvpGame game = live.game;
        PvpGame.RoundResult result = game.resolve();
        send(game.a().userId(), revealMessage(result, game, true));
        send(game.b().userId(), revealMessage(result, game, false));

        live.timer = registry.schedule(() -> {
            synchronized (live) {
                if (live.finished) return;
                if (game.phase() == PvpGame.Phase.ENDED) finish(live, game.winner(), false);
                else beginRound(live);
            }
        }, REVEAL_PAUSE_MILLIS);
    }

    private void onTeamTimeout(LiveGame live) {
        synchronized (live) {
            if (live.finished || live.game.phase() != PvpGame.Phase.TEAM) return;
            PvpGame game = live.game;
            boolean aReady = game.a().team() != null;
            boolean bReady = game.b().team() != null;
            if (aReady == bReady) {
                // Nessuno dei due ha scelto: partita annullata, senza vincitori ne' ricompense.
                live.finished = true;
                release(live);
                Map<String, Object> cancelled = Map.of("type", "pvp_cancelled", "reason", "team_timeout");
                send(game.a().userId(), cancelled);
                send(game.b().userId(), cancelled);
                return;
            }
            finish(live, aReady ? game.a().userId() : game.b().userId(), true);
        }
    }

    private void finish(LiveGame live, UUID winnerId, boolean forfeit) {
        live.finished = true;
        cancelTimer(live);
        PvpGame game = live.game;
        game.end();
        release(live);

        RoomInstance npcRoom = registry.get(live.roomId);
        UUID npc = npcIn(live, npcRoom);
        PvpRewardService.Outcome outcome;
        try {
            outcome = npc != null
                    ? npcOutcome(game, npcRoom, npc, winnerId)
                    : rewardService.finish(game.a().userId(), game.b().userId(), winnerId,
                    game.a().score(), game.b().score(), forfeit, game.history());
        } catch (RuntimeException ex) {
            log.error("Salvataggio della partita {} fallito", game.id(), ex);
            outcome = new PvpRewardService.Outcome(game.id(),
                    new PvpRewardService.PlayerReward(0, 0, true, 0), new PvpRewardService.PlayerReward(0, 0, true, 0));
        }

        send(game.a().userId(), endMessage(game, true, winnerId, forfeit, outcome.a()));
        send(game.b().userId(), endMessage(game, false, winnerId, forfeit, outcome.b()));
        if (npc != null) {
            npcRoom.npcBusy(npc, false);
            String rival = game.opponent(npc).username();
            npcRoom.npcSay(npc, winnerId == null ? NpcDialog.matchDraw(rival)
                    : winnerId.equals(npc) ? NpcDialog.matchWon(rival) : NpcDialog.matchLost(rival), game.opponent(npc).userId());
        }

        RoomInstance room = registry.get(live.roomId);
        if (room != null) {
            Map<String, Object> announce = new LinkedHashMap<>();
            announce.put("type", "pvp_result");
            announce.put("a", game.a().username());
            announce.put("b", game.b().username());
            announce.put("scoreA", game.a().score());
            announce.put("scoreB", game.b().score());
            announce.put("winner", winnerId == null ? null : game.player(winnerId).username());
            announce.put("forfeit", forfeit);
            room.announce(announce);
        }
    }

    /** Partita contro un NPC: premio solo al giocatore, con il limite giornaliero delle partite con gli NPC. */
    private PvpRewardService.Outcome npcOutcome(PvpGame game, RoomInstance room, UUID npc, UUID winnerId) {
        UUID human = game.opponent(npc).userId();
        PvpRewardService.PlayerReward reward = npcDeals.reward(human, room.npcUser(npc).username(),
                human.equals(winnerId), winnerId == null);
        PvpRewardService.PlayerReward none = new PvpRewardService.PlayerReward(0, 0, true, 0);
        boolean humanIsA = game.a().userId().equals(human);
        return new PvpRewardService.Outcome(game.id(), humanIsA ? reward : none, humanIsA ? none : reward);
    }

    private void release(LiveGame live) {
        gamesByUser.remove(live.game.a().userId(), live);
        gamesByUser.remove(live.game.b().userId(), live);
    }

    private static void cancelTimer(LiveGame live) {
        if (live.timer != null) live.timer.cancel(false);
        live.timer = null;
    }

    // ------------------------------------------------------------------ messaggi

    private void send(UUID userId, Object message) {
        HotelSession session = registry.sessionOf(userId);
        if (session != null) session.send(message);
    }

    static PvpGame.CardInfo cardInfo(Card card) {
        Map<String, Integer> stats = Map.of("fans", card.getFans(), "style", card.getStyle(),
                "influence", card.getInfluence(), "energy", card.getEnergy());
        return new PvpGame.CardInfo(card.getCode(), card.getName(), card.getRarity(), card.getImgUrl(),
                card.getSource(), card.isFullImage(), stats);
    }

    private static Map<String, Object> startMessage(PvpGame game, HotelUser me, HotelUser opponent, String side, long deadline) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "pvp_start");
        message.put("matchId", game.id());
        message.put("side", side);
        message.put("opponent", opponent);
        message.put("teamDeadline", deadline);
        message.put("serverTime", System.currentTimeMillis());
        message.put("rules", Map.of("rounds", PvpGame.ROUNDS, "teamSize", PvpGame.TEAM_SIZE, "boost", 25));
        return message;
    }

    private static Map<String, Object> roundMessage(PvpGame game, PvpGame.Player me, long deadline) {
        PvpGame.Player opponent = game.opponent(me.userId());
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "pvp_round");
        message.put("round", game.round());
        message.put("chooser", game.chooser() == null ? "server" : game.chooser().equals(me.userId()) ? "you" : "opponent");
        message.put("deadline", deadline);
        message.put("serverTime", System.currentTimeMillis());
        message.put("score", Map.of("you", me.score(), "opponent", opponent.score()));
        message.put("team", me.team());
        message.put("used", List.copyOf(me.used));
        message.put("boostUsed", me.boostUsed);
        return message;
    }

    private static Map<String, Object> revealMessage(PvpGame.RoundResult r, PvpGame game, boolean forA) {
        Map<String, Object> you = Map.of("card", forA ? r.cardA() : r.cardB(), "value", forA ? r.valueA() : r.valueB(),
                "boost", forA ? r.boostA() : r.boostB());
        Map<String, Object> opponent = Map.of("card", forA ? r.cardB() : r.cardA(), "value", forA ? r.valueB() : r.valueA(),
                "boost", forA ? r.boostB() : r.boostA());
        UUID me = forA ? game.a().userId() : game.b().userId();
        String winner = r.winnerId() == null ? "draw" : r.winnerId().equals(me) ? "you" : "opponent";
        PvpGame.Player self = game.player(me);
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "pvp_reveal");
        message.put("round", r.round());
        message.put("category", r.category());
        message.put("you", you);
        message.put("opponent", opponent);
        message.put("winner", winner);
        message.put("score", Map.of("you", self.score(), "opponent", game.opponent(me).score()));
        return message;
    }

    private static Map<String, Object> endMessage(PvpGame game, boolean forA, UUID winnerId, boolean forfeit,
                                                  PvpRewardService.PlayerReward reward) {
        UUID me = forA ? game.a().userId() : game.b().userId();
        String result = winnerId == null ? "draw" : winnerId.equals(me) ? "win" : "loss";
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "pvp_end");
        message.put("result", result);
        message.put("forfeit", forfeit);
        message.put("score", Map.of("you", game.player(me).score(), "opponent", game.opponent(me).score()));
        message.put("reward", reward);
        return message;
    }
}
