package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.MarketListing;
import com.capstone.vinyldex.entity.MarketListingStatus;

import java.time.Instant;
import java.util.UUID;

/** Inserzione di mercato. Qui l'id e' lo UUID reale, perche' l'inserzione non ha un code. */
public record MarketListingDto(
        UUID id,
        CardDto card,
        PublicUserDto seller,
        int quantity,
        int pricePerUnit,
        MarketListingStatus status,
        Instant createdAt
) {

    public static MarketListingDto from(MarketListing listing) {
        return new MarketListingDto(
                listing.getId(),
                CardDto.from(listing.getCard()),
                PublicUserDto.from(listing.getSeller()),
                listing.getQuantity(),
                listing.getPricePerUnit(),
                listing.getStatus(),
                listing.getCreatedAt());
    }
}
