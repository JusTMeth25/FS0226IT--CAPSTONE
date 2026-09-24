package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.PvpMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface PvpMatchRepository extends JpaRepository<PvpMatch, UUID> {

    /** Partite premiate del giocatore da un certo momento in poi (di solito l'inizio del giorno). */
    @Query("""
            SELECT COUNT(m) FROM PvpMatch m
            WHERE m.createdAt >= :since
              AND ((m.playerAId = :userId AND m.rewardedA = true) OR (m.playerBId = :userId AND m.rewardedB = true))
            """)
    long countRewardedSince(@Param("userId") UUID userId, @Param("since") Instant since);

    /** Come sopra, ma solo contro un avversario preciso. */
    @Query("""
            SELECT COUNT(m) FROM PvpMatch m
            WHERE m.createdAt >= :since
              AND ((m.playerAId = :userId AND m.playerBId = :opponentId AND m.rewardedA = true)
                OR (m.playerBId = :userId AND m.playerAId = :opponentId AND m.rewardedB = true))
            """)
    long countRewardedAgainstSince(@Param("userId") UUID userId, @Param("opponentId") UUID opponentId,
                                   @Param("since") Instant since);
}
