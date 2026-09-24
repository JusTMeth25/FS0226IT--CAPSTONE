package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserWalletTransaction;
import com.capstone.vinyldex.entity.WalletTransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.UUID;

public interface UserWalletTransactionRepository extends JpaRepository<UserWalletTransaction, UUID> {

    Page<UserWalletTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /** Transazioni di un tipo con riferimento che inizia per un prefisso, da un certo momento (limiti giornalieri). */
    long countByUserIdAndTypeAndRelatedIdStartingWithAndCreatedAtAfter(UUID userId, WalletTransactionType type,
                                                                        String relatedIdPrefix, Instant after);
}
