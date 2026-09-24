package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Import da optcgapi.com. */
@Component
public class OnePieceImporter extends AbstractCardImporter {

    private static final String SOURCE = "onepiece";
    private static final int MAX_LIMIT = 250;

    public OnePieceImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /**
     * L'API non pagina: espone un solo endpoint con tutte le carte (~3500). Per restare coerenti
     * con le altre fonti si estrae qui un blocco casuale, cosi' ogni import porta carte diverse.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        List<JsonNode> all = elements(fetchJson("https://www.optcgapi.com/api/allSetCards/"));
        int start = randomStart(all.size(), limit);

        List<ImportedCard> cards = all.subList(start, Math.min(start + limit, all.size())).stream()
                .map(this::normalize)
                .toList();

        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, null, all.size());
    }

    private ImportedCard normalize(JsonNode card) {
        Double rawPrice = decimal(card, "market_price");
        Double price = rawPrice != null && rawPrice > 0 ? rawPrice : null;
        String externalId = externalIdFromImage(card);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("color", text(card, "card_color"));
        metadata.put("type", text(card, "card_type"));
        metadata.put("power", text(card, "card_power"));
        metadata.put("life", text(card, "life"));
        metadata.put("marketPrice", price);
        metadata.put("cost", text(card, "card_cost"));
        metadata.put("tcgRarity", text(card, "rarity"));

        String rarityByPrice = priceRarityMapper.rarityFromPrice(SOURCE, price);

        return new ImportedCard(
                externalId,
                SOURCE + "-" + externalId,
                text(card, "card_name"),
                text(card, "set_name"),
                text(card, "set_id"),
                text(card, "card_set_id"),
                rarityByPrice != null ? rarityByPrice : mapRarityFallback(text(card, "rarity")),
                textOrEmpty(card, "card_image"),
                text(card, "card_text"),
                metadata);
    }

    /**
     * L'API restituisce anche le versioni "Parallel" con lo stesso card_set_id dell'originale.
     * Il nome del file immagine (OP01-001 contro OP01-001_p1) e' l'unico identificatore davvero univoco.
     */
    private static String externalIdFromImage(JsonNode card) {
        String image = textOrEmpty(card, "card_image");
        String fallback = text(card, "card_set_id");
        if (image.isBlank()) return fallback;

        String[] parts = image.split("/");
        String file = parts[parts.length - 1].replaceAll("\\.[a-zA-Z]+$", "");
        return file.isBlank() ? fallback : file;
    }

    /** Usato solo quando manca il prezzo: e' la rarita' dichiarata, non il valore reale. */
    private static String mapRarityFallback(String raw) {
        String r = raw == null ? "" : raw.toUpperCase();
        if (r.equals("SEC")) return "legendary";
        if (r.equals("SR") || r.equals("TR")) return "epic";
        if (r.equals("R") || r.equals("L")) return "rare";
        if (r.equals("UC")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-luffy", "Monkey D. Luffy (demo)", "legendary",
                        "Carta demo (API OPTCG non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-zoro", "Roronoa Zoro (demo)", "rare",
                        "Carta demo (API OPTCG non raggiungibile)."));
    }
}
