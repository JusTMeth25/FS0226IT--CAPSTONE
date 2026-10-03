package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.controller.NbaCardArtController;
import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.CardStatCalculator;
import com.capstone.vinyldex.importer.ImportedCard;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Carte NBA: elenco curato, rarita' dal prezzo stimato, statistiche e carta disegnata. */
class NbaImporterTest {

    private final PriceRarityMapper mapper = new PriceRarityMapper();
    private final NbaImporter importer = new NbaImporter(mock(RestClient.class), mock(CardImportWriter.class), mapper);
    private final CardStatCalculator calculator = new CardStatCalculator(mapper);

    private static ImportedCard byId(List<ImportedCard> cards, String id) {
        return cards.stream().filter(c -> c.externalId().equals(id)).findFirst().orElseThrow();
    }

    private CardStatCalculator.Stats stats(ImportedCard card) {
        return calculator.calculate(new CardStatCalculator.Input("nba", card.code(), card.name(), card.setName(),
                card.rarity(), (Double) card.metadata().get("marketPrice"), card.metadata()));
    }

    @Test
    @DisplayName("L'elenco ha codici unici, foto da cdn.nba.com e rarita' dal prezzo")
    void curatedList() throws Exception {
        List<ImportedCard> cards = importer.curatedCards();
        assertTrue(cards.size() >= 150);
        Set<String> codes = new HashSet<>();
        cards.forEach(c -> assertTrue(codes.add(c.code()), "codice doppio " + c.code()));

        ImportedCard jordan = byId(cards, "michael-jordan-1986-87-fleer-base-rookie-57");
        assertEquals("nba-michael-jordan-1986-87-fleer-base-rookie-57", jordan.code());
        assertEquals("https://cdn.nba.com/headshots/nba/latest/1040x760/893.png", jordan.metadata().get("photoUrl"));
        assertEquals(true, jordan.metadata().get("rookie"));
        assertTrue(List.of("epic", "legendary").contains(jordan.rarity()));

        ImportedCard wemby = byId(cards, "victor-wembanyama-2023-24-panini-prizm-rookie-136-black");
        assertEquals("legendary", wemby.rarity(), "Black 1/1 da 56.000 dollari");
        assertEquals(1, wemby.metadata().get("serial"));
    }

    @Test
    @DisplayName("La parallela Gold vale piu' della base in stile e prezzo")
    void goldBeatsBase() throws Exception {
        List<ImportedCard> cards = importer.curatedCards();
        ImportedCard base = byId(cards, "lebron-james-2024-25-donruss-optic-downtown-2");
        ImportedCard gold = byId(cards, "lebron-james-2024-25-donruss-optic-downtown-2-gold");
        assertTrue(stats(gold).style() > stats(base).style());
        assertTrue((Double) gold.metadata().get("marketPrice") > (Double) base.metadata().get("marketPrice"));
    }

    @Test
    @DisplayName("La carta disegnata e' un SVG valido con nome, Downtown e niente risorse esterne")
    void drawnCard() throws Exception {
        for (ImportedCard card : importer.curatedCards()) {
            String svg = NbaCardArtController.render(card.metadata(), "data:image/png;base64,AAAA");
            assertTrue(svg.startsWith("<svg") && svg.endsWith("</svg>"), card.externalId());
            assertTrue(!svg.contains("href='http"), "niente immagini esterne: " + card.externalId());
            javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(svg.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        String downtown = NbaCardArtController.render(
                byId(importer.curatedCards(), "lebron-james-2024-25-donruss-optic-downtown-2-gold").metadata(), null);
        assertTrue(downtown.contains("Downtown") && downtown.contains("LEBRON JAMES"));
    }

    @Test
    @DisplayName("Ogni giocatore ha la sua Action; le foto vengono solo da Wikimedia con licenza libera e crediti")
    void actionCards() throws Exception {
        List<ImportedCard> cards = importer.curatedCards();
        List<ImportedCard> action = cards.stream().filter(c -> "Action".equals(c.metadata().get("insert"))).toList();
        assertEquals(54, action.size(), "una per giocatore piu' due speciali di Jordan");
        int withPhoto = 0;
        for (ImportedCard card : action) {
            if (!(card.metadata().get("actionPhoto") instanceof java.util.Map<?, ?> photo) || photo.get("local") != null) continue;
            withPhoto++;
            String thumb = String.valueOf(photo.get("thumb"));
            assertTrue(thumb.startsWith("https://upload.wikimedia.org/") || thumb.startsWith("https://thumb.wikimedia.org/"), thumb);
            assertTrue(String.valueOf(photo.get("license")).matches("(?i)(CC BY(-SA)? [0-9.]+|CC0|Public domain)"), card.externalId());
            assertTrue(String.valueOf(photo.get("page")).startsWith("https://commons.wikimedia.org/"), card.externalId());
        }
        assertTrue(withPhoto >= 40, "foto per " + withPhoto + " giocatori");

        ImportedCard jordan = byId(cards, "michael-jordan-1986-87-fleer-base-rookie-57");
        String svg = NbaCardArtController.render(jordan.metadata(), null);
        assertTrue(svg.contains("VINYLDEX") && svg.contains("Wikimedia Commons"), "la Fleer di Jordan e' una carta Action con i crediti");
    }
}
