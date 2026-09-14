package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Import da db.ygoprodeck.com. */
@Component
public class YugiohImporter extends AbstractCardImporter {

    private static final String SOURCE = "yugioh";
    private static final int MAX_LIMIT = 200;

    /** Dimensione approssimativa del database YGOPRODeck, usata per scegliere un offset casuale. */
    private static final int APPROX_TOTAL_CARDS = 14000;

    public YugiohImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /** Senza offset esplicito si parte da un punto casuale, cosi' ogni import porta carte diverse. */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        int limit = request.limitOrDefault(100, MAX_LIMIT);
        int offset = request.offset() != null && request.offset() >= 0
                ? request.offset()
                : random.nextInt(APPROX_TOTAL_CARDS);

        JsonNode body = fetchJson("https://db.ygoprodeck.com/api/v7/cardinfo.php?num=" + limit + "&offset=" + offset);

        List<ImportedCard> cards = elements(child(body, "data")).stream().map(this::normalize).toList();
        int imported = writer.persist(SOURCE, cards, null);

        JsonNode total = child(child(body, "meta"), "total_rows");
        return ImportResult.successWithOffset(SOURCE, imported, offset, total == null ? null : total.intValue());
    }

    private ImportedCard normalize(JsonNode card) {
        Double price = extractPrice(card);
        String id = text(card, "id");

        List<JsonNode> sets = elements(child(card, "card_sets"));
        JsonNode set = sets.isEmpty() ? null : sets.get(0);

        List<JsonNode> images = elements(child(card, "card_images"));
        String image = images.isEmpty() ? "" : textOrEmpty(images.get(0), "image_url");

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("type", text(card, "type"));
        metadata.put("atk", decimal(card, "atk"));
        metadata.put("def", decimal(card, "def"));
        metadata.put("marketPrice", price);

        String rarityByPrice = priceRarityMapper.rarityFromPrice(SOURCE, price);

        return new ImportedCard(
                id,
                SOURCE + "-" + id,
                text(card, "name"),
                text(set, "set_name"),
                text(set, "set_code"),
                null,
                rarityByPrice != null ? rarityByPrice : mapRarityFallback(text(set, "set_rarity")),
                image,
                text(card, "desc"),
                metadata);
    }

    /** Ripiega su Cardmarket quando manca il prezzo TCGPlayer, come per alcune stampe regionali. */
    private static Double extractPrice(JsonNode card) {
        List<JsonNode> prices = elements(child(card, "card_prices"));
        if (prices.isEmpty()) return null;

        JsonNode first = prices.get(0);
        Double tcgplayer = decimal(first, "tcgplayer_price");
        if (tcgplayer != null && tcgplayer > 0) return tcgplayer;
        Double cardmarket = decimal(first, "cardmarket_price");
        return cardmarket != null && cardmarket > 0 ? cardmarket : null;
    }

    /** Usato solo quando manca il prezzo: e' la rarita' dichiarata, non il valore reale. */
    private static String mapRarityFallback(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.contains("secret") || r.contains("ultimate") || r.contains("ghost")
                || r.contains("collector") || r.contains("starlight") || r.contains("quarter century")) {
            return "legendary";
        }
        if (r.contains("ultra")) return "epic";
        if (r.contains("super")) return "rare";
        if (r.contains("rare")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-dark-magician", "Dark Magician (demo)", "legendary",
                        "Carta demo (API YGOPRODeck non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-kuriboh", "Kuriboh (demo)", "common",
                        "Carta demo (API YGOPRODeck non raggiungibile)."));
    }
}
