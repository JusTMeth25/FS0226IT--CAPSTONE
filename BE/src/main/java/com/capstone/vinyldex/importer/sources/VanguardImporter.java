package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Cardfight!! Vanguard: solo i set con le idol e i personaggi anime (Lyrical Monasterio, BanG Dream!, Persona,
 * Touken Ranbu, Shaman King, i Master Deckset delle protagoniste). Potenza fino a 25000 (tipica 8000-15000), grado 0-4.
 * Categoria 16 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class VanguardImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("vanguard", "Cardfight!! Vanguard", 16, Pattern.compile("(?i)lyrical|bang dream|persona|touken ranbu|record of ragnarok|shaman king|master deckset|divas"),
            List.of(new Stat("Power", 15000)), List.of(new Stat("Grade", 4)), null,
            "Cardfight!! Vanguard © Bushiroad.");

    public VanguardImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
