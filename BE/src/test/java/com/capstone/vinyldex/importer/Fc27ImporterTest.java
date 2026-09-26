package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.controller.FcCardArtControllerProbe;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.PackDropRate;
import com.capstone.vinyldex.importer.sources.Fc27Importer;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.service.PackGenerator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Carte EA FC 27 Ultimate Team: elenco fisso, classifica EA, FutDB, statistiche, pacchetto dedicato, disegno. */
class Fc27ImporterTest {

    private final PriceRarityMapper mapper = new PriceRarityMapper();
    private final Fc27Importer importer = new Fc27Importer(mock(RestClient.class), mock(CardImportWriter.class), mapper, "", "https://futdb.app/api", "https://www.ea.com/games/ea-sports-fc/ratings");
    private final CardStatCalculator calculator = new CardStatCalculator(mapper);

    private static ImportedCard find(List<ImportedCard> cards, String name) {
        return cards.stream().filter(c -> c.name().equals(name)).findFirst().orElseThrow();
    }

    private CardStatCalculator.Stats stats(ImportedCard card) {
        return calculator.calculate(new CardStatCalculator.Input("fc27", card.code(), card.name(), card.setName(),
                card.rarity(), (Double) card.metadata().get("marketPrice"), card.metadata()));
    }

    private static ImportedCard cheapest(List<ImportedCard> cards) {
        return cards.stream().min(Comparator.comparing(c -> (Integer) c.metadata().get("coinPrice"))).orElseThrow();
    }

    @Test
    @DisplayName("L'elenco fisso ha giocatori EA e icone, con crediti convertiti in dollari e rarita' dal prezzo")
    void curatedList() throws Exception {
        List<ImportedCard> cards = importer.curatedCards();
        assertTrue(cards.size() >= 130);
        ImportedCard mbappe = find(cards, "Kylian Mbappé");
        assertEquals("fc27-ea-231747", mbappe.code(), "stesso id dell'import dalla classifica EA");
        assertEquals(1_750_000, mbappe.metadata().get("coinPrice"), "91, ritmo 96, primo in classifica");
        assertEquals(87.5, mbappe.metadata().get("marketPrice"), "20.000 crediti per dollaro");
        assertEquals("legendary", mbappe.rarity());
        assertEquals(96, mbappe.metadata().get("pac"));
        assertTrue(((String) mbappe.metadata().get("photoUrl")).startsWith("https://ratings-images-prod.pulse.ea.com/"));

        ImportedCard pele = find(cards, "Pelé");
        assertEquals("icon", pele.metadata().get("version"));
        assertEquals("legendary", pele.rarity());
        assertTrue(((String) pele.metadata().get("photoUrl")).endsWith("/p237067.png?padding=0.7"), "foto ufficiale EA dell'icona");
        ImportedCard maradona = find(cards, "Diego Maradona");
        assertFalse(maradona.metadata().containsKey("photoUrl"), "EA non ha la foto di Maradona");
        assertEquals(Map.of("skin", "tan", "hair", "curly", "hairColor", "black", "beard", "none"), maradona.metadata().get("look"),
                "senza foto c'e' l'aspetto per il ritratto a pixel");
        assertEquals("common", cheapest(cards).rarity(), "l'oro raro meno caro costa poco");
        assertTrue(cards.stream().anyMatch(c -> "Aitana Bonmatí".equals(c.name())), "ci sono anche le giocatrici");
        assertTrue(cards.stream().allMatch(c -> c.imgUrl().isEmpty()), "le carte le disegna il server");
    }

