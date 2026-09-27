package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Weiss Schwarz: solo le serie anime scelte per lo stile di VinylDex (ragazze anime, idol, cyber e punk: Persona,
 * Blue Archive, Chainsaw Man, Lycoris Recoil, BOCCHI THE ROCK!, Girls Band Cry, Oshi no Ko, Hatsune Miku...),
 * non l'intero catalogo di 176 set. Potenza fino a 14000, livello 0-3.
 * Categoria 20 di TCGplayer, via tcgcsv.com (TcgcsvImporter).
 */
@Component
public class WeissImporter extends TcgcsvImporter {

    private static final Spec SPEC = new Spec("weiss", "Weiss Schwarz", 20, Pattern.compile("(?i)persona|rent-a-girlfriend|umamusume|blue archive|chainsaw|lycoris|bocchi|girls band cry|azur lane|guilty gear|rwby|kill la kill|gun gale|oshi no ko|frieren|dandadan|hatsune miku|date a|spy x family|eminence|re:zero|konosuba|hololive|mygo|makeine|revue starlight|madoka"),
            List.of(new Stat("Power", 12000)), List.of(new Stat("Level", 3)), null,
            "Weiss Schwarz © Bushiroad.");

    public WeissImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        super(restClient, writer, priceRarityMapper);
    }

    @Override
    protected Spec spec() {
        return SPEC;
    }
}
