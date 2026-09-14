package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserMission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserMissionRepository extends JpaRepository<UserMission, UUID> {

    Optional<UserMission> findByUserIdAndMissionId(UUID userId, UUID missionId);

    @Query("SELECT um FROM UserMission um JOIN FETCH um.mission WHERE um.user.id = :userId")
    List<UserMission> findByUserIdWithMission(@Param("userId") UUID userId);
}
