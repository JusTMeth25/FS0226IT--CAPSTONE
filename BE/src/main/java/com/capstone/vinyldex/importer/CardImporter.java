package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.dto.request.AdminRequests;

import java.util.List;

/** Contratto di un importer di carte da un'API esterna. */
public interface CardImporter {

    /** Nome della fonte, salvato in Card.source (es. "pokemon"). */
    String source();

    ImportResult importCards(AdminRequests.ImportRequest request);

    /** Carte segnaposto salvate quando l'API esterna non risponde. */
    List<ImportedCard> demoCards();
}
