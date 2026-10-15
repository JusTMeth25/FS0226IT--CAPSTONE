package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Trade;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TradeRepository extends JpaRepository<Trade, UUID> {

    /** Scambi fra giocatori conclusi dall'utente (da una parte o dall'altra) dopo quell'istante. */
    @Query("""
            SELECT count(t) FROM Trade t
            WHERE t.status = com.capstone.vinyldex.entity.TradeStatus.ACCEPTED AND t.updatedAt > :since
              AND (t.fromUser.id = :userId OR t.toUser.id = :userId)
            """)
    long countAcceptedSince(@Param("userId") UUID userId, @Param("since") java.time.Instant since);

    @Query("""
            SELECT DISTINCT t FROM Trade t
            JOIN FETCH t.fromUser
            JOIN FETCH t.toUser
            LEFT JOIN FETCH t.items i
            LEFT JOIN FETCH i.card c
            LEFT JOIN FETCH c.artistClass
            WHERE t.toUser.id = :userId
            ORDER BY t.createdAt DESC
            """)
    List<Trade> findIncoming(@Param("userId") UUID userId);

    @Query("""
            SELECT DISTINCT t FROM Trade t
            JOIN FETCH t.fromUser
            JOIN FETCH t.toUser
            LEFT JOIN FETCH t.items i
            LEFT JOIN FETCH i.card c
            LEFT JOIN FETCH c.artistClass
            WHERE t.fromUser.id = :userId
            ORDER BY t.createdAt DESC
            """)
    List<Trade> findOutgoing(@Param("userId") UUID userId);

    @Query("""
            SELECT DISTINCT t FROM Trade t
            JOIN FETCH t.fromUser
            JOIN FETCH t.toUser
            LEFT JOIN FETCH t.items i
            LEFT JOIN FETCH i.card c
            LEFT JOIN FETCH c.artistClass
            WHERE t.id = :id
            """)
    Optional<Trade> findByIdWithItems(@Param("id") UUID id);

    @Query("SELECT t FROM Trade t JOIN FETCH t.fromUser JOIN FETCH t.toUser ORDER BY t.createdAt DESC")
    List<Trade> findRecentWithUsers(Limit limit);
}
