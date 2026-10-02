package com.capstone.vinyldex.importer;

import com.capstone.vinyldex.dto.request.AdminRequests;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * Base comune degli importer.
 *
 * Si occupa di due cose che tutti condividono: la rete verso l'API esterna e la rete di sicurezza.
 * Se la fonte non risponde, invece di propagare un 500 si salvano le carte demo e si restituisce
 * un esito con usedFallback a true, che il pannello admin sa mostrare.
 */
public abstract class AbstractCardImporter implements CardImporter {

    protected final Logger log = LoggerFactory.getLogger(getClass());
    protected final SecureRandom random = new SecureRandom();

    protected final RestClient restClient;
    protected final CardImportWriter writer;
    protected final PriceRarityMapper priceRarityMapper;

    protected AbstractCardImporter(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper) {
        this.restClient = restClient;
        this.writer = writer;
        this.priceRarityMapper = priceRarityMapper;
    }

    @Override
    public ImportResult importCards(AdminRequests.ImportRequest request) {
        try {
            return doImport(request);
        } catch (Exception ex) {
            log.warn("Import {} fallito: {}", source(), ex.getMessage());
            return saveFallback(ex.getMessage());
        }
    }

    /** Import vero e proprio. Qualsiasi eccezione fa scattare il fallback demo. */
    protected abstract ImportResult doImport(AdminRequests.ImportRequest request) throws Exception;

    /**
     * Salva le carte demo. Anche questo puo' fallire, per esempio con il database irraggiungibile:
     * in quel caso si restituisce comunque un esito leggibile invece di un 500 opaco.
     */
    protected ImportResult saveFallback(String error) {
        try {
            int imported = writer.persist(source(), demoCards(), error);
            return ImportResult.fallback(source(), imported, error);
        } catch (Exception dbEx) {
            return ImportResult.fallbackFailed(source(), error, dbEx.getMessage());
        }
    }

    /**
     * Gli URL arrivano qui gia' codificati.
     *
     * Si passa un URI e non una stringa perche' RestClient tratterebbe la stringa come template
     * e la codificherebbe una seconda volta: un "%3E" diventerebbe "%253E" e la query esterna
     * verrebbe respinta.
     */
    protected JsonNode fetchJson(String url) {
        return restClient.get().uri(URI.create(url)).retrieve().body(JsonNode.class);
    }

    protected JsonNode fetchJson(String url, String headerName, String headerValue) {
        return restClient.get().uri(URI.create(url)).header(headerName, headerValue).retrieve().body(JsonNode.class);
    }

    /**
     * Riprova qualche volta prima di arrendersi.
     * Alcune fonti chiudono la connessione in modo intermittente: gli stessi URL rispondono 200
     * al tentativo successivo, quindi un paio di ritentativi evitano di ricadere sul fallback.
     */
    protected JsonNode fetchJsonWithRetry(String url, int attempts) throws InterruptedException {
        RuntimeException last = null;
        for (int i = 0; i < attempts; i++) {
            try {
                return fetchJson(url);
            } catch (RuntimeException ex) {
                last = ex;
                if (i < attempts - 1) Thread.sleep(800);
            }
        }
        throw last;
    }

    // ---- Lettura difensiva del JSON: una fonte puo' omettere qualunque campo. ----

    protected static String text(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    protected static String textOrEmpty(JsonNode node, String field) {
        String value = text(node, field);
        return value == null ? "" : value;
    }

    protected static Double decimal(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return null;
        if (value.isNumber()) return value.doubleValue();
        try {
            return Double.parseDouble(value.asString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    protected static JsonNode child(JsonNode node, String field) {
        return node == null ? null : node.get(field);
    }

    protected static List<JsonNode> elements(JsonNode arrayNode) {
        List<JsonNode> list = new ArrayList<>();
        if (arrayNode != null && arrayNode.isArray()) {
            arrayNode.forEach(list::add);
        }
        return list;
    }

    /** Punto di partenza casuale per estrarre un blocco da un elenco completo non paginato. */
    /** Import "tutto il catalogo": si salva a blocchi, cosi' ogni transazione resta piccola. */
    protected int persistInChunks(String source, List<ImportedCard> cards) {
        int imported = 0;
        for (int from = 0; from < cards.size(); from += 1000) {
            imported += writer.persist(source, cards.subList(from, Math.min(from + 1000, cards.size())), null);
        }
        return imported;
    }

    protected int randomStart(int total, int limit) {
        return random.nextInt(Math.max(1, total - limit));
    }
}
