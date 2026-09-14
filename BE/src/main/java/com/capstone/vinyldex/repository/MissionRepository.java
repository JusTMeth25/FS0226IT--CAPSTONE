package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Mission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MissionRepository extends JpaRepository<Mission, UUID> {

    Optional<Mission> findByCode(String code);

    List<Mission> findByActiveTrue();

    List<Mission> findByTypeAndActiveTrue(String type);

    List<Mission> findAllByOrderByCreatedAtDesc();
}
