package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Import da api.pokemontcg.io. */
@Component
public class PokemonImporter extends AbstractCardImporter {

    private static final String SOURCE = "pokemon";

    /** Massimo consentito dall'API per pagina. */
    private static final int MAX_PAGE_SIZE = 250;

    /** Pagine disponibili, usate per estrarne una a caso quando il chiamante non ne indica una. */
    private static final int APPROX_PAGES = 80;

    private final String apiKey;

    public PokemonImporter(RestClient restClient,
                           CardImportWriter writer,
                           PriceRarityMapper priceRarityMapper,
                           @Value("${vinyldex.import.pokemon-api-key:}") String apiKey) {
        super(restClient, writer, priceRarityMapper);
        this.apiKey = apiKey;
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /**
     * Senza una pagina esplicita se ne estrae una a caso: cosi' click ripetuti dal pannello admin
     * importano carte diverse invece di riscrivere sempre le stesse.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        if (request.wantsAll()) return importAll();
        int limit = request.limitOrDefault(100, MAX_PAGE_SIZE);
        int page = request.page() != null ? request.pageOrOne() : random.nextInt(APPROX_PAGES) + 1;

        String url = "https://api.pokemontcg.io/v2/cards?pageSize=" + limit + "&page=" + page;
        JsonNode body = apiKey.isBlank() ? fetchJson(url) : fetchJson(url, "X-Api-Key", apiKey);

        List<ImportedCard> cards = elements(child(body, "data")).stream().map(this::normalize).toList();
        int imported = writer.persist(SOURCE, cards, null);

        JsonNode total = child(body, "totalCount");
        return ImportResult.success(SOURCE, imported, page, total == null ? null : total.intValue());
    }

    /**
     * Tutto il catalogo (oltre 20.000 carte): pagine da 250 salvate una alla volta, cosi' la memoria
     * resta bassa e le pagine gia' salvate restano anche se l'API smette di rispondere.
     */
    private ImportResult importAll() {
        int imported = 0;
        Integer total = null;
        int failures = 0;
        for (int page = 1; total == null || (page - 1) * MAX_PAGE_SIZE < total; page++) {
            String url = "https://api.pokemontcg.io/v2/cards?pageSize=" + MAX_PAGE_SIZE + "&page=" + page;
            JsonNode body;
            try {
                body = apiKey.isBlank() ? fetchJson(url) : fetchJson(url, "X-Api-Key", apiKey);
            } catch (RuntimeException ex) {
                // L'API risponde spesso 500 o va in timeout: si riprova la stessa pagina aspettando sempre di piu'.
                if (++failures > 8) break;
                try {
                    Thread.sleep(2000L * failures);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
                page--;
                continue;
            }
            failures = 0;
            List<ImportedCard> cards = elements(child(body, "data")).stream().map(this::normalize).toList();
            if (cards.isEmpty()) break;
            imported += writer.persist(SOURCE, cards, null);
            JsonNode count = child(body, "totalCount");
            if (count != null) total = count.intValue();
        }
        return ImportResult.success(SOURCE, imported, null, total);
    }

    private ImportedCard normalize(JsonNode card) {
        Double price = extractPrice(card);
        String id = text(card, "id");

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("types", elements(child(card, "types")).stream().map(JsonNode::asString).toList());
        metadata.put("hp", text(card, "hp"));
        metadata.put("artist", text(card, "artist"));
        metadata.put("marketPrice", price);
        // Dati per CardStatCalculator: sottotipi (ex, V, VMAX...), danno piu' alto e rarita' originale.
        metadata.put("subtypes", elements(child(card, "subtypes")).stream().map(JsonNode::asString).toList());
        metadata.put("maxDamage", maxDamage(card));
        metadata.put("tcgRarity", text(card, "rarity"));

        JsonNode images = child(card, "images");
        String image = text(images, "large");
        if (image == null) image = textOrEmpty(images, "small");

        JsonNode set = child(card, "set");

        return new ImportedCard(
                id,
                SOURCE + "-" + id,
                text(card, "name"),
                text(set, "name"),
                text(set, "id"),
                text(card, "number"),
                rarityOf(card, price),
                image,
                description(card),
                metadata);
    }

    private String rarityOf(JsonNode card, Double price) {
        String byPrice = priceRarityMapper.rarityFromPrice(SOURCE, price);
        return byPrice != null ? byPrice : mapRarityFallback(text(card, "rarity"));
    }

    /** Danno piu' alto fra gli attacchi: "120+" e "30x" valgono per il loro numero. */
    private static Integer maxDamage(JsonNode card) {
        int best = 0;
        for (JsonNode attack : elements(child(card, "attacks"))) {
            String damage = text(attack, "damage");
            if (damage == null) continue;
            String digits = damage.replaceAll("[^0-9]", "");
            if (!digits.isEmpty()) best = Math.max(best, Integer.parseInt(digits));
        }
        return best > 0 ? best : null;
    }

    private static String description(JsonNode card) {
        String flavor = text(card, "flavorText");
        if (flavor != null) return flavor;
        List<String> rules = elements(child(card, "rules")).stream().map(JsonNode::asString).toList();
        return rules.isEmpty() ? null : String.join(" ", rules);
    }

    /**
     * L'API espone il prezzo TCGPlayer per ogni variante di stampa (holofoil, reverse holofoil,
     * prima edizione...). Si prende la piu' alta: rappresenta il valore della versione piu' ricercata.
     */
    private static Double extractPrice(JsonNode card) {
        JsonNode prices = child(child(card, "tcgplayer"), "prices");
        if (prices == null) return null;

        double best = 0;
        List<String> variants = new ArrayList<>();
        prices.propertyNames().forEach(variants::add);
        for (String variant : variants) {
            JsonNode node = prices.get(variant);
            Double value = decimal(node, "market");
            if (value == null) value = decimal(node, "mid");
            if (value != null && value > best) best = value;
        }
        return best > 0 ? best : null;
    }

    /** Usato solo quando manca il prezzo: e' la rarita' dichiarata, non il valore reale. */
    private static String mapRarityFallback(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.contains("secret") || r.contains("rainbow") || r.contains("hyper") || r.contains("special")) return "legendary";
        if (r.contains("ultra") || r.contains("holo")) return "epic";
        if (r.contains("rare")) return "rare";
        if (r.contains("uncommon")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-pikachu", "Pikachu (demo)", "common",
                        "Carta demo (API Pokemon TCG non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-charizard", "Charizard (demo)", "legendary",
                        "Carta demo (API Pokemon TCG non raggiungibile)."));
    }
}
