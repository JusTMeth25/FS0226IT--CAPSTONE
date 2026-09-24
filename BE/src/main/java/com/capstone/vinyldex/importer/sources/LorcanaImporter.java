package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Import da lorcana-api.com. Questa fonte non espone prezzi: la rarita' resta quella dichiarata. */
@Component
public class LorcanaImporter extends AbstractCardImporter {

    private static final String SOURCE = "lorcana";
    private static final int MAX_LIMIT = 250;

    public LorcanaImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /** Endpoint unico con tutte le carte (~2500): si estrae qui un blocco casuale. */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        List<JsonNode> all = elements(fetchJson("https://api.lorcana-api.com/bulk/cards"));
        int start = randomStart(all.size(), limit);

        List<ImportedCard> cards = all.subList(start, Math.min(start + limit, all.size())).stream()
                .map(LorcanaImporter::normalize)
                .toList();

        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, null, all.size());
    }

    private static ImportedCard normalize(JsonNode card) {
        String externalId = text(card, "Unique_ID");

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("color", text(card, "Color"));
        metadata.put("type", text(card, "Type"));
        metadata.put("franchise", text(card, "Franchise"));
        // Dati per CardStatCalculator.
        metadata.put("cost", decimal(card, "Cost"));
        metadata.put("strength", decimal(card, "Strength"));
        metadata.put("willpower", decimal(card, "Willpower"));
        metadata.put("lore", decimal(card, "Lore"));
        metadata.put("tcgRarity", text(card, "Rarity"));

        String description = text(card, "Flavor_Text");
        if (description == null) description = text(card, "Body_Text");

        return new ImportedCard(
                externalId,
                SOURCE + "-" + externalId,
                text(card, "Name"),
                text(card, "Set_Name"),
                text(card, "Set_ID"),
                text(card, "Card_Num"),
                mapRarity(text(card, "Rarity")),
                textOrEmpty(card, "Image"),
                description,
                metadata);
    }

    private static String mapRarity(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.equals("enchanted") || r.equals("iconic") || r.equals("legendary")) return "legendary";
        if (r.equals("epic") || r.equals("super rare")) return "epic";
        if (r.equals("rare")) return "rare";
        if (r.equals("uncommon")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-mickey", "Mickey Mouse (demo)", "common",
                        "Carta demo (API Lorcana non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-elsa", "Elsa (demo)", "legendary",
                        "Carta demo (API Lorcana non raggiungibile)."));
    }
}
