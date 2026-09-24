package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.PvpMatch;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.repository.PvpMatchRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.LevelService;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Salva le partite concluse e assegna le ricompense, con i limiti anti-abuso.
 *
 * Le ricompense le decide questa classe, mai il client: il risultato arriva dal motore della
 * partita sul server. I limiti giornalieri impediscono che due giocatori d'accordo si
 * sfidino all'infinito per accumulare gold ed esperienza.
 */
@Service
public class PvpRewardService {

    public static final int MAX_REWARDED_PER_DAY = 5;
    public static final int MAX_REWARDED_PER_OPPONENT = 2;

    record Reward(int gold, int xp) {
    }

    static final Reward WIN = new Reward(80, 150);
    static final Reward DRAW = new Reward(30, 60);
    static final Reward LOSS = new Reward(10, 20);

    /** Esito di una partita dal punto di vista di un giocatore, come lo riceve il client. */
    public record PlayerReward(int gold, int xp, boolean capped, int level) {
    }

    public record Outcome(UUID matchId, PlayerReward a, PlayerReward b) {
    }

    private final PvpMatchRepository matchRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final LevelService levelService;
    private final Clock clock = Clock.systemDefaultZone();

    public PvpRewardService(PvpMatchRepository matchRepository, UserRepository userRepository,
                            WalletService walletService, LevelService levelService) {
        this.matchRepository = matchRepository;
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.levelService = levelService;
    }

    /**
     * @param winnerId null per il pareggio
     */
    @Transactional
    public Outcome finish(UUID playerA, UUID playerB, UUID winnerId, int scoreA, int scoreB, boolean forfeit,
                          List<Map<String, Object>> rounds) {
        Instant startOfDay = LocalDate.now(clock).atStartOfDay(clock.getZone()).toInstant();
        boolean rewardA = eligible(playerA, playerB, startOfDay);
        boolean rewardB = eligible(playerB, playerA, startOfDay);

        PvpMatch match = new PvpMatch();
        match.setPlayerAId(playerA);
        match.setPlayerBId(playerB);
        match.setWinnerId(winnerId);
        match.setScoreA(scoreA);
        match.setScoreB(scoreB);
        match.setEndedBy(forfeit ? "forfeit" : "complete");
        match.setRounds(rounds);
        match.setRewardedA(rewardA);
        match.setRewardedB(rewardB);
        match = matchRepository.save(match);

        PlayerReward a = grant(playerA, winnerId, rewardA, match.getId());
        PlayerReward b = grant(playerB, winnerId, rewardB, match.getId());
        return new Outcome(match.getId(), a, b);
    }

    private boolean eligible(UUID userId, UUID opponentId, Instant since) {
        return matchRepository.countRewardedSince(userId, since) < MAX_REWARDED_PER_DAY
                && matchRepository.countRewardedAgainstSince(userId, opponentId, since) < MAX_REWARDED_PER_OPPONENT;
    }

    private PlayerReward grant(UUID userId, UUID winnerId, boolean rewarded, UUID matchId) {
        User user = userRepository.findById(userId).orElseThrow();
        Reward reward = winnerId == null ? DRAW : winnerId.equals(userId) ? WIN : LOSS;
        if (!rewarded) return new PlayerReward(0, 0, true, user.getLevel());

        user = walletService.adjustGold(userId, reward.gold(), WalletTransactionType.PVP_REWARD, matchId.toString());
        user.setXp(user.getXp() + reward.xp());
        user.setLevel(levelService.calcLevel(user.getXp()));
        // Le vittorie contro altri giocatori contano in classifica come quelle contro l'IA.
        if (userId.equals(winnerId)) user.setBattlesWon(user.getBattlesWon() + 1);
        userRepository.save(user);
        return new PlayerReward(reward.gold(), reward.xp(), false, user.getLevel());
    }
}
