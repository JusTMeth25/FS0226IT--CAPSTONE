package com.capstone.vinyldex.importer.sources;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Stampe senza foto su TCGplayer: prendono quella di un'altra stampa della stessa carta. */
class TcgplayerImagesTest {

    private List<JsonNode> products() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/tcgplayer-images.json")) {
            List<JsonNode> list = new ArrayList<>();
            JsonMapper.builder().build().readTree(in).forEach(list::add);
            return list;
        }
    }

    @Test
    @DisplayName("DONE AND DUSTED. (SP) (Silver Stamp) non ha foto: usa la Gold Stamp, che ha la sigla SP in comune")
    void silverStampUsesGoldStamp() throws Exception {
        Map<Integer, String> images = TcgplayerImages.forGroup(products());
        assertEquals(TcgplayerImages.url(622848), images.get(657180));
        assertEquals(TcgplayerImages.url(622846), images.get(622846), "chi ha la foto usa la sua");
    }

    @Test
    @DisplayName("Senza nessuna stampa con la foto: nessuna immagine (il frontend disegna il segnaposto)")
    void noSiblingNoImage() throws Exception {
        JsonNode lonely = JsonMapper.builder().build().readTree("{\"productId\": 1, \"name\": \"Sola (SP)\", \"imageCount\": 0}");
        assertEquals("", TcgplayerImages.forGroup(List.of(lonely)).get(1));
    }
}
