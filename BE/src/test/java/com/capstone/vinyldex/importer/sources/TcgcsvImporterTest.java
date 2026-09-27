package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.CardImporter;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Giochi dal catalogo TCGplayer (Cyberpunk, hololive e gli altri): normalizzazione, rarita', statistiche. */
class TcgcsvImporterTest {

    private final PriceRarityMapper mapper = new PriceRarityMapper();
    private final CardStatCalculator calculator = new CardStatCalculator(mapper);
    private final RestClient rest = mock(RestClient.class);
    private final CardImportWriter writer = mock(CardImportWriter.class);

    /** Prodotti veri: per Cyberpunk una comune, Johnny Silverhand Iconic Secret e un box sigillato; per hololive oshi e comune. */
    private List<ImportedCard> sample(TcgcsvImporter importer, String game) throws Exception {
        JsonNode root;
        try (InputStream in = getClass().getResourceAsStream("/tcgplayer-sample.json")) {
            root = JsonMapper.builder().build().readTree(in).get(game);
        }
        Map<Integer, Double> prices = new HashMap<>();
        root.get("prices").forEach(p -> {
            JsonNode value = p.get("marketPrice").isNull() ? p.get("midPrice") : p.get("marketPrice");
            if (!value.isNull()) prices.merge(p.get("productId").asInt(), value.asDouble(), Math::max);
        });
        List<ImportedCard> cards = new ArrayList<>();
        root.get("products").forEach(p -> {
            ImportedCard card = importer.normalize(p, prices, "Set di prova", "SP");
            if (card != null) cards.add(card);
        });
        return cards;
    }

    private static ImportedCard find(List<ImportedCard> cards, String prefix) {
        return cards.stream().filter(c -> c.name().startsWith(prefix)).findFirst().orElseThrow();
    }

    private CardStatCalculator.Stats stats(String source, ImportedCard card) {
        return calculator.calculate(new CardStatCalculator.Input(source, card.code(), card.name(), card.setName(),
                card.rarity(), (Double) card.metadata().get("marketPrice"), card.metadata()));
    }

    @Test
    @DisplayName("Cyberpunk: il box sigillato si scarta, Johnny Silverhand Iconic Secret e' leggendario e guida il mazzo")
    void cyberpunk() throws Exception {
        List<ImportedCard> cards = sample(new CyberpunkImporter(rest, writer, mapper), "cyberpunk");
        assertEquals(2, cards.size(), "niente box");
        ImportedCard johnny = find(cards, "Johnny Silverhand");
        ImportedCard recruits = find(cards, "6th Street Recruits");
        assertEquals("legendary", johnny.rarity());
        assertEquals(1.0, johnny.metadata().get("printScore"));
        assertEquals(true, johnny.metadata().get("leader"));
        assertTrue(johnny.code().startsWith("cyberpunk-"));
        assertTrue(johnny.imgUrl().endsWith("_in_1000x1000.jpg"));
        assertNotNull(recruits.metadata().get("powerPct"));
        assertEquals(false, recruits.metadata().get("leader"));
        CardStatCalculator.Stats j = stats("cyberpunk", johnny);
        CardStatCalculator.Stats r = stats("cyberpunk", recruits);
        assertTrue(j.total() > r.total() + 40, j + " contro " + r);
        assertTrue(j.influence() > r.influence());
    }

    @Test
    @DisplayName("hololive: l'oshi guida il mazzo, la holomem ha gli HP come forza")
    void hololive() throws Exception {
        List<ImportedCard> cards = sample(new HololiveImporter(rest, writer, mapper), "hololive");
        ImportedCard oshi = cards.stream().filter(c -> "Oshi holomem".equals(c.metadata().get("cardType"))).findFirst().orElseThrow();
        ImportedCard member = cards.stream().filter(c -> "holomem".equals(c.metadata().get("cardType"))).findFirst().orElseThrow();
        assertEquals(true, oshi.metadata().get("leader"));
        assertNotNull(member.metadata().get("powerPct"));
        assertTrue(stats("hololive", oshi).influence() > stats("hololive", member).influence());
    }

    @Test
    @DisplayName("Valore della stampa e rarita' senza prezzo")
    void printScore() {
        assertEquals(1.0, TcgcsvImporter.printScore("Iconic Secret", "Judy (ISecret)"));
        assertEquals(1.0, TcgcsvImporter.printScore("Special Rare", "Light of Love, Rem (SP)"));
        assertEquals(0.8, TcgcsvImporter.printScore("Super Legendary", "Bahamut"));
        assertEquals(0.55, TcgcsvImporter.printScore("Rare", "Viper"));
        assertEquals(0.3, TcgcsvImporter.printScore("Common", "Recruits"));
        assertEquals("legendary", TcgcsvImporter.rarityFallback("Secret Rare", 1.0));
        assertEquals("uncommon", TcgcsvImporter.rarityFallback("Uncommon", 0.3));
        assertEquals("common", TcgcsvImporter.rarityFallback("Common", 0.3));
    }

    @Test
    @DisplayName("Otto giochi, ognuno con la sua fonte, e soglie di prezzo per tutti")
    void sources() {
        List<CardImporter> importers = List.of(new CyberpunkImporter(rest, writer, mapper), new HololiveImporter(rest, writer, mapper),
                new UnionArenaImporter(rest, writer, mapper), new ShadowverseImporter(rest, writer, mapper),
                new WixossImporter(rest, writer, mapper), new GrandArchiveImporter(rest, writer, mapper),
                new WeissImporter(rest, writer, mapper), new VanguardImporter(rest, writer, mapper));
        importers.forEach(i -> {
            assertNotNull(mapper.rarityFromPrice(i.source(), 1000.0), i.source());
            assertEquals("legendary", mapper.rarityFromPrice(i.source(), 100_000.0));
            assertFalse(i.demoCards().isEmpty());
        });
        assertEquals(8, importers.stream().map(CardImporter::source).distinct().count());
    }
}
