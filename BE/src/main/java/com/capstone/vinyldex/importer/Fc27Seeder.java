package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.sources.Fc27Importer;
import com.capstone.vinyldex.repository.CardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * All'avvio, se nel database non c'e' ancora nessuna carta EA FC 27, importa l'elenco fisso:
 * cosi' le carte ci sono subito, senza passare dal pannello admin. Poi, se le carte sono ancora
 * poche, legge in background i primi giocatori della classifica EA (qualche secondo, non blocca
 * l'avvio). Gli import successivi aggiornano le stesse carte invece di duplicarle.
 */
@Component
public class Fc27Seeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(Fc27Seeder.class);

    private final CardRepository cardRepository;
    private final Fc27Importer importer;
    /** Giocatori da leggere dalla classifica EA al primo avvio; 0 = mai (per esempio nei test). */
    private final int eaPlayers;

    public Fc27Seeder(CardRepository cardRepository, Fc27Importer importer,
                      @Value("${vinyldex.fc27.seed-ea-players:" + Fc27Importer.EA_DEFAULT_PLAYERS + "}") int eaPlayers) {
        this.cardRepository = cardRepository;
        this.importer = importer;
        this.eaPlayers = eaPlayers;
    }

    @Override
    public void run(ApplicationArguments args) {
        // L'elenco fisso ha ~130 carte (icone comprese): con meno di eaPlayers carte la classifica EA
        // non e' ancora stata letta. L'elenco fisso si (re)importa comunque, costa poco e porta le icone.
        long count = cardRepository.countBySource(Fc27Importer.SOURCE);
        boolean needsEa = eaPlayers > 0 && count < eaPlayers;
        try {
            if (count == 0 || needsEa) {
                ImportResult result = importer.importCurated();
                log.info("Carte EA FC 27 importate dall'elenco fisso: {}", result.imported());
            }
        } catch (Exception ex) {
            log.warn("Import iniziale delle carte EA FC 27 non riuscito: {}", ex.getMessage());
        }
        if (!needsEa) return;
        Thread thread = new Thread(() -> {
            ImportResult result = importer.importCards(new AdminRequests.ImportRequest(null, null, eaPlayers, 1, null, null));
            log.info("Carte EA FC 27 dalla classifica EA: {} (errore: {})", result.imported(), result.error());
        }, "fc27-ea-seed");
        thread.setDaemon(true);
        thread.start();
    }
}
