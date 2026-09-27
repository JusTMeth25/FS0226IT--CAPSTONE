package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Cyberpunk TCG, il gioco di carte di Night City: mercenari, netrunner e leggende come Johnny Silverhand, Judy e Panam.
 * Tutti i set (Welcome to Night City, The Heist, Night City Brawl, promo e box topper). Potenza 0-15, costo 0-9;
 * le carte Legend guidano il mazzo.
 * Categoria 92 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class CyberpunkImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("cyberpunk", "Cyberpunk TCG", 92, null,
            List.of(new Stat("Power", 12)), List.of(new Stat("Cost", 9)), Pattern.compile("(?i)legend"),
            "Cyberpunk © CD PROJEKT S.A.");

    public CyberpunkImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
