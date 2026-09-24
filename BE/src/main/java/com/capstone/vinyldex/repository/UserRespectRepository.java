package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserRespect;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.UUID;

public interface UserRespectRepository extends JpaRepository<UserRespect, UUID> {

    long countByReceiverId(UUID receiverId);

    long countByGiverIdAndDay(UUID giverId, LocalDate day);

    boolean existsByGiverIdAndReceiverIdAndDay(UUID giverId, UUID receiverId, LocalDate day);
}
