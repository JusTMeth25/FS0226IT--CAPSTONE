package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Import da digimoncard.io.
 *
 * Quella fonte non espone un prezzo di mercato, ma include il tcgplayer_id di ogni carta.
 * I prezzi si prendono quindi da tcgcsv.com e si tengono in cache: ricostruire la mappa
 * richiede un centinaio di richieste, troppe da rifare a ogni import.
 */
@Component
public class DigimonImporter extends AbstractCardImporter {

    private static final String SOURCE = "digimon";

    /** Digimon Card Game su tcgcsv.com. */
    private static final int TCGCSV_CATEGORY_ID = 63;

    private static final Duration PRICE_CACHE_TTL = Duration.ofHours(6);
    private static final int MAX_LIMIT = 200;

    private final Map<Integer, Double> priceCache = new ConcurrentHashMap<>();
    private volatile Instant priceCacheFetchedAt = Instant.EPOCH;

    public DigimonImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /**
     * L'API non ha un endpoint paginato "tutte le carte": si legge l'intero pool della serie base
     * (~9000 righe, ma solo ~4300 id distinti, perche' la stessa carta compare piu' volte per
     * varianti TCGPlayer identiche), si deduplica e si estrae un blocco casuale. Deduplicare prima
     * di tagliare evita di sprecare il limite richiesto su doppioni.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) throws InterruptedException {
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        JsonNode body = fetchJson(
                "https://digimoncard.io/api-public/search.php?series=Digimon%20Card%20Game&sort=name&sortdirection=asc");

        Map<String, JsonNode> uniqueById = new LinkedHashMap<>();
        for (JsonNode card : elements(body)) {
            String id = text(card, "id");
            if (id != null) uniqueById.putIfAbsent(id, card);
        }

        List<JsonNode> all = new ArrayList<>(uniqueById.values());
        int start = randomStart(all.size(), limit);
        List<JsonNode> slice = all.subList(start, Math.min(start + limit, all.size()));

        Map<Integer, Double> prices = getPriceMap();
        List<ImportedCard> cards = slice.stream().map(card -> normalize(card, prices)).toList();

        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, null, all.size());
    }

    private ImportedCard normalize(JsonNode card, Map<Integer, Double> prices) {
        String id = text(card, "id");

        JsonNode tcgplayerId = child(card, "tcgplayer_id");
        Double price = tcgplayerId == null ? null : prices.get(tcgplayerId.intValue());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("color", text(card, "color"));
        metadata.put("type", text(card, "type"));
        metadata.put("dp", text(card, "dp"));
        metadata.put("playCost", text(card, "play_cost"));
        metadata.put("marketPrice", price);

        String description = text(card, "main_effect");
        if (description == null) description = text(card, "source_effect");

        String rarityByPrice = priceRarityMapper.rarityFromPrice(SOURCE, price);

        return new ImportedCard(
                id,
                SOURCE + "-" + id,
                text(card, "name"),
                setNameOf(card),
                id != null && id.contains("-") ? id.substring(0, id.indexOf('-')) : null,
                id,
                rarityByPrice != null ? rarityByPrice : mapRarityFallback(text(card, "rarity")),
                "https://images.digimoncard.io/images/cards/" + id + ".jpg",
                description,
                metadata);
    }

    /** set_name puo' arrivare come stringa o come array: in quel caso vale il primo elemento. */
    private static String setNameOf(JsonNode card) {
        JsonNode setName = child(card, "set_name");
        if (setName == null || setName.isNull()) return null;
        if (setName.isArray()) {
            List<JsonNode> values = elements(setName);
            return values.isEmpty() ? null : values.get(0).asString();
        }
        return setName.asString();
    }

    /** Mappa productId verso prezzo, ricostruita solo quando la cache e' scaduta. */
    private synchronized Map<Integer, Double> getPriceMap() throws InterruptedException {
        boolean stale = priceCache.isEmpty()
                || Duration.between(priceCacheFetchedAt, Instant.now()).compareTo(PRICE_CACHE_TTL) > 0;

        if (stale) {
            try {
                Map<Integer, Double> fresh = buildPriceMap();
                priceCache.clear();
                priceCache.putAll(fresh);
            } catch (InterruptedException ex) {
                throw ex;
            } catch (Exception ex) {
                // tcgcsv non raggiungibile: si ricade sulla rarita' dichiarata, l'import non si ferma.
                log.debug("Prezzi Digimon non disponibili: {}", ex.getMessage());
            }
            priceCacheFetchedAt = Instant.now();
        }

        return priceCache;
    }

    private Map<Integer, Double> buildPriceMap() throws InterruptedException {
        Map<Integer, Double> prices = new HashMap<>();

        JsonNode groupsBody = fetchJsonWithRetry("https://tcgcsv.com/tcgplayer/" + TCGCSV_CATEGORY_ID + "/groups", 3);
        List<JsonNode> groups = elements(child(groupsBody, "results")).stream()
                .filter(g -> {
                    JsonNode supplemental = child(g, "isSupplemental");
                    return supplemental == null || !supplemental.booleanValue();
                })
                .toList();

        for (JsonNode group : groups) {
            JsonNode groupId = child(group, "groupId");
            if (groupId == null) continue;
            try {
                JsonNode body = fetchJsonWithRetry(
                        "https://tcgcsv.com/tcgplayer/" + TCGCSV_CATEGORY_ID + "/" + groupId.intValue() + "/prices", 2);
                for (JsonNode entry : elements(child(body, "results"))) {
                    Double value = decimal(entry, "marketPrice");
                    if (value == null || value <= 0) value = decimal(entry, "midPrice");
                    JsonNode productId = child(entry, "productId");
                    if (value != null && value > 0 && productId != null) {
                        prices.put(productId.intValue(), value);
                    }
                }
            } catch (InterruptedException ex) {
                throw ex;
            } catch (Exception ex) {
                // Un gruppo mancante non blocca gli altri: i prezzi sono un arricchimento opzionale.
                log.debug("Gruppo prezzi Digimon {} non letto: {}", groupId, ex.getMessage());
            }
        }

        return prices;
    }

    /** Usato solo quando manca il prezzo: e' la rarita' dichiarata, non il valore reale. */
    private static String mapRarityFallback(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.equals("sec") || r.equals("ur")) return "legendary";
        if (r.equals("sr")) return "epic";
        if (r.equals("r")) return "rare";
        if (r.equals("u")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-agumon", "Agumon (demo)", "common",
                        "Carta demo (API DigimonCard.io non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-omnimon", "Omnimon (demo)", "legendary",
                        "Carta demo (API DigimonCard.io non raggiungibile)."));
    }
}
