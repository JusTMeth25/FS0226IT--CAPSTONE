package com.capstone.vinyldex.importer;

/**
 * Esito di un import, cosi' come lo mostra il pannello admin.
 *
 * usedFallback a true significa che l'API esterna non ha risposto e sono state salvate solo
 * le carte demo. error contiene il motivo, dbError l'eventuale fallimento anche del salvataggio
 * di ripiego.
 */
public record ImportResult(
        String source,
        int imported,
        boolean usedFallback,
        String error,
        String dbError,
        Integer page,
        Integer offset,
        String set,
        Integer totalAvailable
) {

    public static ImportResult success(String source, int imported, Integer page, Integer totalAvailable) {
        return new ImportResult(source, imported, false, null, null, page, null, null, totalAvailable);
    }

    public static ImportResult successWithOffset(String source, int imported, Integer offset, Integer totalAvailable) {
        return new ImportResult(source, imported, false, null, null, null, offset, null, totalAvailable);
    }

    public static ImportResult successWithSet(String source, int imported, String set, Integer totalAvailable) {
        return new ImportResult(source, imported, false, null, null, null, null, set, totalAvailable);
    }

    public static ImportResult fallback(String source, int imported, String error) {
        return new ImportResult(source, imported, true, error, null, null, null, null, null);
    }

    public static ImportResult fallbackFailed(String source, String error, String dbError) {
        return new ImportResult(source, 0, true, error, dbError, null, null, null, null);
    }
}
