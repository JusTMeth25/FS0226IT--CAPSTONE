package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Import delle carte GODDESS OF VICTORY: NIKKE del gioco di carte Union Arena (Bandai).
 *
 * Non esiste un'API dedicata: le carte, con immagini, dati di gioco e prezzi di mercato, si
 * leggono da tcgcsv.com, la copia pubblica e giornaliera del catalogo TCGplayer (categoria
 * Union Arena). Si prendono i gruppi con NIKKE nel nome (il set base UE14BT, le carte evento,
 * il Precious Booster quando esce) e si scartano i prodotti sigillati (box e buste: niente numero).
 *
 * Una stessa carta ha piu' stampe: la normale, la foil dei box topper e le parallele con le
 * stelle (U*, SR**, SR***). Ogni stampa e' un prodotto con il suo prezzo, e resta una carta a
 * se', come le varianti delle altre fonti.
 */
@Component
public class NikkeImporter extends AbstractCardImporter {

    static final String SOURCE = "nikke";

    /** Union Arena su tcgcsv.com. */
    private static final int TCGCSV_CATEGORY_ID = 81;
    private static final String BASE = "https://tcgcsv.com/tcgplayer/" + TCGCSV_CATEGORY_ID;
    private static final int MAX_LIMIT = 300;

    /** "Rapi (009) (Box Topper Foil)" -> nome "Rapi", numero "009", variante "Box Topper Foil". */
    private static final Pattern PARENS = Pattern.compile("\\s*\\(([^)]*)\\)");

