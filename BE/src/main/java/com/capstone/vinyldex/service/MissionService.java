package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.MissionDto;
import com.capstone.vinyldex.entity.*;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.MissionRepository;
import com.capstone.vinyldex.repository.UserMissionRepository;
import com.capstone.vinyldex.repository.UserPackCreditRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Elenco missioni, riscatto ricompense e bonus di accesso giornaliero. */
@Service
public class MissionService {

    private final MissionRepository missionRepository;
    private final UserMissionRepository userMissionRepository;
    private final UserPackCreditRepository packCreditRepository;
    private final UserRepository userRepository;
    private final MissionEngine missionEngine;
    private final WalletService walletService;
    private final LevelService levelService;

    public MissionService(MissionRepository missionRepository,
                          UserMissionRepository userMissionRepository,
                          UserPackCreditRepository packCreditRepository,
                          UserRepository userRepository,
                          MissionEngine missionEngine,
                          WalletService walletService,
                          LevelService levelService) {
        this.missionRepository = missionRepository;
        this.userMissionRepository = userMissionRepository;
        this.packCreditRepository = packCreditRepository;
        this.userRepository = userRepository;
        this.missionEngine = missionEngine;
        this.walletService = walletService;
        this.levelService = levelService;
    }

    /**
     * Missioni attive con il progresso dell'utente.
     *
     * Prima di leggere ricalcola i progressi assoluti e crea le righe mancanti, cosi' una
     * missione aggiunta dopo l'ultimo accesso compare subito con il valore giusto.
     */
    @Transactional
    public List<MissionDto> listMissions(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        List<Mission> missions = missionRepository.findByActiveTrue();
        missionEngine.recomputeAbsolute(user);
        missions.forEach(mission -> missionEngine.getOrCreate(user, mission));

        Map<UUID, UserMission> byMissionId = userMissionRepository.findByUserIdWithMission(userId).stream()
                .collect(Collectors.toMap(um -> um.getMission().getId(), Function.identity(), (a, b) -> a));

        return missions.stream()
                .map(mission -> MissionDto.from(mission, byMissionId.get(mission.getId())))
                .toList();
    }

    /**
     * Riscuote la ricompensa di una missione completata.
     *
     * @param missionCode il code pubblico della missione
     */
    @Transactional
    public RewardResult claim(UUID userId, String missionCode) {
        Mission mission = missionRepository.findByCode(missionCode)
                .orElseThrow(() -> ApiException.notFound("mission_not_found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        UserMission userMission = userMissionRepository.findByUserIdAndMissionId(userId, mission.getId())
                .filter(um -> um.isCompleted() && !um.isClaimed())
                .orElseThrow(() -> ApiException.badRequest("mission_not_claimable"));

        userMission.setClaimed(true);
        userMissionRepository.save(userMission);

        if (mission.getRewardGold() > 0) {
            user = walletService.adjustGold(userId, mission.getRewardGold(),
                    WalletTransactionType.MISSION_REWARD, mission.getId().toString());
        }
        if (mission.getRewardXp() > 0) {
            user.setXp(user.getXp() + mission.getRewardXp());
            user.setLevel(levelService.calcLevel(user.getXp()));
            user = userRepository.save(user);
        }
        if (mission.getRewardPack() != null) {
            grantPackCredit(user, mission.getRewardPack());
        }

        return new RewardResult(user.getGold(), user.getXp(), user.getLevel(), user.getLoginStreak(), null);
    }

    /**
     * Bonus di accesso giornaliero. Si puo' riscuotere una volta per giorno di calendario;
     * accedere in giorni consecutivi fa crescere la serie e con essa la ricompensa.
     */
    @Transactional
    public RewardResult claimDailyLogin(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        LocalDate today = LocalDate.now();
        if (today.equals(user.getLastLoginDate())) {
            throw ApiException.conflict("already_claimed");
        }

        boolean consecutive = user.getLastLoginDate() != null
                && user.getLastLoginDate().equals(today.minusDays(1));
        int streak = consecutive ? user.getLoginStreak() + 1 : 1;

        int goldReward = 10 + streak * 2;
        int xpReward = 20 + streak * 3;

        user.setLastLoginDate(today);
        user.setLoginStreak(streak);
        userRepository.save(user);

        user = walletService.adjustGold(userId, goldReward, WalletTransactionType.DAILY_LOGIN);
        user.setXp(user.getXp() + xpReward);
        user.setLevel(levelService.calcLevel(user.getXp()));
        user = userRepository.save(user);

        return new RewardResult(user.getGold(), user.getXp(), user.getLevel(), user.getLoginStreak(),
                new Rewards(goldReward, xpReward));
    }

    private void grantPackCredit(User user, String packCode) {
        UserPackCredit credit = packCreditRepository.findByUserIdAndPackCode(user.getId(), packCode)
                .orElseGet(() -> new UserPackCredit(user, packCode, 0));
        credit.setQuantity(credit.getQuantity() + 1);
        packCreditRepository.save(credit);
    }

    public record RewardResult(int gold, int xp, int level, int loginStreak, Rewards rewards) {
    }

    public record Rewards(int gold, int xp) {
    }
}
