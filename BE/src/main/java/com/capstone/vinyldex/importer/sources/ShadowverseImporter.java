package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Shadowverse: Evolve, eroine ed eroi anime fantasy e le collaborazioni (Umamusume, Princess Connect!, idolmaster...).
 * Attacco e difesa di solito 1-8, costo 0-10; i Leader guidano il mazzo.
 * Categoria 73 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class ShadowverseImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("shadowverse", "Shadowverse: Evolve", 73, null,
            List.of(new Stat("Attack", 8), new Stat("Defense", 8)), List.of(new Stat("Cost", 10)), Pattern.compile("(?i)leader"),
            "Shadowverse © Cygames, Inc.");

    public ShadowverseImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