    public NikkeImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) throws InterruptedException {
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        JsonNode groupsBody = fetchJsonWithRetry(BASE + "/groups", 3);
        List<ImportedCard> all = new ArrayList<>();
        for (JsonNode group : elements(child(groupsBody, "results"))) {
            String groupName = text(group, "name");
            JsonNode groupId = child(group, "groupId");
            if (groupId == null || groupName == null || !groupName.toUpperCase(Locale.ROOT).contains("NIKKE")) continue;
            JsonNode products = fetchJsonWithRetry(BASE + "/" + groupId.intValue() + "/products", 3);
            Map<Integer, Double> prices = prices(groupId.intValue());
            List<JsonNode> list = elements(child(products, "results"));
            Map<Integer, String> images = TcgplayerImages.forGroup(list);
            for (JsonNode product : list) {
                ImportedCard card = normalize(product, prices, setNameOf(groupName), text(group, "abbreviation"), images);
                if (card != null) all.add(card);
            }
        }
        if (all.isEmpty()) throw new IllegalStateException("nikke_no_cards");

        int start = all.size() <= limit ? 0 : randomStart(all.size(), limit);
        List<ImportedCard> slice = all.subList(start, Math.min(start + limit, all.size()));
        int imported = writer.persist(SOURCE, slice, null);
        return ImportResult.success(SOURCE, imported, null, all.size());
    }

    /** Prezzo di mercato per prodotto (il piu' alto fra normale e foil). Senza prezzi l'import va avanti. */
    private Map<Integer, Double> prices(int groupId) {
        Map<Integer, Double> prices = new HashMap<>();
        try {
            JsonNode body = fetchJsonWithRetry(BASE + "/" + groupId + "/prices", 3);
            for (JsonNode entry : elements(child(body, "results"))) {
                Double value = decimal(entry, "marketPrice");
                if (value == null || value <= 0) value = decimal(entry, "midPrice");
                JsonNode productId = child(entry, "productId");
                if (value != null && value > 0 && productId != null) prices.merge(productId.intValue(), value, Math::max);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (Exception ex) {
            log.debug("Prezzi NIKKE del gruppo {} non letti: {}", groupId, ex.getMessage());
        }
        return prices;
    }

    /** "UE14BT: GODDESS OF VICTORY: NIKKE Release Event Cards" -> senza il codice davanti. */
    static String setNameOf(String groupName) {
        int colon = groupName.indexOf(": ");
        return colon > 0 && colon < 10 ? groupName.substring(colon + 2) : groupName;
    }

    /**
     * Prodotto TCGplayer -> carta. Null per i prodotti sigillati (box, buste), che non hanno il
     * numero di collezione.
     */
    ImportedCard normalize(JsonNode product, Map<Integer, Double> prices, String setName, String setCode) {
        return normalize(product, prices, setName, setCode, Map.of());
    }

    /** @param images immagine di ogni prodotto del gruppo (TcgplayerImages.forGroup); se manca si usa la sua. */
    ImportedCard normalize(JsonNode product, Map<Integer, Double> prices, String setName, String setCode,
                           Map<Integer, String> images) {
        Map<String, String> data = new HashMap<>();
        for (JsonNode entry : elements(child(product, "extendedData"))) {
            String key = text(entry, "name");
            if (key != null) data.put(key, text(entry, "value"));
        }
        String number = data.get("Number");
        JsonNode productId = child(product, "productId");
        if (number == null || productId == null) return null;

        String rawName = textOrEmpty(product, "name");
        Matcher parens = PARENS.matcher(rawName);
        List<String> tags = new ArrayList<>();
        while (parens.find()) tags.add(parens.group(1).trim());
        String name = PARENS.matcher(rawName).replaceAll("").trim();
        // Il primo tra parentesi e' il numero della carta (021, AP01): il resto e' la variante.
        String variant = tags.stream().filter(t -> !t.matches("[A-Z]{0,2}\\d{2,3}")).reduce((a, b) -> a + " " + b).orElse(null);
        String tcgRarity = data.get("Rarity");
        Double price = prices.get(productId.intValue());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("tcgplayerId", productId.intValue());
        metadata.put("marketPrice", price);
        metadata.put("tcgRarity", tcgRarity);
        metadata.put("variant", variant);
        metadata.put("stars", stars(tcgRarity, variant));
        metadata.put("cardType", data.get("CardType"));
        metadata.put("affinities", data.get("Affinities"));
        metadata.put("energy", data.get("ActivationEnergy"));
        metadata.put("requiredEnergy", integer(data.get("RequiredEnergy")));
        metadata.put("apCost", integer(data.get("ActionPointCost")));
        metadata.put("bp", integer(data.get("BattlePointBP")));
        metadata.put("trigger", cleanText(data.get("Trigger")));
        metadata.put("url", text(product, "url"));

        String rarity = priceRarityMapper.rarityFromPrice(SOURCE, price);
        String image = images.getOrDefault(productId.intValue(),
                TcgplayerImages.hasImage(product) ? TcgplayerImages.url(productId.intValue()) : "");
        return new ImportedCard(
                String.valueOf(productId.intValue()),
                SOURCE + "-" + productId.intValue(),
                variant == null ? name : name + " (" + variant + ")",
                setName,
                setCode,
                number,
                rarity != null ? rarity : rarityFallback(tcgRarity),
                image,
                cleanText(data.get("Description")),
                metadata);
    }

    /** Stelle della stampa parallela: dalla rarita' ("Super Rare 2-Star") o dalla sigla ("SR**"). */
    static int stars(String tcgRarity, String variant) {
        Matcher m = Pattern.compile("(\\d)-Star").matcher(tcgRarity == null ? "" : tcgRarity);
        if (m.find()) return Integer.parseInt(m.group(1));
        if (variant == null) return 0;
        return (int) variant.chars().filter(c -> c == '*').count();
    }

    /** Solo senza prezzo: la rarita' Union Arena, le parallele con piu' stelle sopra a tutte. */
    static String rarityFallback(String raw) {
        String r = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (r.contains("3-star")) return "legendary";
        if (r.contains("2-star")) return "epic";
        if (r.contains("1-star") || r.contains("action point") || r.startsWith("super rare")) return "rare";
        if (r.startsWith("rare")) return "uncommon";
        return "common";
    }

    /** "2500+" -> 2500; "-" o vuoto -> null. */
    private static Integer integer(String value) {
        if (value == null) return null;
        String digits = value.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? null : Integer.parseInt(digits);
    }

    private static String cleanText(String value) {
        if (value == null) return null;
        String cleaned = value.replaceAll("(?i)<br\\s*/?>", "").replace("\r", "").replaceAll("\n{2,}", "\n").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-rapi", "Rapi (demo)", "rare",
                        "Carta demo (catalogo Union Arena su tcgcsv.com non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-modernia", "Modernia (demo)", "legendary",
                        "Carta demo (catalogo Union Arena su tcgcsv.com non raggiungibile)."));
    }
}
