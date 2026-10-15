package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.NpcTrade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.UUID;

public interface NpcTradeRepository extends JpaRepository<NpcTrade, UUID> {

    long countByUserIdAndDay(UUID userId, LocalDate day);

    /** Scambi con gli NPC conclusi dopo quell'istante (finestra di TradeLimits). */
    long countByUserIdAndCreatedAtAfter(UUID userId, java.time.Instant after);
}
