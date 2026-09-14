package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.PackDropRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PackDropRateRepository extends JpaRepository<PackDropRate, UUID> {

    List<PackDropRate> findByPackId(UUID packId);

    void deleteByPackId(UUID packId);
}
