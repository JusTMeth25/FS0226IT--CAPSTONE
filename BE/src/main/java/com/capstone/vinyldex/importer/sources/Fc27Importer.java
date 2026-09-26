package com.capstone.vinyldex.importer.sources;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.importer.AbstractCardImporter;
import com.capstone.vinyldex.importer.CardImportWriter;
import com.capstone.vinyldex.importer.ImportResult;
import com.capstone.vinyldex.importer.ImportedCard;
import com.capstone.vinyldex.importer.PriceRarityMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Carte di EA FC 27 Ultimate Team: giocatori, giocatrici e icone.
 *
 * Le fonti, in ordine di preferenza:
 * - la classifica ufficiale EA (ea.com/games/ea-sports-fc/ratings): ~20.000 giocatori e giocatrici
 *   con valutazione, ruolo, club, nazione, statistiche e foto. Non serve una chiave: la pagina
 *   contiene i dati in JSON (__NEXT_DATA__), 100 giocatori per pagina. Non ha ne' icone ne' prezzi;
 * - FutDB (futdb.app), un'API gratuita con chiave (FUTDB_API_KEY): prezzi veri. Si usa chiedendo
 *   l'import con query "futdb";
 * - un elenco fisso nel progetto (resources/fc27/cards.json, generato da scripts/fc27_cards.py):
 *   i primi 100 della classifica EA piu' le icone, sempre disponibile anche senza rete.
 *
 * I siti dei prezzi (FUTBIN, FUT.GG) bloccano le letture automatiche: senza FutDB il prezzo in
 * crediti e' una stima (estimateCoins) dalla valutazione, dal ritmo e dal ruolo.
 *
 * I prezzi di Ultimate Team sono in crediti. La carta li mostra cosi', ma nel resto del gioco
 * (rarita', valore dei pacchetti, negozio, scambi) serve un prezzo in dollari come per gli altri
 * TCG: si converte con un cambio fisso, COINS_PER_USD.
 */
@Component
public class Fc27Importer extends AbstractCardImporter {

    public static final String SOURCE = "fc27";

    /**
     * Crediti per un dollaro. Tarato perche' le carte piu' care stiano accanto alle leggendarie
     * degli altri giochi: un'icona da 9 milioni vale ~450 dollari, un oro raro da 3.000 crediti
     * 15 centesimi, come una comune Pokemon.
     */
    public static final int COINS_PER_USD = 20_000;

    private static final int MAX_LIMIT = 200;
    /** Giocatori letti dalla classifica EA in un import: 500 arrivano fino a valutazione ~81. */
    public static final int EA_DEFAULT_PLAYERS = 500;
    private static final int EA_MAX_PLAYERS = 3000;
    private static final int EA_PAGE_SIZE = 100;
    /** Pausa fra una pagina EA e l'altra, per non martellare il sito. */
    private static final long EA_PAGE_DELAY_MILLIS = 500;
    private static final Pattern NEXT_DATA =
            Pattern.compile("<script id=\"__NEXT_DATA__\" type=\"application/json\">(.*?)</script>", Pattern.DOTALL);

    /** Prezzo indicativo in crediti di un oro raro per valutazione (andamento tipico del mercato). */
    private static final NavigableMap<Integer, Integer> GOLD_PRICE = new TreeMap<>(Map.ofEntries(
            Map.entry(0, 150), Map.entry(75, 200), Map.entry(78, 250), Map.entry(79, 350), Map.entry(80, 500),
            Map.entry(81, 700), Map.entry(82, 1_000), Map.entry(83, 1_600), Map.entry(84, 3_000),
            Map.entry(85, 6_000), Map.entry(86, 12_000), Map.entry(87, 25_000), Map.entry(88, 45_000),
            Map.entry(89, 80_000), Map.entry(90, 150_000), Map.entry(91, 350_000), Map.entry(92, 600_000)));
    /** Pausa fra una richiesta di prezzo e l'altra: FutDB vuole un prezzo per richiesta. */
    private static final long PRICE_DELAY_MILLIS = 250;

    private final String apiKey;
    private final String apiUrl;
    private final String ratingsUrl;
    private final JsonMapper mapper = JsonMapper.builder().build();

    public Fc27Importer(RestClient restClient, CardImportWriter writer, PriceRarityMapper priceRarityMapper,
                        @Value("${vinyldex.futdb.api-key:}") String apiKey,
                        @Value("${vinyldex.futdb.api-url:https://futdb.app/api}") String apiUrl,
                        @Value("${vinyldex.fc27.ratings-url:https://www.ea.com/games/ea-sports-fc/ratings}") String ratingsUrl) {
        super(restClient, writer, priceRarityMapper);
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.apiUrl = apiUrl;
        this.ratingsUrl = ratingsUrl;
    }

    @Override
    public String source() {
        return SOURCE;
    }

    public boolean hasApiKey() {
        return !apiKey.isEmpty();
    }

    /**
     * query "futdb" = FutDB (serve la chiave), "curated" = solo l'elenco fisso, altrimenti la
     * classifica EA. Se la fonte scelta non risponde si ripiega sull'elenco fisso.
     */
    @Override
    protected ImportResult doImport(AdminRequests.ImportRequest request) throws Exception {
        String mode = request.query() == null ? "" : request.query().trim().toLowerCase(Locale.ROOT);
        if (mode.equals("curated")) return importCurated();
        if (mode.equals("futdb") && !hasApiKey()) return curatedFallback("FutDB: manca FUTDB_API_KEY");
        try {
            return mode.equals("futdb") ? importFromFutDb(request) : importFromEa(request);
        } catch (InterruptedException ex) {
            throw ex;
        } catch (Exception ex) {
            // La fonte non risponde o ha cambiato formato: meglio l'elenco fisso delle carte demo.
            log.warn("Fonte FC 27 non disponibile, uso l'elenco fisso: {}", ex.getMessage());
            return curatedFallback((mode.equals("futdb") ? "FutDB: " : "EA: ") + ex.getMessage());
        }
    }

    private ImportResult curatedFallback(String error) throws IOException {
        List<ImportedCard> cards = curatedCards();
        int imported = writer.persist(SOURCE, cards, error);
        return ImportResult.success(SOURCE, imported, null, cards.size());
    }

    /** Importa tutto l'elenco fisso: e' piccolo, non serve paginarlo. */
    public ImportResult importCurated() throws IOException {
        List<ImportedCard> cards = curatedCards();
        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, null, cards.size());
    }

    public List<ImportedCard> curatedCards() throws IOException {
        try (InputStream in = new ClassPathResource("fc27/cards.json").getInputStream()) {
            List<ImportedCard> cards = new ArrayList<>();
            for (JsonNode node : elements(mapper.readTree(in))) {
                int ovr = orZero(integer(node, "ovr"));
                String position = text(node, "position");
                int[] stats = {orZero(integer(node, "pac")), orZero(integer(node, "sho")), orZero(integer(node, "pas")),
                        orZero(integer(node, "dri")), orZero(integer(node, "def")), orZero(integer(node, "phy"))};
                Integer coins = integer(node, "coinPrice");
                if (coins == null) {
                    boolean women = node.has("women") && node.get("women").asBoolean();
                    coins = estimateCoins(ovr, position, stats[0], women, integer(node, "rank"));
                }
                ImportedCard card = toCard(text(node, "id"), text(node, "name"), text(node, "club"), text(node, "nation"),
                        position, ovr, stats, text(node, "version"), coins, text(node, "photoUrl"), "stima");
                // Nome da scrivere sulla carta quando non e' il cognome (Carlos Alberto, Ronaldo).
                String cardName = text(node, "cardName");
                if (cardName != null) card.metadata().put("cardName", cardName);
                // Aspetto per il ritratto a pixel delle icone senza foto (PixelAvatar).
                JsonNode look = child(node, "look");
                if (look != null && look.isObject()) {
                    Map<String, Object> lookMap = new HashMap<>();
                    for (String key : List.of("skin", "hair", "hairColor", "beard")) {
                        String value = text(look, key);
                        if (value != null) lookMap.put(key, value);
                    }
                    card.metadata().put("look", lookMap);
                }
                cards.add(card);
            }
            return cards;
        }
    }

    // ------------------------------------------------------------------ classifica EA

    /**
     * Legge la classifica EA a pagine da 100, partendo da request.page (default 1), fino a
     * request.limit giocatori (default EA_DEFAULT_PLAYERS). Prezzi stimati.
     */
    public ImportResult importFromEa(AdminRequests.ImportRequest request) throws InterruptedException {
        int limit = request.limitOrDefault(EA_DEFAULT_PLAYERS, EA_MAX_PLAYERS);
        int page = request.page() == null || request.page() < 1 ? 1 : request.page();
        List<ImportedCard> cards = new ArrayList<>();
        Integer total = null;
        while (cards.size() < limit) {
            JsonNode ratings = eaPage(page);
            if (total == null) total = integer(ratings, "totalItems");
            List<JsonNode> items = elements(child(ratings, "items"));
            if (items.isEmpty()) break;
            for (JsonNode item : items) {
                if (cards.size() >= limit) break;
                ImportedCard card = fromEa(item);
                if (card != null) cards.add(card);
            }
            if (items.size() < EA_PAGE_SIZE || cards.size() >= limit) break;
            page++;
            Thread.sleep(EA_PAGE_DELAY_MILLIS);
        }
        if (cards.isEmpty()) throw new IllegalStateException("nessun giocatore nella classifica EA");
        int imported = writer.persist(SOURCE, cards, null);
        return ImportResult.success(SOURCE, imported, page, total);
    }

    /** La pagina e' HTML: il RestClient degli import ha solo il convertitore JSON, quindi si legge il corpo a mano. */
    private JsonNode eaPage(int page) {
        String html = restClient.get().uri(URI.create(ratingsUrl + "?page=" + page))
                .header("User-Agent", "Mozilla/5.0 (VinylDex)")
                .header("Accept", "text/html")
                .exchange((request, response) -> {
                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new IllegalStateException("classifica EA: HTTP " + response.getStatusCode().value());
                    }
                    return new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                });
        return ratingsOf(html);
    }

    /** Il blocco ratingDetails ({totalItems, items}) dal JSON __NEXT_DATA__ della pagina EA. */
    public JsonNode ratingsOf(String html) {
        Matcher matcher = NEXT_DATA.matcher(html == null ? "" : html);
        if (!matcher.find()) throw new IllegalStateException("pagina EA senza __NEXT_DATA__");
        JsonNode ratings = child(child(child(mapper.readTree(matcher.group(1)), "props"), "pageProps"), "ratingDetails");
        if (ratings == null) throw new IllegalStateException("pagina EA senza ratingDetails");
        return ratings;
    }

    /** Un giocatore della classifica EA in carta; null se manca l'id. */
    public ImportedCard fromEa(JsonNode item) {
        String eaId = text(item, "id");
        if (eaId == null) return null;
        String name = firstNonBlank(text(item, "commonName"),
                (textOrEmpty(item, "firstName") + " " + textOrEmpty(item, "lastName")).trim());
        String position = firstNonBlank(text(child(item, "position"), "shortLabel"), "ST");
        JsonNode stats = child(item, "stats");
        String[] keys = "GK".equalsIgnoreCase(position)
                ? new String[]{"gkDiving", "gkHandling", "gkKicking", "gkReflexes", "pac", "gkPositioning"}
                : new String[]{"pac", "sho", "pas", "dri", "def", "phy"};
        int[] values = new int[keys.length];
        for (int i = 0; i < keys.length; i++) values[i] = orZero(integer(child(stats, keys[i]), "value"));
        int ovr = orZero(integer(item, "overallRating"));
        JsonNode gender = child(item, "gender");
        boolean women = gender != null && Integer.valueOf(1).equals(integer(gender, "id"));
        String version = ovr >= 75 ? "gold_rare" : ovr >= 65 ? "silver" : "bronze";
        return toCard("ea-" + eaId, name, text(child(item, "team"), "label"), text(child(item, "nationality"), "label"),
                position, ovr, values, version, estimateCoins(ovr, position, values[0], women, integer(item, "rank")),
                text(item, "avatarUrl"), "stima");
    }

    /**
     * Prezzo indicativo in crediti: la valutazione fissa la fascia, poi il ritmo alza gli
     * attaccanti veloci, i portieri costano la meta', i primi 10 della classifica il doppio,
     * le giocatrici un po' meno (meno richieste nelle rose).
     */
    public static int estimateCoins(int ovr, String position, int pac, boolean women, Integer rank) {
        double price = GOLD_PRICE.floorEntry(Math.max(0, ovr)).getValue();
        if ("GK".equalsIgnoreCase(position)) price *= 0.5;
        else if (pac >= 90) price *= 2.5;
        else if (pac >= 85) price *= 1.5;
        if (rank != null && rank <= 10) price *= 2;
        if (women) price *= 0.6;
        return roundPrice(price);
    }

    /** I prezzi del mercato UT hanno scatti fissi: 50, 100, 250, 1000 crediti a seconda della fascia. */
    static int roundPrice(double price) {
        int step = price < 10_000 ? 50 : price < 50_000 ? 100 : price < 100_000 ? 250 : 1_000;
        return (int) Math.max(step, Math.round(price / step) * step);
    }

    // ------------------------------------------------------------------ FutDB

    /**
     * Una pagina di giocatori FutDB e il prezzo di ognuno (una richiesta per giocatore, con una
     * piccola pausa). Le pagine si scorrono con request.page: gli import successivi proseguono.
     */
    private ImportResult importFromFutDb(AdminRequests.ImportRequest request) throws InterruptedException {
        int limit = request.limitOrDefault(40, MAX_LIMIT);
        int page = request.page() == null || request.page() < 1 ? 1 : request.page();
        JsonNode body = fetchJson(apiUrl + "/players?page=" + page, "X-AUTH-TOKEN", apiKey);
        List<JsonNode> items = elements(child(body, "items"));
        if (items.isEmpty()) throw new IllegalStateException("nessun giocatore nella pagina " + page);

        List<ImportedCard> cards = new ArrayList<>();
        for (JsonNode player : items.subList(0, Math.min(limit, items.size()))) {
            String id = text(player, "id");
            if (id == null) continue;
            Integer coins = null;
            try {
                coins = priceOf(fetchJson(apiUrl + "/players/" + id + "/price", "X-AUTH-TOKEN", apiKey));
            } catch (RuntimeException ex) {
                log.debug("Prezzo FutDB mancante per {}: {}", id, ex.getMessage());
            }
            Thread.sleep(PRICE_DELAY_MILLIS);
            cards.add(fromFutDb(player, coins));
        }
        int imported = writer.persist(SOURCE, cards, null);
        JsonNode pagination = child(body, "pagination");
        Integer total = pagination == null ? null : integer(pagination, "itemsTotal");
        return ImportResult.success(SOURCE, imported, page, total);
    }

    /** Giocatore FutDB in carta: i nomi dei campi seguono la documentazione dell'API. */
    public ImportedCard fromFutDb(JsonNode player, Integer coins) {
        String id = "futdb-" + text(player, "id");
        String name = firstNonBlank(text(player, "commonName"), text(player, "name"),
                (textOrEmpty(player, "firstName") + " " + textOrEmpty(player, "lastName")).trim());
        String position = firstNonBlank(text(player, "position"), "ST");
        boolean goalkeeper = "GK".equalsIgnoreCase(position);
        int[] stats = goalkeeper
                ? new int[]{stat(player, "goalkeeperAttributes", "diving"), stat(player, "goalkeeperAttributes", "handling"),
                stat(player, "goalkeeperAttributes", "kicking"), stat(player, "goalkeeperAttributes", "reflexes"),
                stat(player, null, "pace"), stat(player, "goalkeeperAttributes", "positioning")}
                : new int[]{stat(player, null, "pace"), stat(player, null, "shooting"), stat(player, null, "passing"),
                stat(player, null, "dribbling"), stat(player, null, "defending"), stat(player, null, "physicality")};
        String version = versionOf(text(player, "rarity"), text(player, "color"));
        String photo = apiUrl + "/players/" + text(player, "id") + "/image";
        return toCard(id, name, firstNonBlank(text(player, "clubName"), text(player, "club")),
                firstNonBlank(text(player, "nationName"), text(player, "nation")), position,
                integer(player, "rating"), stats, version, coins, photo, "futdb");
    }

    /** Il prezzo arriva come numero oppure dentro un oggetto (per piattaforma): si prende il primo numero. */
    public static Integer priceOf(JsonNode body) {
        if (body == null || body.isNull()) return null;
        if (body.isNumber()) return body.intValue() > 0 ? body.intValue() : null;
        JsonNode price = body.get("price");
        if (price != null && price.isNumber()) return price.intValue() > 0 ? price.intValue() : null;
        for (JsonNode child : (price != null && price.isObject() ? price : body).values()) {
            Integer found = priceOf(child);
            if (found != null) return found;
        }
        return null;
    }

    private static String versionOf(String rarity, String color) {
        String all = ((rarity == null ? "" : rarity) + " " + (color == null ? "" : color)).toLowerCase(Locale.ROOT);
        if (all.contains("icon")) return "icon";
        if (all.contains("hero")) return "hero";
        if (all.contains("totw") || all.contains("inform")) return "totw";
        if (all.contains("bronze")) return "bronze";
        if (all.contains("silver")) return "silver";
        return "gold_rare";
    }

    // ------------------------------------------------------------------ carta

    private ImportedCard toCard(String id, String name, String club, String nation, String position, Integer ovr,
                                int[] stats, String version, Integer coins, String photo, String priceSource) {
        Double usd = coins == null || coins <= 0 ? null : Math.round(coins * 100.0 / COINS_PER_USD) / 100.0;
        String rarity = priceRarityMapper.rarityFromPrice(SOURCE, usd);
        if (rarity == null) rarity = rarityFromRating(ovr == null ? 0 : ovr, version);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("marketPrice", usd);
        metadata.put("coinPrice", coins);
        metadata.put("priceSource", priceSource);
        metadata.put("ovr", ovr);
        metadata.put("position", position);
        metadata.put("club", club);
        metadata.put("nation", nation);
        metadata.put("version", version);
        String[] keys = {"pac", "sho", "pas", "dri", "def", "phy"};
        for (int i = 0; i < keys.length; i++) metadata.put(keys[i], stats[i]);
        if (photo != null) metadata.put("photoUrl", photo);

        String label = "icon".equals(version) ? "ICON" : "hero".equals(version) ? "Eroe" : "Ultimate Team";
        return new ImportedCard(
                id,
                SOURCE + "-" + id,
                name,
                "EA FC 27 · " + label,
                "FC27",
                ovr == null ? null : String.valueOf(ovr),
                rarity,
                // Nessuna immagine esterna: la carta la disegna il server (FcCardArtController).
                "",
                String.join(" · ", List.of(orDash(club), orDash(nation), orDash(position))) + " · valutazione " + ovr,
                metadata);
    }

    /** Senza prezzo si guarda la valutazione (le icone valgono sempre tanto). */
    static String rarityFromRating(int ovr, String version) {
        if ("icon".equals(version)) return ovr >= 92 ? "legendary" : "epic";
        if (ovr >= 90) return "epic";
        if (ovr >= 87) return "rare";
        if (ovr >= 84) return "uncommon";
        return "common";
    }

    private static int stat(JsonNode player, String group, String field) {
        JsonNode node = group == null ? player : child(player, group);
        Integer value = integer(node, field);
        return value == null ? 0 : value;
    }

    private static Integer integer(JsonNode node, String field) {
        Double value = decimal(node, field);
        return value == null ? null : (int) Math.round(value);
    }

    private static int orZero(Integer value) {
        return value == null ? 0 : value;
    }

    private static String orDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value;
        return null;
    }

    @Override
    public List<ImportedCard> demoCards() {
        return List.of(
                ImportedCard.demo(SOURCE, "demo-mbappe", "Kylian Mbappé (demo)", "legendary",
                        "Carta demo (elenco FC 27 non leggibile)."));
    }
}
