package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.ExternalCardSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ExternalCardSourceRepository extends JpaRepository<ExternalCardSource, UUID> {

    Optional<ExternalCardSource> findBySource(String source);
}
