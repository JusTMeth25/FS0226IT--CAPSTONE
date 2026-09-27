package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Base degli import dal catalogo TCGplayer, letto dalla copia pubblica e giornaliera di
 * tcgcsv.com: carte, immagini grandi, dati di gioco e prezzi di mercato, senza chiavi.
 *
 * Ogni gioco dice solo cosa gli serve (Spec): la categoria TCGplayer, quali gruppi (set)
 * prendere, dove stanno potenza e costo delle carte e quali tipi di carta sono i "capi"
 * (leggende, oshi, leader, campioni). Tutto il resto e' uguale per tutti:
 * - si scartano i prodotti sigillati (box, buste, mazzi: niente numero ne' rarita');
 * - la rarita' VinylDex viene dal prezzo (PriceRarityMapper), o dalla rarita' del gioco se manca;
 * - nei metadati finiscono potenza e costo gia' riportati da 0 a 1 (powerPct, costPct), il
 *   valore della stampa (printScore, dalle rarita' speciali: secret, serial, parallele...) e il
 *   capo (leader): da li' CardStatCalculator ricava le statistiche di battaglia.
 *
 * I cataloghi sono grandi (migliaia di carte): a ogni import si leggono i gruppi in ordine
 * casuale finche' ci sono abbastanza carte, e se ne salva un blocco a caso.
 */
public abstract class TcgcsvImporter extends AbstractCardImporter {

    private static final int MAX_LIMIT = 300;

    /** Un numero della carta, riportato da 0 a 1 dividendo per scale. */
    protected record Stat(String field, double scale) {
    }

    /**
     * @param groups      gruppi da prendere (null = tutti)
     * @param power       campi della forza della carta (vale il piu' alto)
     * @param cost        campi del costo o livello (vale il piu' alto)
     * @param leaderTypes tipi di carta che guidano il mazzo (piu' influenza)
     * @param rights      titolari dei diritti, per la descrizione delle carte demo
     */
    protected record Spec(String source, String title, int categoryId, Pattern groups, List<Stat> power, List<Stat> cost,
                          Pattern leaderTypes, String rights) {
    }

    private static final Pattern TOP = Pattern.compile(
            "(?i).*(secret|serial|iconic|ultimate|super special|special rare|anniversary|precious|signature|3-star"
                    + "|collector ultra|over-?frame|visual|\\((sp|sec|ssp|msp|lsp|ur|sir|sp rare)\\)).*");
    private static final Pattern HIGH = Pattern.compile(
            "(?i).*(super legendary|super rare|2-star|triple rare|double rare|ultra rare|collector|parallel|premium|nova|oshi"
                    + "|frame|legend|\\b(lrp|srp|lr|sr|rrr|lsr|skr|ffr|frr?|sp)\\b).*");
    private static final Pattern MID = Pattern.compile(
            "(?i).*(rare|1-star|promo|holo|gold|foil|special|\\b(rr|r|l|re|pi)\\b).*");
    private static final Pattern NUMBER = Pattern.compile("-?\\d+(\\.\\d+)?");

    protected TcgcsvImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    protected abstract Spec spec();

    @Override
    public String source() {
        return spec().source();
    }

    private String base() {
        return "https://tcgcsv.com/tcgplayer/" + spec().categoryId();
    }

    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) throws InterruptedException {
        Spec spec = spec();
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        List<JsonNode> groups = new ArrayList<>();
        for (JsonNode group : elements(child(fetchJsonWithRetry(base() + "/groups", 4), "results"))) {
            String name = text(group, "name");
            if (name != null && child(group, "groupId") != null && (spec.groups() == null || spec.groups().matcher(name).find())) {
                groups.add(group);
            }
        }
        if (groups.isEmpty()) throw new IllegalStateException(spec.source() + "_no_groups");
        Collections.shuffle(groups, random);

        // Gruppi a caso finche' ci sono tre volte le carte richieste: basta per un blocco vario.
        List<ImportedCard> all = new ArrayList<>();
        for (JsonNode group : groups) {
            if (all.size() >= limit * 3) break;
            int groupId = child(group, "groupId").intValue();
            JsonNode products;
            try {
                products = fetchJsonWithRetry(base() + "/" + groupId + "/products", 4);
            } catch (RuntimeException ex) {
                log.debug("Gruppo {} di {} non letto: {}", groupId, spec.source(), ex.getMessage());
                continue;
            }
            Map<Integer, Double> prices = prices(groupId);
            for (JsonNode product : elements(child(products, "results"))) {
                ImportedCard card = normalize(product, prices, text(group, "name"), text(group, "abbreviation"));
                if (card != null) all.add(card);
            }
        }
        if (all.isEmpty()) throw new IllegalStateException(spec.source() + "_no_cards");

        Collections.shuffle(all, random);
        List<ImportedCard> slice = all.subList(0, Math.min(limit, all.size()));
        int imported = writer.persist(spec.source(), slice, null);
        return ImportResult.success(spec.source(), imported, null, all.size());
    }

    /** Prezzo di mercato per prodotto (il piu' alto fra normale e foil). Senza prezzi l'import va avanti. */
    private Map<Integer, Double> prices(int groupId) throws InterruptedException {
        Map<Integer, Double> prices = new HashMap<>();
        try {
            for (JsonNode entry : elements(child(fetchJsonWithRetry(base() + "/" + groupId + "/prices", 4), "results"))) {
                Double value = decimal(entry, "marketPrice");
                if (value == null || value <= 0) value = decimal(entry, "midPrice");
                JsonNode productId = child(entry, "productId");
                if (value != null && value > 0 && productId != null) prices.merge(productId.intValue(), value, Math::max);
            }
        } catch (RuntimeException ex) {
            log.debug("Prezzi del gruppo {} di {} non letti: {}", groupId, spec().source(), ex.getMessage());
        }
        return prices;
    }

    /** Prodotto TCGplayer -> carta; null per i prodotti sigillati (niente numero ne' rarita'). */
    ImportedCard normalize(JsonNode product, Map<Integer, Double> prices, String groupName, String groupCode) {
        Spec spec = spec();
        Map<String, String> data = new HashMap<>();
        for (JsonNode entry : elements(child(product, "extendedData"))) {
            String key = text(entry, "name");
            if (key != null) data.put(key, text(entry, "value"));
        }
        JsonNode productId = child(product, "productId");
        String name = text(product, "name");
        if (productId == null || name == null || (data.get("Number") == null && data.get("Rarity") == null)) return null;
        int id = productId.intValue();

        String tcgRarity = data.get("Rarity");
        String cardType = data.get("CardType");
        Double price = prices.get(id);
        double print = printScore(tcgRarity, name);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("tcgplayerId", id);
        metadata.put("marketPrice", price);
        metadata.put("tcgRarity", tcgRarity);
        metadata.put("cardType", cardType);
        metadata.put("printScore", print);
        metadata.put("powerPct", scaled(data, spec.power()));
        metadata.put("costPct", scaled(data, spec.cost()));
        metadata.put("leader", cardType != null && spec.leaderTypes() != null && spec.leaderTypes().matcher(cardType).find());
        metadata.put("series", data.get("SeriesName"));
        metadata.put("url", text(product, "url"));
        spec.power().forEach(s -> metadata.put(s.field(), number(data.get(s.field()))));
        spec.cost().forEach(s -> metadata.put(s.field(), number(data.get(s.field()))));

        String rarity = priceRarityMapper.rarityFromPrice(spec.source(), price);
        String description = data.get("Description");
        if (description == null) description = data.get("CardText");
        return new ImportedCard(
                String.valueOf(id),
                spec.source() + "-" + id,
                name,
                groupName,
                groupCode,
                data.get("Number"),
                rarity != null ? rarity : rarityFallback(tcgRarity, print),
                "https://tcgplayer-cdn.tcgplayer.com/product/" + id + "_in_1000x1000.jpg",
                cleanText(description),
                metadata);
    }

    /** Quanto e' speciale la stampa, dalla rarita' del gioco e dalla sigla nel nome: da 0.3 a 1. */
    static double printScore(String tcgRarity, String name) {
        String text = (tcgRarity == null ? "" : tcgRarity) + " " + (name == null ? "" : name);
        if (TOP.matcher(text).matches()) return 1.0;
        if (HIGH.matcher(text).matches()) return 0.8;
        if (MID.matcher(text).matches()) return 0.55;
        return 0.3;
    }

    /** Solo senza prezzo: la rarita' dal valore della stampa. */
    static String rarityFallback(String tcgRarity, double print) {
        if (print >= 1.0) return "legendary";
        if (print >= 0.8) return "epic";
        if (print >= 0.55) return "rare";
        String r = tcgRarity == null ? "" : tcgRarity.toLowerCase(Locale.ROOT);
        return r.contains("uncommon") || r.equals("u") || r.equals("silver") || r.equals("lc") ? "uncommon" : "common";
    }

    /** Il piu' alto fra i campi, ciascuno diviso per la sua scala e tenuto fra 0 e 1; null se mancano tutti. */
    private static Double scaled(Map<String, String> data, List<Stat> stats) {
        Double best = null;
        for (Stat stat : stats) {
            Double value = number(data.get(stat.field()));
            if (value == null) continue;
            double pct = Math.max(0, Math.min(1, value / stat.scale()));
            best = best == null ? pct : Math.max(best, pct);
        }
        return best;
    }

    /** "2500+" -> 2500, "Debut" -> null. */
    private static Double number(String value) {
        if (value == null) return null;
        var m = NUMBER.matcher(value);
        return m.find() ? Double.parseDouble(m.group()) : null;
    }

    private static String cleanText(String value) {
        if (value == null) return null;
        String cleaned = value.replaceAll("(?i)<br\\s*/?>", "\n").replaceAll("<[^>]+>", "").replace("\r", "")
                .replaceAll("\n{2,}", "\n").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    @Override
    public List<ImportedCard> demoCards() {
        Spec spec = spec();
        String note = "Carta demo (catalogo " + spec.title() + " su tcgcsv.com non raggiungibile). " + spec.rights();
        return List.of(
                ImportedCard.demo(spec.source(), "demo-1", spec.title() + " (demo)", "rare", note),
                ImportedCard.demo(spec.source(), "demo-2", spec.title() + " leggendaria (demo)", "legendary", note));
    }
}
