package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.NpcFoundCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NpcFoundCardRepository extends JpaRepository<NpcFoundCard, UUID> {

    /** Le carte trovate da un NPC, dalla piu' recente. */
    List<NpcFoundCard> findByNpcIdOrderByFoundAtDesc(UUID npcId);

    Optional<NpcFoundCard> findByNpcIdAndCardId(UUID npcId, UUID cardId);
}
