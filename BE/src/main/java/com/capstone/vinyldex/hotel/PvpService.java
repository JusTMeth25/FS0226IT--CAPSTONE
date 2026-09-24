package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    private final RoomRegistry registry;
    private final UserCardRepository userCardRepository;
    private final PvpRewardService rewardService;
    private final SecureRandom random = new SecureRandom();

    private final Map<UUID, Challenge> challenges = new ConcurrentHashMap<>();
    private final Map<UUID, LiveGame> gamesByUser = new ConcurrentHashMap<>();

    public PvpService(RoomRegistry registry, UserCardRepository userCardRepository, PvpRewardService rewardService) {
        this.registry = registry;
        this.userCardRepository = userCardRepository;
        this.rewardService = rewardService;
    }

    // ------------------------------------------------------------------ sfida

    /** @return codice d'errore oppure null */
    public String challenge(HotelSession from, UUID toId) {
        UUID fromId = from.user().id();
        RoomInstance room = registry.get(from.roomId());
        if (toId == null || toId.equals(fromId)) return "cannot_challenge_yourself";
        if (room == null || !room.contains(toId)) return "user_not_here";
        if (room.isNpc(toId)) return "npc_no_challenge";
        if (isBusy(fromId)) return "already_in_match";
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

        if (!accept) {
            send(challenge.from(), Map.of("type", "challenge_declined", "challengeId", challengeId,
                    "by", session.user().username()));
            return null;
        }

        HotelSession challenger = registry.sessionOf(challenge.from());
        RoomInstance room = registry.get(challenge.roomId());
        if (challenger == null || room == null || !room.contains(challenge.from()) || !room.contains(userId)) {
            return "user_not_here";
        }
        if (isBusy(challenge.from()) || isBusy(userId)) return "opponent_busy";

        PvpGame game = new PvpGame(challenge.from(), challenger.user().username(), userId, session.user().username(), random);
        LiveGame live = new LiveGame(game, challenge.roomId());
        gamesByUser.put(challenge.from(), live);
        gamesByUser.put(userId, live);

        synchronized (live) {
            long deadline = System.currentTimeMillis() + TEAM_MILLIS;
            challenger.send(startMessage(game, challenger.user(), session.user(), "a", deadline));
            session.send(startMessage(game, session.user(), challenger.user(), "b", deadline));
            live.timer = registry.schedule(() -> onTeamTimeout(live), TEAM_MILLIS);
        }
        return null;
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

    /** Resa, uscita dalla stanza o disconnessione: vince l'altro. Annulla anche le sfide in sospeso. */
    public void userLeft(UUID userId) {
        challenges.values().removeIf(c -> {
            if (!c.from().equals(userId) && !c.to().equals(userId)) return false;
            UUID other = c.from().equals(userId) ? c.to() : c.from();
            send(other, Map.of("type", "challenge_expired", "challengeId", c.id()));
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

        PvpRewardService.Outcome outcome;
        try {
            outcome = rewardService.finish(game.a().userId(), game.b().userId(), winnerId,
                    game.a().score(), game.b().score(), forfeit, game.history());
        } catch (RuntimeException ex) {
            log.error("Salvataggio della partita {} fallito", game.id(), ex);
            outcome = new PvpRewardService.Outcome(game.id(),
                    new PvpRewardService.PlayerReward(0, 0, true, 0), new PvpRewardService.PlayerReward(0, 0, true, 0));
        }

        send(game.a().userId(), endMessage(game, true, winnerId, forfeit, outcome.a()));
        send(game.b().userId(), endMessage(game, false, winnerId, forfeit, outcome.b()));

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

    private static PvpGame.CardInfo cardInfo(Card card) {
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
