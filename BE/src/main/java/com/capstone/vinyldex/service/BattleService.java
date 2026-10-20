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
 * Il client comunica solo l'esito (vittoria, pareggio, sconfitta). Gli importi li decide questa
 * classe, cosi' modificare la richiesta non permette di ottenere ricompense arbitrarie. La
 * tabella deve restare allineata a quella di BattlePage.jsx. Il torneo vero e' quello dell'hotel
 * (CardTournamentService), con i suoi premi.
 */
@Service
public class BattleService {

    private static final Map<String, Reward> SINGLE_REWARDS = Map.of(
            "win", new Reward(50, 100),
            "draw", new Reward(20, 40),
            "loss", new Reward(10, 20));

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final LevelService levelService;
    private final UserCardRepository userCardRepository;
    private final CardExtrasService cardExtrasService;

    public BattleService(UserRepository userRepository, WalletService walletService, LevelService levelService,
                         UserCardRepository userCardRepository, CardExtrasService cardExtrasService) {
        this.cardExtrasService = cardExtrasService;
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
        // Sfida della carta del giorno: vinta con quella carta in squadra.
        int dailyGold = cardExtrasService.onBattle(userId, team, outcome.battlesWon() > 0);
        if (dailyGold > 0) user = userRepository.findById(userId).orElse(user);

        return new BattleRewardResult(user.getGold(), user.getXp(), user.getLevel(),
                new MissionService.Rewards(outcome.gold(), outcome.xp()));
    }

    private Outcome computeReward(GameRequests.BattleRewardRequest request) {
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
