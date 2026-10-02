package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Carte Pokémon promozionali e speciali che il catalogo di pokemontcg.io non ha: Ancient Mew, le promo
 * Wizards e del film, McDonald’s, le Jumbo, i premi dei tornei (Rocket’s Mewtwo), i Trainer Kit.
 * Si scartano le Code Card digitali.
 * Categoria 3 di TCGplayer, via tcgcsv.com (TcgcsvImporter). Il Pacchetto Pokémon pesca anche da qui.
 */
@Component
public class PokemonPromoImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("pokemonpromo", "Pokémon promo e speciali", 3, Pattern.compile("(?i)miscellaneous|wotc promo|best of promos|mcdonald|jumbo|deck exclusives|countdown calendar|kids wb|league & championship|prize pack|player placement|trainer kit"),
            List.of(new Stat("HP", 250)), List.of(new Stat("RetreatCost", 4)), null,
            "Pokémon © Nintendo, Creatures, GAME FREAK.", Pattern.compile("(?i)code card"));

    public PokemonPromoImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
