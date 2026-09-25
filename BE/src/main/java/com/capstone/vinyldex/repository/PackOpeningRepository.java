package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.PackOpening;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

import java.util.List;
import java.util.UUID;

public interface PackOpeningRepository extends JpaRepository<PackOpening, UUID> {

    @Query("SELECT po FROM PackOpening po JOIN FETCH po.user JOIN FETCH po.pack ORDER BY po.createdAt DESC")
    List<PackOpening> findRecentWithUserAndPack(Limit limit);

    /** Aperture recenti di un giocatore, dalla piu' nuova, con il pacchetto e le carte uscite. */
    @Query("SELECT DISTINCT po FROM PackOpening po JOIN FETCH po.pack LEFT JOIN FETCH po.cards poc LEFT JOIN FETCH poc.card "
            + "WHERE po.user.id = :userId AND po.createdAt > :after ORDER BY po.createdAt DESC")
    List<PackOpening> findRecentOfUser(@Param("userId") UUID userId, @Param("after") Instant after);
}
