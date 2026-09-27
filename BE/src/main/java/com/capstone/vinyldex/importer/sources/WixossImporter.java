package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * WIXOSS: le DIVA e le loro LRIG, ragazze anime in stile idol e cyber (anche Blue Archive DIVA). Potenza fino a
 * 15000, livello 0-4; le LRIG guidano il mazzo.
 * Categoria 67 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class WixossImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("wixoss", "WIXOSS", 67, null,
            List.of(new Stat("Power", 15000)), List.of(new Stat("Level", 4)), Pattern.compile("(?i)lrig"),
            "WIXOSS © LRIG / TOMY.");

    public WixossImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
