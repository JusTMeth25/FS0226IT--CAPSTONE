package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.PackOpening;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PackOpeningRepository extends JpaRepository<PackOpening, UUID> {

    @Query("SELECT po FROM PackOpening po JOIN FETCH po.user JOIN FETCH po.pack ORDER BY po.createdAt DESC")
    List<PackOpening> findRecentWithUserAndPack(Limit limit);
}
