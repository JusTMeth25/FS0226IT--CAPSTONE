package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ricompense di fine battaglia.
 *
 * Il client comunica solo l'esito: risultato, difficolta' e stage superati. Gli importi li
 * decide questa classe, cosi' modificare la richiesta non permette di ottenere ricompense
 * arbitrarie. Le tabelle devono restare allineate a quelle di BattlePage.jsx.
 */
@Service
public class BattleService {

    private static final Map<String, Reward> SINGLE_REWARDS = Map.of(
            "win", new Reward(50, 100),
            "draw", new Reward(20, 40),
            "loss", new Reward(10, 20));

    private static final List<String> TOURNAMENT_ORDER = List.of("easy", "normal", "hard");

    private static final Map<String, Reward> DIFFICULTY_REWARDS = Map.of(
            "easy", new Reward(30, 60),
            "normal", new Reward(60, 120),
            "hard", new Reward(100, 200));

    private static final Reward CHAMPION_BONUS = new Reward(100, 150);

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final LevelService levelService;
    private final UserCardRepository userCardRepository;

    public BattleService(UserRepository userRepository, WalletService walletService, LevelService levelService,
                         UserCardRepository userCardRepository) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.levelService = levelService;
        this.userCardRepository = userCardRepository;
    }

    @Transactional
    public BattleRewardResult grantReward(UUID userId, GameRequests.BattleRewardRequest request) {
        Outcome outcome = computeReward(request);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        if (outcome.gold() > 0) {
            user = walletService.adjustGold(userId, outcome.gold(), WalletTransactionType.BATTLE_REWARD);
        }
        if (outcome.xp() > 0) {
            user.setXp(user.getXp() + outcome.xp());
            user.setLevel(levelService.calcLevel(user.getXp()));
        }
        if (outcome.battlesWon() > 0) {
            user.setBattlesWon(user.getBattlesWon() + outcome.battlesWon());
        }
        user = userRepository.save(user);
        // Le carte schierate contano come usate: sopra l'avatar dell'hotel si vedono le preferite.
        List<String> team = request.teamCodes();
        if (!team.isEmpty()) userCardRepository.countBattle(userId, team);

        return new BattleRewardResult(user.getGold(), user.getXp(), user.getLevel(),
                new MissionService.Rewards(outcome.gold(), outcome.xp()));
    }

    private Outcome computeReward(GameRequests.BattleRewardRequest request) {
        if (request.isTournament()) {
            int stagesCleared = Math.min(TOURNAMENT_ORDER.size(), request.stagesClearedOrZero());
            int gold = 0;
            int xp = 0;
            for (int i = 0; i < stagesCleared; i++) {
                Reward reward = DIFFICULTY_REWARDS.get(TOURNAMENT_ORDER.get(i));
                gold += reward.gold();
                xp += reward.xp();
            }
            if (request.wonAllStagesOrFalse()) {
                gold += CHAMPION_BONUS.gold();
                xp += CHAMPION_BONUS.xp();
            }
            // Ogni stage superato conta come una battaglia vinta per la classifica.
            return new Outcome(gold, xp, stagesCleared);
        }

        String result = request.result() == null ? "loss" : request.result().toLowerCase();
        Reward reward = SINGLE_REWARDS.getOrDefault(result, SINGLE_REWARDS.get("loss"));
        return new Outcome(reward.gold(), reward.xp(), "win".equals(result) ? 1 : 0);
    }

    private record Reward(int gold, int xp) {
    }

    private record Outcome(int gold, int xp, int battlesWon) {
    }

    public record BattleRewardResult(int gold, int xp, int level, MissionService.Rewards rewards) {
    }
}
