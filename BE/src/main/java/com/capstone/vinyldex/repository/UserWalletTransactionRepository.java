package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserWalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserWalletTransactionRepository extends JpaRepository<UserWalletTransaction, UUID> {

    Page<UserWalletTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