    @Test
    @DisplayName("Un giocatore della classifica EA diventa una carta con statistiche, foto e prezzo stimato")
    void eaPlayer() {
        String html = """
                <html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"ratingDetails":
                {"totalItems": 19789, "items": [
                 {"id": 231747, "rank": 1, "overallRating": 91, "firstName": "Kylian", "lastName": "Mbappé", "commonName": null,
                  "avatarUrl": "https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p231747.png",
                  "gender": {"id": 0}, "position": {"shortLabel": "ST"}, "team": {"label": "Real Madrid"},
                  "nationality": {"label": "France"},
                  "stats": {"pac": {"value": 96}, "sho": {"value": 91}, "pas": {"value": 80}, "dri": {"value": 92},
                            "def": {"value": 29}, "phy": {"value": 76}}},
                 {"id": 192119, "rank": 10, "overallRating": 90, "firstName": "Thibaut", "lastName": "Courtois", "commonName": null,
                  "gender": {"id": 0}, "position": {"shortLabel": "GK"}, "team": {"label": "Real Madrid"},
                  "nationality": {"label": "Belgium"},
                  "stats": {"gkDiving": {"value": 87}, "gkHandling": {"value": 89}, "gkKicking": {"value": 78},
                            "gkReflexes": {"value": 90}, "pac": {"value": 45}, "gkPositioning": {"value": 90}}},
                 {"id": 241667, "rank": 6, "overallRating": 90, "firstName": "Aitana", "lastName": "Bonmatí Conca",
                  "commonName": "Aitana Bonmatí", "gender": {"id": 1}, "position": {"shortLabel": "CM"},
                  "team": {"label": "FC Barcelona"}, "nationality": {"label": "Spain"},
                  "stats": {"pac": {"value": 80}, "sho": {"value": 85}, "pas": {"value": 86}, "dri": {"value": 88},
                            "def": {"value": 75}, "phy": {"value": 72}}}
                ]}}}}</script></body></html>
                """;
        JsonNode ratings = importer.ratingsOf(html);
        assertEquals(19789, ratings.get("totalItems").asInt());
        List<ImportedCard> cards = new ArrayList<>();
        for (JsonNode item : ratings.get("items").values()) cards.add(importer.fromEa(item));

        ImportedCard mbappe = cards.get(0);
        assertEquals("fc27-ea-231747", mbappe.code());
        assertEquals("Kylian Mbappé", mbappe.name());
        assertEquals(1_750_000, mbappe.metadata().get("coinPrice"));
        assertEquals("https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p231747.png", mbappe.metadata().get("photoUrl"));

        ImportedCard courtois = cards.get(1);
        assertEquals(87, courtois.metadata().get("pac"), "per i portieri le sei statistiche sono quelle da portiere");
        assertEquals(90, courtois.metadata().get("dri"), "REF al posto del dribbling (DIV HAN KIC REF SPD POS)");
        assertEquals(150_000, courtois.metadata().get("coinPrice"), "portiere a meta' prezzo, top 10 al doppio");

        ImportedCard aitana = cards.get(2);
        assertEquals("Aitana Bonmatí", aitana.name(), "il nome comune vince su nome e cognome");
        assertEquals(180_000, aitana.metadata().get("coinPrice"));
    }

    @Test
    @DisplayName("Il prezzo stimato segue valutazione, ritmo e ruolo, con gli scatti del mercato")
    void estimatedCoins() {
        assertEquals(700, Fc27Importer.estimateCoins(81, "CM", 70, false, 400));
        assertEquals(1_050, Fc27Importer.estimateCoins(81, "RW", 88, false, 400));
        assertEquals(150, Fc27Importer.estimateCoins(78, "GK", 40, false, 900));
        assertEquals(150, Fc27Importer.estimateCoins(60, "CB", 60, false, 15000));
        assertEquals(1_500_000, Fc27Importer.estimateCoins(92, "ST", 95, false, 200));
    }

    @Test
    @DisplayName("Le icone sono piu' forti in battaglia degli ori rari economici")
    void battleStats() throws Exception {
        List<ImportedCard> cards = importer.curatedCards();
        CardStatCalculator.Stats pele = stats(find(cards, "Pelé"));
        CardStatCalculator.Stats cheap = stats(cheapest(cards));
        assertTrue(pele.total() > cheap.total() + 40, pele + " contro " + cheap);
        CardStatCalculator.Stats haaland = stats(find(cards, "Erling Haaland"));
        CardStatCalculator.Stats saliba = stats(find(cards, "William Saliba"));
        assertTrue(haaland.energy() >= saliba.energy() - 5, "gli attaccanti contano ritmo e tiro, i difensori la difesa");
    }

    @Test
    @DisplayName("Un giocatore FutDB diventa una carta con le sue statistiche, il prezzo e la foto")
    void futDbPlayer() {
        JsonNode player = JsonMapper.builder().build().readTree("""
                {"id": 1234, "commonName": "Vini Jr.", "position": "LW", "rating": 89, "pace": 93, "shooting": 85,
                 "passing": 80, "dribbling": 91, "defending": 31, "physicality": 71, "rarity": "rare", "color": "gold"}
                """);
        ImportedCard card = importer.fromFutDb(player, 600_000);
        assertEquals("fc27-futdb-1234", card.code());
        assertEquals("Vini Jr.", card.name());
        assertEquals(30.0, card.metadata().get("marketPrice"));
        assertEquals("epic", card.rarity());
        assertEquals("https://futdb.app/api/players/1234/image", card.metadata().get("photoUrl"));
        assertEquals(93, card.metadata().get("pac"));
    }

