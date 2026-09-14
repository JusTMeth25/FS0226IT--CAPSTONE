package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.LeaderboardEntryDto;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Classifiche pubbliche. Gli utenti bannati non compaiono in nessuna. */
@Service
public class LeaderboardService {

    private static final Limit TOP = Limit.of(20);

    private final UserRepository userRepository;
    private final UserCardRepository userCardRepository;

    public LeaderboardService(UserRepository userRepository, UserCardRepository userCardRepository) {
        this.userRepository = userRepository;
        this.userCardRepository = userCardRepository;
    }

    /**
     * @param type "gold", "battles" oppure "collection" (predefinito: carte distinte possedute)
     */
    @Transactional(readOnly = true)
    public List<LeaderboardEntryDto> getLeaderboard(String type) {
        return switch (type == null ? "collection" : type.toLowerCase()) {
            case "gold" -> userRepository.findByBannedFalseOrderByGoldDesc(TOP).stream()
                    .map(u -> new LeaderboardEntryDto(u.getId(), u.getUsername(), u.getGold()))
                    .toList();

            // Chi non ha ancora vinto nulla resta fuori: una classifica di zeri non dice niente.
            case "battles" -> userRepository
                    .findByBannedFalseAndBattlesWonGreaterThanOrderByBattlesWonDesc(0, TOP).stream()
                    .map(u -> new LeaderboardEntryDto(u.getId(), u.getUsername(), u.getBattlesWon()))
                    .toList();

            default -> userCardRepository.findCollectionLeaderboard(TOP).stream()
                    .map(row -> new LeaderboardEntryDto(row.getUserId(), row.getUsername(), row.getValue()))
                    .toList();
        };
    }
}
