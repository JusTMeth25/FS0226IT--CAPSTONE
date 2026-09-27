package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * hololive OFFICIAL CARD GAME: le VTuber di hololive (holomem) con i costumi dei live. Tutti i set e i mazzi
 * delle idol. HP da 50 a 260; le carte Oshi (con la Vita) guidano il mazzo.
 * Categoria 87 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class HololiveImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("hololive", "hololive OFFICIAL CARD GAME", 87, null,
            List.of(new Stat("HP", 250)), List.of(new Stat("Baton Pass", 3), new Stat("Life", 6)), Pattern.compile("(?i)oshi"),
            "hololive © COVER Corporation.");

    public HololiveImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
