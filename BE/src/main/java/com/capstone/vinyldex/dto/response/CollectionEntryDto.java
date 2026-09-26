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
        // Solo per le carte EA FC 27: il prezzo in crediti di Ultimate Team.
        Long coinPrice,
        boolean owned,
        int quantity,
        @JsonProperty("isFavorite") boolean favorite,
        Instant obtainedAt,
        // Voto del perito dell'hotel (1-10), null se non gradata.
        Integer grade,
        // Copie olografiche fra quelle possedute.
        int foil,
        // Cofanetto del perito: numero di certificato e quando e' stata gradata.
        String gradeCert,
        Instant gradedAt
) {

    public static CollectionEntryDto from(Card card, UserCard userCard) {
        CardDto base = CardDto.from(card);
        return new CollectionEntryDto(
                base.id(), base.name(), base.artistClass(), base.variant(), base.group(), base.rarity(),
                base.img(), base.fullImage(), base.stats(), base.description(), base.source(),
                base.setName(), base.setCode(), base.number(), base.marketPrice(), base.coinPrice(),
                userCard != null,
                userCard != null ? userCard.getQuantity() : 0,
                userCard != null && userCard.isFavorite(),
                userCard != null ? userCard.getObtainedAt() : null,
                userCard != null ? userCard.getGrade() : null,
                userCard != null ? userCard.getFoilCount() : 0,
                userCard != null && userCard.getGrade() != null ? certificate(userCard) : null,
                userCard != null ? userCard.getGradedAt() : null
        );
    }

    /** Numero di certificato del cofanetto: stabile, ricavato dalla copia gradata. */
    static String certificate(UserCard userCard) {
        String hex = userCard.getId() == null ? "00000000" : userCard.getId().toString().replace("-", "");
        return "VDX-" + hex.substring(0, 4).toUpperCase() + "-" + hex.substring(hex.length() - 4).toUpperCase();
    }
}
