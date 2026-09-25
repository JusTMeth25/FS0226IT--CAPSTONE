package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserCard;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserCardRepository extends JpaRepository<UserCard, UUID> {

    Optional<UserCard> findByUserIdAndCardId(UUID userId, UUID cardId);

    /** Una battaglia in piu' per ognuna delle carte schierate (indicate con il code pubblico). */
    @Modifying
    @Transactional
    @Query("UPDATE UserCard uc SET uc.battlesUsed = uc.battlesUsed + 1 WHERE uc.user.id = :userId AND uc.card.code IN :codes")
    int countBattle(@Param("userId") UUID userId, @Param("codes") Collection<String> codes);

    List<UserCard> findByUserId(UUID userId);

    long countByUserId(UUID userId);

    @Query("SELECT uc FROM UserCard uc JOIN FETCH uc.card c LEFT JOIN FETCH c.artistClass WHERE uc.user.id = :userId")
    List<UserCard> findByUserIdWithCard(@Param("userId") UUID userId);

    /** Classifica collezione: quante carte distinte possiede ogni utente. */
    @Query("""
            SELECT uc.user.id AS userId, uc.user.username AS username, COUNT(uc.card.id) AS value
            FROM UserCard uc
            WHERE uc.user.banned = false AND uc.quantity > 0
            GROUP BY uc.user.id, uc.user.username
            ORDER BY COUNT(uc.card.id) DESC
            """)
    List<LeaderboardRow> findCollectionLeaderboard(Limit limit);

    interface LeaderboardRow {
        UUID getUserId();

        String getUsername();

        long getValue();
    }
}
