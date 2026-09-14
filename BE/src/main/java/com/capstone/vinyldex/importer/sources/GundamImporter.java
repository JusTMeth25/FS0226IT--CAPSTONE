package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Import da apitcg.com.
 *
 * Questa fonte richiede una API key personale (registrazione gratuita su apitcg.com/platform, ma
 * non ottenibile in automatico). Senza APITCG_API_KEY si passa direttamente alle carte demo,
 * stesso comportamento delle altre fonti quando l'API non risponde.
 */
@Component
public class GundamImporter extends AbstractCardImporter {

    private static final String SOURCE = "gundam";
    private static final int MAX_LIMIT = 100;

    private final String apiKey;

    public GundamImporter(RestClient restClient,
                          CardImportWriter writer,
                          PriceRarityMapper priceRarityMapper,
                          @Value("${vinyldex.import.apitcg-api-key:}") String apiKey) {
        super(restClient, writer, priceRarityMapper);
        this.apiKey = apiKey;
    }

    @Override
    public String source() {
        return SOURCE;
    }

    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("apitcg_no_api_key");
        }

        int limit = request.limitOrDefault(100, MAX_LIMIT);

        // La prima chiamata serve anche a sapere quante pagine esistono davvero.
        JsonNode probe = fetchJson("https://apitcg.com/api/gundam/cards?limit=" + limit + "&page=1", "x-api-key", apiKey);
        JsonNode totalPages = child(probe, "totalPages");
        int maxPage = totalPages == null ? 1 : Math.max(1, totalPages.intValue());
        int page = request.page() != null ? request.pageOrOne() : random.nextInt(maxPage) + 1;

        JsonNode body = page == 1
                ? probe
                : fetchJson("https://apitcg.com/api/gundam/cards?limit=" + limit + "&page=" + page, "x-api-key", apiKey);

        JsonNode items = child(body, "data");
        if (items == null) items = child(body, "cards");

        List<ImportedCard> cards = elements(items).stream().map(GundamImporter::normalize).toList();
        int imported = writer.persist(SOURCE, cards, null);

        JsonNode total = child(body, "total");
        return ImportResult.success(SOURCE, imported, page, total == null ? null : total.intValue());
    }

    private static ImportedCard normalize(JsonNode card) {
        String externalId = text(card, "id");
        if (externalId == null) externalId = text(card, "code");

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("color", blank(text(card, "color")));
        metadata.put("cardType", blank(text(card, "cardType")));
        metadata.put("ap", blank(text(card, "ap")));
        metadata.put("hp", blank(text(card, "hp")));

        JsonNode images = child(card, "images");
        String image = text(images, "large");
        if (image == null) image = textOrEmpty(images, "small");

        JsonNode set = child(card, "set");

        return new ImportedCard(
                externalId,
                SOURCE + "-" + externalId,
                text(card, "name"),
                text(set, "name"),
                text(set, "id"),
                text(card, "code"),
                mapRarity(text(card, "rarity")),
                image,
                cleanEffect(text(card, "effect")),
                metadata);
    }

    /**
     * L'API usa codici brevi, con spazi e suffissi "+" per le varianti foil (es. "LR   +"):
     * LR = Legend Rare (il livello piu' alto), P = promo, R, U, C.
     */
    private static String mapRarity(String raw) {
        String r = raw == null ? "" : raw.trim().toUpperCase();
        if (r.startsWith("LR")) return "legendary";
        if (r.startsWith("P")) return "epic";
        if (r.startsWith("R")) return "rare";
        if (r.startsWith("U")) return "uncommon";
        return "common";
    }

    /** L'API usa "-" per indicare un campo vuoto. */
    private static String blank(String value) {
        return value == null || value.equals("-") ? null : value;
    }

    private static String cleanEffect(String effect) {
        if (effect == null) return null;
        String cleaned = effect.replaceAll("(?i)<br\\s*/?>", "\n").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-rx78", "RX-78-2 Gundam (demo)", "legendary",
                        "Carta demo (API TCG Gundam non configurata o non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-zaku", "Zaku II (demo)", "common",
                        "Carta demo (API TCG Gundam non configurata o non raggiungibile)."));
    }
}
