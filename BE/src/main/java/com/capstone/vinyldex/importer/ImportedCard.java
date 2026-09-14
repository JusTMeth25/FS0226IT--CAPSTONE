package com.capstone.vinyldex.importer;

import java.util.HashMap;
import java.util.Map;

/**
 * Carta normalizzata da una fonte esterna, prima del salvataggio.
 *
 * Ogni importer traduce il formato della propria API in questa forma, cosi' il salvataggio
 * e' scritto una volta sola e vale per tutte le fonti.
 */
public record ImportedCard(
        String externalId,
        String code,
        String name,
        String setName,
        String setCode,
        String number,
        String rarity,
        String imgUrl,
        String description,
        Map<String, Object> metadata
) {

    /** Carta segnaposto usata quando l'API esterna non risponde. */
    public static ImportedCard demo(String source, String externalId, String name, String rarity, String description) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("demo", true);
        return new ImportedCard(externalId, source + "-" + externalId, name,
                "Demo Set", null, null, rarity, "", description, metadata);
    }

    /** Vero per le carte segnaposto: non hanno un'immagine reale e non devono finire nei pacchetti. */
    public boolean isDemo() {
        return metadata != null && Boolean.TRUE.equals(metadata.get("demo"));
    }
}
