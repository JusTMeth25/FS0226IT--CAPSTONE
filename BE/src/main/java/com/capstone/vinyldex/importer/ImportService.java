package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.exception.ApiException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Registro degli importer.
 *
 * Spring inietta tutte le implementazioni di CardImporter: aggiungere una fonte significa
 * creare una classe, senza toccare ne' questo servizio ne' il controller admin.
 */
@Service
public class ImportService {

    private final Map<String, CardImporter> importersBySource;

    public ImportService(List<CardImporter> importers) {
        this.importersBySource = importers.stream()
                .collect(Collectors.toMap(CardImporter::source, Function.identity()));
    }

    public ImportResult importFrom(String source, AdminRequests.ImportRequest request) {
        CardImporter importer = importersBySource.get(source);
        if (importer == null) {
            throw ApiException.notFound("unknown_import_source");
        }
        ImportResult result = importer.importCards(request);
        // Le carte appena importate senza prezzo ricevono subito la stima.
        if (priceBackfill != null) priceBackfill.fillMissing();
        return result;
    }

    /** Facoltativo, cosi' i test lo possono omettere. */
    private CardPriceBackfill priceBackfill;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setPriceBackfill(CardPriceBackfill priceBackfill) {
        this.priceBackfill = priceBackfill;
    }

    /** Fonti disponibili, per popolare il pannello admin senza codificarle nel frontend. */
    public Set<String> availableSources() {
        return importersBySource.keySet();
    }
}
