package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Union Arena di Bandai, tutte le serie anime tranne NIKKE (che ha la sua fonte, NikkeImporter): Chainsaw Man,
 * Jujutsu Kaisen, Code Geass, Evangelion, Tokyo Ghoul, Sword Art Online, Re:ZERO, Solo Leveling e le altre. Il nome
 * della serie resta nei metadati (series) e nel set. BP fino a 10000 (tipico 2500), energia richiesta 0-6.
 * Categoria 81 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class UnionArenaImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("unionarena", "Union Arena", 81, Pattern.compile("^(?!.*NIKKE)"),
            List.of(new Stat("BattlePointBP", 5000)), List.of(new Stat("RequiredEnergy", 6)), null,
            "UNION ARENA © BANDAI.");

    public UnionArenaImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
