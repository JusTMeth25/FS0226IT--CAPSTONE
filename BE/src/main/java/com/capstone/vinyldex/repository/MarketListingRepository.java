package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.MarketListing;
import com.capstone.vinyldex.entity.MarketListingStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MarketListingRepository extends JpaRepository<MarketListing, UUID> {

    /** Vetrina pubblica: solo inserzioni attive, filtri rarita' e carta opzionali. */
    @Query("""
            SELECT l FROM MarketListing l
            JOIN FETCH l.card c
            LEFT JOIN FETCH c.artistClass
            JOIN FETCH l.seller
            WHERE l.status = com.capstone.vinyldex.entity.MarketListingStatus.ACTIVE
              AND (:cardId IS NULL OR c.id = :cardId)
              AND (:rarity IS NULL OR c.rarity = :rarity)
            ORDER BY l.createdAt DESC
            """)
    List<MarketListing> findActive(@Param("rarity") String rarity, @Param("cardId") UUID cardId);

    @Query("SELECT l FROM MarketListing l JOIN FETCH l.card JOIN FETCH l.seller ORDER BY l.createdAt DESC")
    List<MarketListing> findRecentWithCardAndSeller(Limit limit);

    List<MarketListing> findBySellerIdAndStatus(UUID sellerId, MarketListingStatus status);
}
