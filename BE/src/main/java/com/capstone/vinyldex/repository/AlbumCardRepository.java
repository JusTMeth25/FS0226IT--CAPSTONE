package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.AlbumCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AlbumCardRepository extends JpaRepository<AlbumCard, UUID> {

    List<AlbumCard> findByAlbumId(UUID albumId);

    long countByAlbumId(UUID albumId);
}
