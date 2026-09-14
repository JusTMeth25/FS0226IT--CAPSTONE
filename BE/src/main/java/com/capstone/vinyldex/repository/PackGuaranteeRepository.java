package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.PackGuarantee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PackGuaranteeRepository extends JpaRepository<PackGuarantee, UUID> {

    List<PackGuarantee> findByPackId(UUID packId);

    void deleteByPackId(UUID packId);
}
