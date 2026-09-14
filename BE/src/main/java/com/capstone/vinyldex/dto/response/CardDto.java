package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Card;

/**
 * Carta come la vede il frontend.
 *
 * Attenzione al campo id: e' il code della carta (es. "showman-001"), non lo UUID della riga.
 * Il code e' stabile, leggibile e coincide con quello dei dati demo locali, quindi le due
 * fonti restano intercambiabili senza rimappare nulla lato client.
 */
public record CardDto(
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
        Double marketPrice
) {

    public static CardDto from(Card card) {
        if (card == null) return null;
        return new CardDto(
                card.getCode(),
                card.getName(),
                card.getArtistClass() != null ? card.getArtistClass().getName() : null,
                card.getVariant(),
                card.getGroup(),
                card.getRarity(),
                card.getImgUrl() != null ? card.getImgUrl() : "",
                card.isFullImage(),
                new CardStatsDto(card.getFans(), card.getStyle(), card.getInfluence(), card.getEnergy()),
                card.getDescription(),
                card.getSource(),
                card.getSetName(),
                card.getSetCode(),
                card.getNumber(),
                card.getMarketPrice()
        );
    }
}
