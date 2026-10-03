package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Card;

import java.util.Map;

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
        Double marketPrice,
        // Solo per le carte EA FC 27: il prezzo in crediti di Ultimate Team.
        Long coinPrice,
        // 1 per la versione olografica di una carta (HoloCardService): il frontend la fa brillare.
        int foil,
        // Carte con una foto con licenza libera (NBA Action): autore, licenza e pagina della foto.
        Map<String, Object> photoCredit,
        // Finitura olografica (CardFinish): holo, ultra, illustration, secret; null per le carte normali.
        String finish,
        // Tipologia per i bonus di squadra in battaglia (CardKind); null per le carte VinylDex.
        String kind
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
                card.getMarketPrice(),
                coinPrice(card),
                card.isHolo() ? 1 : 0,
                photoCredit(card),
                CardFinish.of(card),
                CardKind.of(card)
        );
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> photoCredit(Card card) {
        Object raw = card.getMetadata() == null ? null : card.getMetadata().get("actionPhoto");
        if (!(raw instanceof Map<?, ?> info)) return null;
        Map<String, Object> m = (Map<String, Object>) info;
        Map<String, Object> credit = new java.util.LinkedHashMap<>();
        for (String key : java.util.List.of("artist", "license", "licenseUrl", "page", "title")) {
            if (m.get(key) != null) credit.put(key, m.get(key));
        }
        return credit;
    }

    public static Long coinPrice(Card card) {
        Object raw = card.getMetadata() == null ? null : card.getMetadata().get("coinPrice");
        return raw instanceof Number n ? n.longValue() : null;
    }
}
