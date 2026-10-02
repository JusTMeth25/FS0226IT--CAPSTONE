package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Carte Pokémon giapponesi: tutti i set del catalogo Pokemon Japan di TCGplayer (459 set, dalle prime
 * espansioni come Mysterious Mountains con il Charizard Crystal fino alle ultime). HP fino a 250+,
 * costo di ritirata 0-4.
 * Categoria 85 di TCGplayer, via tcgcsv.com (TcgcsvImporter). Il Pacchetto Pokémon pesca anche da qui.
 */
@Component
public class PokemonJpImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("pokemonjp", "Pokémon (Giappone)", 85, null,
            List.of(new Stat("HP", 250)), List.of(new Stat("Retreat Cost", 4)), null,
            "Pokémon © Nintendo, Creatures, GAME FREAK.", null);

    public PokemonJpImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
