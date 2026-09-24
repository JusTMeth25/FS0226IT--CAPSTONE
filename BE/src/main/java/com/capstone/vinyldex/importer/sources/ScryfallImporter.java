package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Import di carte Magic da api.scryfall.com. */
@Component
public class ScryfallImporter extends AbstractCardImporter {

    private static final String SOURCE = "scryfall";

    /** Dimensione pagina di Scryfall. */
    private static final int MAX_PAGE_SIZE = 175;

    /** Query molto ampia: qualunque carta Magic reale dal 1993 a oggi. */
    private static final String DEFAULT_QUERY = "year>=1993";

    public ScryfallImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /**
     * Scryfall mette in cache le risposte per query piu' pagina, quindi e' variare la pagina
     * (non l'ordinamento) che da' risultati diversi a ogni click ripetuto dal pannello admin.
     *
     * Quante pagine esistano dipende dalla query, percio' la prima chiamata serve a leggere
     * total_cards e a ricavare il limite reale: chiedere una pagina oltre quel limite fa
     * rispondere 404 e l'import ricadrebbe sempre sulle carte demo.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        int limit = request.limitOrDefault(100, MAX_PAGE_SIZE);
        String query = request.query() == null || request.query().isBlank() ? DEFAULT_QUERY : request.query();
        String baseUrl = "https://api.scryfall.com/cards/search?q="
                + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&page=";

        JsonNode probe = fetchJson(baseUrl + "1");
        JsonNode totalNode = child(probe, "total_cards");
        Integer totalCards = totalNode == null ? null : totalNode.intValue();

        int maxPage = totalCards == null ? 1 : Math.max(1, (int) Math.ceil(totalCards / (double) MAX_PAGE_SIZE));
        int page = request.page() != null ? Math.min(request.pageOrOne(), maxPage) : random.nextInt(maxPage) + 1;

        JsonNode body = page == 1 ? probe : fetchJson(baseUrl + page);

        List<ImportedCard> cards = elements(child(body, "data")).stream()
                .limit(limit)
                .map(this::normalize)
                .toList();

        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, page, totalCards);
    }

    private ImportedCard normalize(JsonNode card) {
        Double price = extractPrice(card);
        String id = text(card, "id");

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("manaCost", text(card, "mana_cost"));
        metadata.put("typeLine", text(card, "type_line"));
        metadata.put("colors", elements(child(card, "colors")).stream().map(JsonNode::asString).toList());
        metadata.put("marketPrice", price);
        // Dati per CardStatCalculator.
        metadata.put("power", text(card, "power"));
        metadata.put("toughness", text(card, "toughness"));
        metadata.put("cmc", decimal(card, "cmc"));
        metadata.put("edhrecRank", decimal(card, "edhrec_rank"));
        metadata.put("tcgRarity", text(card, "rarity"));

        String rarityByPrice = priceRarityMapper.rarityFromPrice(SOURCE, price);
        String description = text(card, "oracle_text");
        if (description == null) description = text(card, "flavor_text");

        return new ImportedCard(
                id,
                SOURCE + "-" + id,
                text(card, "name"),
                text(card, "set_name"),
                text(card, "set"),
                text(card, "collector_number"),
                rarityByPrice != null ? rarityByPrice : mapRarityFallback(text(card, "rarity")),
                extractImage(card),
                description,
                metadata);
    }

    /** Le carte a doppia faccia non hanno image_uris in cima: l'immagine sta nella prima faccia. */
    private static String extractImage(JsonNode card) {
        String image = text(child(card, "image_uris"), "normal");
        if (image != null) return image;

        List<JsonNode> faces = elements(child(card, "card_faces"));
        if (faces.isEmpty()) return "";
        String faceImage = text(child(faces.get(0), "image_uris"), "normal");
        return faceImage == null ? "" : faceImage;
    }

    /** Alcune carte esistono solo in versione foil: usd e' null ma usd_foil e' valorizzato. */
    private static Double extractPrice(JsonNode card) {
        JsonNode prices = child(card, "prices");
        Double usd = decimal(prices, "usd");
        if (usd != null && usd > 0) return usd;
        Double foil = decimal(prices, "usd_foil");
        return foil != null && foil > 0 ? foil : null;
    }

    /** Usato solo quando manca il prezzo: e' la rarita' dichiarata, non il valore reale. */
    private static String mapRarityFallback(String raw) {
        if (raw == null) return "uncommon";
        return switch (raw) {
            case "mythic" -> "legendary";
            case "rare" -> "epic";
            case "uncommon" -> "rare";
            case "common" -> "common";
            default -> "uncommon";
        };
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-black-lotus", "Black Lotus (demo)", "legendary",
                        "Carta demo (API Scryfall non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-llanowar-elves", "Llanowar Elves (demo)", "common",
                        "Carta demo (API Scryfall non raggiungibile)."));
    }
}
