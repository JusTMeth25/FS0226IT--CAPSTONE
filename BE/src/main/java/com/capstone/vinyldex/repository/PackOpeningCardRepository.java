package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.PackOpeningCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PackOpeningCardRepository extends JpaRepository<PackOpeningCard, UUID> {
}
