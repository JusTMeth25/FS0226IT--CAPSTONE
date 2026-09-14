package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.UserCard;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Voce del catalogo con lo stato di possesso dell'utente.
 * Ripete i campi della carta invece di annidarli, perche' e' cosi' che il frontend li legge.
 */
public record CollectionEntryDto(
        String id,
        String name,
        String artistClass,
        String variant,
        String group,
        String rarity,
        String img,
        boolean fullImage,
        CardStatsDto stats,
        String description,
        String source,
        String setName,
        String setCode,
        String number,
        Double marketPrice,
        boolean owned,
        int quantity,
        @JsonProperty("isFavorite") boolean favorite,
        Instant obtainedAt
) {

    public static CollectionEntryDto from(Card card, UserCard userCard) {
        CardDto base = CardDto.from(card);
        return new CollectionEntryDto(
                base.id(), base.name(), base.artistClass(), base.variant(), base.group(), base.rarity(),
                base.img(), base.fullImage(), base.stats(), base.description(), base.source(),
                base.setName(), base.setCode(), base.number(), base.marketPrice(),
                userCard != null,
                userCard != null ? userCard.getQuantity() : 0,
                userCard != null && userCard.isFavorite(),
                userCard != null ? userCard.getObtainedAt() : null
        );
    }
}
