package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {

    Optional<Event> findByCode(String code);

    List<Event> findAllByOrderByCreatedAtDesc();

    /** startsAt nullo significa "gia' iniziato": va in fondo all'ordinamento, non scartato. */
    @Query("""
            SELECT DISTINCT e FROM Event e
            LEFT JOIN FETCH e.packs
            LEFT JOIN FETCH e.missions
            WHERE e.active = true
            ORDER BY e.startsAt ASC NULLS LAST
            """)
    List<Event> findActiveWithPacksAndMissions();
}
