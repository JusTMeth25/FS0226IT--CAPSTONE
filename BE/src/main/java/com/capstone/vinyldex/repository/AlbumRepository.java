package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Album;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlbumRepository extends JpaRepository<Album, UUID> {

    Optional<Album> findByCode(String code);

    List<Album> findByActiveTrue();
}
