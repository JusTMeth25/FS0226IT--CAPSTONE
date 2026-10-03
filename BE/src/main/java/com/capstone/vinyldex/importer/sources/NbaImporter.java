package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Carte NBA: un elenco curato (resources/nba/cards.json) delle carte da collezione piu' famose,
 * dalle rookie card storiche (Fleer 1986 di Jordan, Topps Chrome di LeBron e Kobe, l'Exquisite)
 * agli inserti di oggi (Donruss Optic Downtown, Crown Royale Kaboom!, Prizm) con le loro parallele
 * (Silver, Holo, Gold numerata /10, Black 1/1).
 *
 * Non esiste un'API pubblica di carte sportive con immagini e prezzi: i dati sono scritti a mano
 * e i prezzi sono stime VinylDex della carta non gradata, ispirate al mercato. La carta la disegna
 * il server (NbaCardArtController) con la foto ufficiale del giocatore (cdn.nba.com).
 */
@Component
public class NbaImporter extends AbstractCardImporter {

    public static final String SOURCE = "nba";
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    public NbaImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    public String source() {
        return SOURCE;
    }

    /** L'elenco e' piccolo: ogni import lo salva tutto (le carte gia' presenti si aggiornano). */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) throws IOException {
        List<ImportedCard> cards = curatedCards();
        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, null, cards.size());
    }

    public List<ImportedCard> curatedCards() throws IOException {
        try (InputStream in = new ClassPathResource("nba/cards.json").getInputStream()) {
            List<ImportedCard> cards = new ArrayList<>();
            for (JsonNode node : elements(MAPPER.readTree(in))) cards.add(toCard(node));
            return cards;
        }
    }

    private ImportedCard toCard(JsonNode node) {
        String id = text(node, "id");
        Double price = decimal(node, "price");
        Map<String, Object> metadata = new HashMap<>();
        for (String key : List.of("player", "team", "position", "year", "brand", "insert", "parallel", "number")) {
            metadata.put(key, text(node, key));
        }
        metadata.put("ovr", decimal(node, "ovr") == null ? null : decimal(node, "ovr").intValue());
        metadata.put("jersey", decimal(node, "jersey") == null ? null : decimal(node, "jersey").intValue());
        // Carte Action: la foto in azione da Wikimedia Commons, con autore e licenza (NbaActionArt).
        if (node.has("actionPhoto") && node.get("actionPhoto").isObject()) {
            metadata.put("actionPhoto", MAPPER.convertValue(node.get("actionPhoto"), Map.class));
        }
        metadata.put("serial", decimal(node, "serial") == null ? null : decimal(node, "serial").intValue());
        metadata.put("rookie", node.has("rookie") && node.get("rookie").asBoolean());
        metadata.put("legend", node.has("legend") && node.get("legend").asBoolean());
        metadata.put("marketPrice", price);
        metadata.put("priceSource", "stima");
        Double nbaId = decimal(node, "nbaId");
        if (nbaId != null) {
            metadata.put("nbaId", nbaId.intValue());
            metadata.put("photoUrl", "https://cdn.nba.com/headshots/nba/latest/1040x760/" + nbaId.intValue() + ".png");
        }
        String rarity = priceRarityMapper.rarityFromPrice(SOURCE, price);
        String player = text(node, "player");
        String description = String.join(" · ", List.of(
                textOrEmpty(node, "year") + " " + textOrEmpty(node, "brand") + " " + textOrEmpty(node, "insert"),
                textOrEmpty(node, "team"),
                Boolean.TRUE.equals(metadata.get("rookie")) ? "Rookie card" : "Inserto",
                "prezzo stimato"));
        return new ImportedCard(
                id,
                SOURCE + "-" + id,
                text(node, "name") == null ? player : text(node, "name"),
                text(node, "set"),
                textOrEmpty(node, "year"),
                text(node, "number"),
                rarity != null ? rarity : "rare",
                // Nessuna immagine esterna: la carta la disegna il server (NbaCardArtController).
                "",
                description,
                metadata);
    }

    @Override
    public List<ImportedCard> demoCards() {
        try {
            return curatedCards();
        } catch (IOException ex) {
            return List.of();
        }
    }
}