    @Test
    @DisplayName("Il prezzo FutDB si legge sia come numero sia dentro un oggetto per piattaforma")
    void futDbPrice() {
        JsonMapper json = JsonMapper.builder().build();
        assertEquals(15000, priceOf(json.readTree("{\"price\": 15000}")));
        assertEquals(22000, priceOf(json.readTree("{\"price\": {\"playstation\": 22000, \"pc\": 25000}}")));
        assertEquals(null, priceOf(json.readTree("{\"price\": 0}")));
    }

    private static Integer priceOf(JsonNode node) {
        return Fc27Importer.priceOf(node);
    }

    @Test
    @DisplayName("Il Pacchetto Ultimate Team pesca solo carte EA FC 27")
    void packWithSource() {
        CardRepository repository = mock(CardRepository.class);
        List<Card> all = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            Card card = new Card();
            card.setId(UUID.randomUUID());
            card.setCode("c" + i);
            card.setRarity(i % 2 == 0 ? "common" : "rare");
            card.setSource(i < 10 ? "fc27" : "pokemon");
            all.add(card);
        }
        when(repository.findAllActiveWithArtistClass()).thenReturn(all);
        Pack pack = new Pack();
        pack.setCardCount(6);
        pack.setSource("fc27");
        PackDropRate rate = new PackDropRate();
        rate.setRarity("common");
        rate.setWeight(1.0);
        pack.getDropRates().add(rate);

        List<Card> cards = new PackGenerator(repository).generate(pack);
        assertEquals(6, cards.size());
        assertTrue(cards.stream().allMatch(c -> "fc27".equals(c.getSource())));
    }

    @Test
    @DisplayName("La foto del giocatore si rimpicciolisce prima di finire nella carta")
    void shrinkPhoto() throws Exception {
        java.awt.image.BufferedImage big = new java.awt.image.BufferedImage(900, 900, java.awt.image.BufferedImage.TYPE_INT_ARGB);
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(big, "png", out);
        byte[] small = FcCardArtControllerProbe.shrink(out.toByteArray());
        java.awt.image.BufferedImage read = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(small));
        assertEquals(300, read.getWidth());
        assertEquals(null, FcCardArtControllerProbe.shrink("non e' un'immagine".getBytes()));
    }

    @Test
    @DisplayName("La carta disegnata ha valutazione, ruolo, cognome e le sei statistiche")
    void drawnCard() {
        String svg = FcCardArtControllerProbe.render("Kylian Mbappé", Map.ofEntries(Map.entry("ovr", 91),
                Map.entry("position", "ST"), Map.entry("version", "gold_rare"), Map.entry("pac", 96), Map.entry("sho", 91),
                Map.entry("pas", 80), Map.entry("dri", 92), Map.entry("def", 29), Map.entry("phy", 76),
                Map.entry("club", "Real Madrid"), Map.entry("nation", "France")));
        assertTrue(svg.startsWith("<svg"));
        assertTrue(svg.contains(">91<") && svg.contains(">ST<") && svg.contains("MBAPPÉ"));
        assertTrue(svg.contains("PAC") && svg.contains(">96<"));
        String gk = FcCardArtControllerProbe.render("Thibaut Courtois", Map.of("ovr", 90, "position", "GK"));
        assertTrue(gk.contains("DIV") && gk.contains("REF"));
        assertFalse(FcCardArtControllerProbe.render("A <b>", Map.of()).contains("<b>"), "il nome e' sempre escapato");
        assertTrue(FcCardArtControllerProbe.render("Virgil van Dijk", Map.of()).contains("VAN DIJK"), "la particella resta col cognome");

        String pixel = FcCardArtControllerProbe.render("Diego Maradona", Map.of("nation", "Argentina",
                "look", Map.of("skin", "tan", "hair", "curly", "hairColor", "black")));
        assertTrue(pixel.contains("shape-rendering='crispEdges'"), "senza foto: ritratto a pixel");
        assertTrue(pixel.contains("#8fd3f4"), "maglia albiceleste");
        assertTrue(pixel.contains("#e0b088"), "carnagione dal look");
        assertEquals(FcCardArtControllerProbe.render("Nome Qualsiasi", Map.of()), FcCardArtControllerProbe.render("Nome Qualsiasi", Map.of()),
                "senza look il ritratto si ricava dal nome, sempre uguale");
    }
}
