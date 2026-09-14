package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Import da api.riftcodex.com. Questa fonte non espone prezzi: la rarita' resta quella dichiarata. */
@Component
public class RiftboundImporter extends AbstractCardImporter {

    private static final String SOURCE = "riftbound";
    private static final int MAX_LIMIT = 200;

    public RiftboundImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /**
     * L'API pagina lato server ma ignora il parametro limit: la dimensione pagina e' fissa e il
     * numero di pagine reali sta nel campo "pages". Si estrae una pagina fra quelle disponibili,
     * poi si taglia a limit per restare coerenti con le altre fonti.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) {
        int limit = request.limitOrDefault(100, MAX_LIMIT);

        JsonNode probe = fetchJson("https://api.riftcodex.com/cards?page=1");
        JsonNode totalNode = child(probe, "total");
        JsonNode pagesNode = child(probe, "pages");

        int total = totalNode == null ? 1000 : totalNode.intValue();
        int maxPage = pagesNode == null ? 1 : Math.max(1, pagesNode.intValue());
        int page = request.page() != null ? request.pageOrOne() : random.nextInt(maxPage) + 1;

        JsonNode body = page == 1 ? probe : fetchJson("https://api.riftcodex.com/cards?page=" + page);

        List<ImportedCard> cards = elements(child(body, "items")).stream()
                .limit(limit)
                .map(RiftboundImporter::normalize)
                .toList();

        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, page, total);
    }

    private static ImportedCard normalize(JsonNode card) {
        String externalId = text(card, "id");
        JsonNode classification = child(card, "classification");

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("type", text(classification, "type"));
        metadata.put("domain", elements(child(classification, "domain")).stream().map(JsonNode::asString).toList());

        // attributes ha una forma libera che cambia per tipo di carta: si copia cosi' com'e'.
        JsonNode attributes = child(card, "attributes");
        if (attributes != null && attributes.isObject()) {
            List<String> names = new ArrayList<>();
            attributes.propertyNames().forEach(names::add);
            names.forEach(name -> metadata.put(name, attributes.get(name).asString()));
        }

        JsonNode textNode = child(card, "text");
        String description = text(textNode, "plain");
        if (description == null) description = text(textNode, "flavour");

        JsonNode set = child(card, "set");

        return new ImportedCard(
                externalId,
                SOURCE + "-" + externalId,
                text(card, "name"),
                text(set, "label"),
                text(set, "set_id"),
                text(card, "collector_number"),
                mapRarity(text(classification, "rarity")),
                textOrEmpty(child(card, "media"), "image_url"),
                description,
                metadata);
    }

    private static String mapRarity(String raw) {
        String r = raw == null ? "" : raw.toLowerCase();
        if (r.equals("showcase") || r.equals("overnumbered")) return "legendary";
        if (r.equals("epic")) return "epic";
        if (r.equals("rare")) return "rare";
        if (r.equals("uncommon")) return "uncommon";
        return "common";
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-ahri", "Ahri (demo)", "legendary",
                        "Carta demo (API Riftcodex non raggiungibile)."),
                ImportedCard.demo(SOURCE, "demo-poro", "Poro (demo)", "common",
                        "Carta demo (API Riftcodex non raggiungibile)."));
    }
}
