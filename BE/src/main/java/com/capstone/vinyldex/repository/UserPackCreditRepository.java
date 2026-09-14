package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserPackCredit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserPackCreditRepository extends JpaRepository<UserPackCredit, UUID> {

    Optional<UserPackCredit> findByUserIdAndPackCode(UUID userId, String packCode);

    List<UserPackCredit> findByUserIdAndQuantityGreaterThan(UUID userId, int minQuantity);
}
