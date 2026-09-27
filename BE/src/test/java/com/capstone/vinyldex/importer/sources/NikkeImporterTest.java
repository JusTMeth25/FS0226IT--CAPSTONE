package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.CardStatCalculator;
import com.capstone.vinyldex.importer.ImportedCard;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Carte GODDESS OF VICTORY: NIKKE (Union Arena) dal catalogo TCGplayer: normalizzazione, rarita', statistiche. */
class NikkeImporterTest {

    private final PriceRarityMapper mapper = new PriceRarityMapper();
    private final NikkeImporter importer = new NikkeImporter(mock(RestClient.class), mock(CardImportWriter.class), mapper);
    private final CardStatCalculator calculator = new CardStatCalculator(mapper);

    /** Sei prodotti veri del set UE14BT (una busta sigillata e cinque carte), con i loro prezzi. */
    private List<ImportedCard> sample() throws Exception {
        JsonNode root;
        try (InputStream in = getClass().getResourceAsStream("/nikke/sample.json")) {
            root = JsonMapper.builder().build().readTree(in);
        }
        Map<Integer, Double> prices = new HashMap<>();
        root.get("prices").forEach(p -> prices.merge(p.get("productId").asInt(), p.get("marketPrice").asDouble(), Math::max));
        List<ImportedCard> cards = new ArrayList<>();
        root.get("products").forEach(p -> {
            ImportedCard card = importer.normalize(p, prices, "GODDESS OF VICTORY: NIKKE", "UE14BT");
            if (card != null) cards.add(card);
        });
        return cards;
    }

    private static ImportedCard find(List<ImportedCard> cards, String name) {
        return cards.stream().filter(c -> c.name().equals(name)).findFirst().orElseThrow();
    }

    private CardStatCalculator.Stats stats(ImportedCard card) {
        return calculator.calculate(new CardStatCalculator.Input("nikke", card.code(), card.name(), card.setName(),
                card.rarity(), (Double) card.metadata().get("marketPrice"), card.metadata()));
    }

    @Test
    @DisplayName("Le buste sigillate si scartano; nome, variante, numero e immagine grande dalla scheda TCGplayer")
    void normalizes() throws Exception {
        List<ImportedCard> cards = sample();
        assertEquals(5, cards.size());
        ImportedCard crow = find(cards, "Crow (R*)");
        assertEquals("UE14BT/NIK-1-021", crow.number());
        assertEquals("nikke-663873", crow.code());
        assertEquals("https://tcgplayer-cdn.tcgplayer.com/product/663873_in_1000x1000.jpg", crow.imgUrl());
        assertEquals(1, crow.metadata().get("stars"));
        assertEquals("Character", crow.metadata().get("cardType"));
        assertTrue(crow.description().startsWith("[When Played]"));
        assertTrue(!crow.description().contains("<br>"));
        ImportedCard jackal = find(cards, "Jackal");
        assertEquals(2500, jackal.metadata().get("bp"), "2500+ letto come 2500");
        assertNull(jackal.metadata().get("variant"));
        assertEquals("Box Topper Foil", find(cards, "Rapi (Box Topper Foil)").metadata().get("variant"));
    }

    @Test
    @DisplayName("Rarita' dal prezzo di mercato: la Modernia a tre stelle e' leggendaria, la comune resta comune")
    void rarityFromPrice() throws Exception {
        List<ImportedCard> cards = sample();
        ImportedCard modernia = find(cards, "Modernia (SR***)");
        assertEquals(3, modernia.metadata().get("stars"));
        assertEquals("legendary", modernia.rarity());
        assertEquals("common", find(cards, "Jackal").rarity());
        assertEquals("legendary", NikkeImporter.rarityFallback("Super Rare 3-Star"));
        assertEquals("epic", NikkeImporter.rarityFallback("Super Rare 2-Star"));
        assertEquals("uncommon", NikkeImporter.rarityFallback("Rare"));
        assertEquals("GODDESS OF VICTORY: NIKKE Release Event Cards",
                NikkeImporter.setNameOf("UE14BT: GODDESS OF VICTORY: NIKKE Release Event Cards"));
    }

    @Test
    @DisplayName("Statistiche: la parallela a tre stelle batte la comune, la carta AP pesa meno di un personaggio")
    void stats() throws Exception {
        List<ImportedCard> cards = sample();
        CardStatCalculator.Stats modernia = stats(find(cards, "Modernia (SR***)"));
        CardStatCalculator.Stats jackal = stats(find(cards, "Jackal"));
        CardStatCalculator.Stats ap = stats(find(cards, "Action Point Card"));
        assertTrue(modernia.total() > jackal.total() + 40, modernia + " contro " + jackal);
        assertTrue(modernia.style() > jackal.style());
        assertTrue(ap.influence() < modernia.influence(), "la carta AP non e' un personaggio");
    }
}
