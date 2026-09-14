package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.TradeItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TradeItemRepository extends JpaRepository<TradeItem, UUID> {
}
