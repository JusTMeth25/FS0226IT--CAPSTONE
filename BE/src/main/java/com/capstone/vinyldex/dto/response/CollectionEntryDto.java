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
        // 1 se la carta e' la versione olografica di un'altra (HoloCardService).
        int foil,
        // Cofanetto del perito: numero di certificato e quando e' stata gradata.
        String gradeCert,
        Instant gradedAt,
        // Prima edizione: numero da 1 a 10 se il giocatore e' fra i primi dieci ad averla trovata.
        Integer firstEdition,
        // Finitura olografica (CardFinish), null per le carte normali.
        String finish
) {

    /** Nel raccoglitore: la tasca della carta base brilla (ed e' piena) se si ha la sua olografica. */
    public CollectionEntryDto withHoloOwned() {
        return new CollectionEntryDto(id, name, artistClass, variant, group, rarity, img, fullImage, stats, description,
                source, setName, setCode, number, marketPrice, coinPrice, true, quantity, favorite, obtainedAt, grade, 1,
                gradeCert, gradedAt, firstEdition, finish);
    }

    public CollectionEntryDto withFirstEdition(Integer serial) {
        return new CollectionEntryDto(id, name, artistClass, variant, group, rarity, img, fullImage, stats, description,
                source, setName, setCode, number, marketPrice, coinPrice, owned, quantity, favorite, obtainedAt, grade, foil,
                gradeCert, gradedAt, serial, finish);
    }

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
                card.isHolo() ? 1 : 0,
                userCard != null && userCard.getGrade() != null ? certificate(userCard) : null,
                userCard != null ? userCard.getGradedAt() : null,
                null,
                base.finish()
        );
    }

    /** Numero di certificato del cofanetto: stabile, ricavato dalla copia gradata. */
    public static String certificate(UserCard userCard) {
        String hex = userCard.getId() == null ? "00000000" : userCard.getId().toString().replace("-", "");
        return "VDX-" + hex.substring(0, 4).toUpperCase() + "-" + hex.substring(hex.length() - 4).toUpperCase();
    }
}
