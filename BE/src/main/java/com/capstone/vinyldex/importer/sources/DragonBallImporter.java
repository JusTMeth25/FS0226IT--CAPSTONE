package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Import di Dragon Ball Super CCG da tcgcsv.com, mirror pubblico dei dati TCGPlayer. */
@Component
public class DragonBallImporter extends AbstractCardImporter {

    private static final String SOURCE = "dragonball";
    private static final int CATEGORY_ID = 27;
    private static final int MAX_LIMIT = 200;

    /**
     * I set promozionali e oversize hanno spesso scansioni mancanti su TCGPlayer (~60% di immagini
     * 403 su "Oversized Cards"): si escludono dalla scelta casuale e restano i booster numerati.
     */
    private static final Pattern EXCLUDED_GROUPS =
            Pattern.compile("oversized|promotion|anniversary|pre-release", Pattern.CASE_INSENSITIVE);

    public DragonBallImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /**
     * tcgcsv.com non ha un endpoint "tutte le carte": prima si elencano i set (gruppi) della
     * categoria, poi se ne sceglie uno e se ne leggono le carte.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) throws InterruptedException {
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        JsonNode groupsBody = fetchJsonWithRetry("https://tcgcsv.com/tcgplayer/" + CATEGORY_ID + "/groups", 3);
        List<JsonNode> groups = elements(child(groupsBody, "results")).stream()
                .filter(g -> !booleanOf(g, "isSupplemental"))
                .filter(g -> !EXCLUDED_GROUPS.matcher(textOrEmpty(g, "name")).find())
                .toList();

        if (groups.isEmpty()) {
            throw new IllegalStateException("tcgcsv_no_groups");
        }

        JsonNode group = selectGroup(groups, request.groupId());
        int groupId = child(group, "groupId").intValue();
        String groupName = text(group, "name");

        JsonNode productsBody = fetchJsonWithRetry(
                "https://tcgcsv.com/tcgplayer/" + CATEGORY_ID + "/" + groupId + "/products", 3);

        // Booster box, display e starter deck stanno nello stesso gruppo delle singole carte:
        // si riconoscono perche' hanno Rarity uguale a "None" (valore letterale) e nessun Number.
        List<JsonNode> singles = elements(child(productsBody, "results")).stream()
                .filter(p -> {
                    String rarity = extendedField(p, "Rarity");
                    return rarity != null && !rarity.equals("None") && extendedField(p, "Number") != null;
                })
                .toList();

        Map<Integer, Double> priceMap = loadPrices(groupId);

        List<ImportedCard> cards = singles.stream()
                .limit(limit)
                .map(product -> normalize(product, groupName, priceMap))
                .toList();

        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.successWithSet(SOURCE, imported, groupName, singles.size());
    }

    private JsonNode selectGroup(List<JsonNode> groups, Integer requestedGroupId) {
        if (requestedGroupId != null) {
            return groups.stream()
                    .filter(g -> child(g, "groupId") != null && child(g, "groupId").intValue() == requestedGroupId)
                    .findFirst()
                    .orElse(groups.get(0));
        }
        return groups.get(random.nextInt(groups.size()));
    }

    /** I prezzi sono un arricchimento opzionale: se mancano si ricade sulla rarita' dichiarata. */
    private Map<Integer, Double> loadPrices(int groupId) {
        Map<Integer, Double> prices = new HashMap<>();
        try {
            JsonNode body = fetchJsonWithRetry(
                    "https://tcgcsv.com/tcgplayer/" + CATEGORY_ID + "/" + groupId + "/prices", 3);
            for (JsonNode entry : elements(child(body, "results"))) {
                Double value = decimal(entry, "marketPrice");
                if (value == null || value <= 0) value = decimal(entry, "midPrice");
                JsonNode productId = child(entry, "productId");
                if (value != null && value > 0 && productId != null) {
                    prices.put(productId.intValue(), value);
                }
            }
        } catch (Exception ex) {
            log.debug("Prezzi Dragon Ball non disponibili per il gruppo {}: {}", groupId, ex.getMessage());
        }
        return prices;
    }

    private ImportedCard normalize(JsonNode product, String setName, Map<Integer, Double> priceMap) {
        int productId = child(product, "productId").intValue();
        Double price = priceMap.get(productId);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("color", extendedField(product, "Color"));
        metadata.put("cardType", extendedField(product, "CardType"));
        metadata.put("power", extendedField(product, "Power"));
        metadata.put("energyCost", extendedField(product, "EnergyColor Cost"));
        metadata.put("marketPrice", price);

        String rarityByPrice = priceRarityMapper.rarityFromPrice(SOURCE, price);
        String externalId = String.valueOf(productId);

        return new ImportedCard(
                externalId,
                SOURCE + "-" + externalId,
                text(product, "name"),
                setName,
                null,
                extendedField(product, "Number"),
                rarityByPrice != null ? rarityByPrice : mapRarityFallback(extendedField(product, "Rarity")),
                upscaleImage(textOrEmpty(product, "imageUrl")),
                cleanDescription(extendedField(product, "Description")),
                metadata);
    }

    /** I dati descrittivi stanno in un array di coppie nome/valore, non in campi diretti. */
    private static String extendedField(JsonNode product, String name) {
        for (JsonNode field : elements(child(product, "extendedData"))) {
            if (name.equals(text(field, "name"))) {
                return text(field, "value");
            }
        }
        return null;
    }

    /**
     * tcgcsv.com restituisce di default la miniatura "_200w", visibilmente sgranata a schermo intero.
     * TCGPlayer serve anche "_400w" per lo stesso prodotto: 600w, 800w, 1000w e la versione senza
     * suffisso rispondono 403, quindi 400w e' la risoluzione massima realmente disponibile.
     */
    private static String upscaleImage(String url) {
        return url == null ? "" : url.replaceAll("(?i)_200w\\.jpg$", "_400w.jpg");
    }

    private static String cleanDescription(String raw) {
        if (raw == null) return null;
        String cleaned = raw.replaceAll("(?i)<br\\s*/?>", "\n").replace("\r\n", "\n").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static boolean booleanOf(JsonNode node, String field) {
        JsonNode value = child(node, field);
        return value != null && value.booleanValue();
    }

    /** Usato solo quando manca il prezzo: e' la rarita' dichiarata, non il valore reale. */
    private static String mapRarityFallback(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.contains("secret") || r.contains("special") || r.contains("god") || r.contains("concept")) return "legendary";
        if (r.contains("super")) return "epic";
        if (r.equals("rare")) return "rare";
        if (r.contains("uncommon")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-goku", "Son Goku (demo)", "legendary",
                        "Carta demo (TCGPlayer non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-vegeta", "Vegeta (demo)", "rare",
                        "Carta demo (TCGPlayer non raggiungibile)."));
    }
}
