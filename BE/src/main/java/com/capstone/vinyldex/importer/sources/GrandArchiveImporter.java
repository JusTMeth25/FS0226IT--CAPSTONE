package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Grand Archive: arte anime fantasy (campioni, alleati, regalia). Potenza 0-8, vita dei campioni fino a 30,
 * costo di riserva 0-8; i Champion guidano il mazzo.
 * Categoria 74 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class GrandArchiveImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("grandarchive", "Grand Archive", 74, null,
            List.of(new Stat("Power", 8), new Stat("Life", 30)), List.of(new Stat("Reserve Cost", 8), new Stat("Level", 4)), Pattern.compile("(?i)champion"),
            "Grand Archive © Weebs of the Shore.");

    public GrandArchiveImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
