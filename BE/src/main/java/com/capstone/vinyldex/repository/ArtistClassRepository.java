package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.ArtistClass;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ArtistClassRepository extends JpaRepository<ArtistClass, UUID> {

    Optional<ArtistClass> findBySlug(String slug);
}
