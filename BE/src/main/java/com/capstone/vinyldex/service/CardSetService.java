package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Set da completare: gruppi di carte (le cinque di un artista originale, le icone del Brasile,
 * i Goku di Dragon Ball...). Chi le ha tutte ritira un premio in gold e il distintivo del set.
 * I set sono regole sulle carte, non elenchi fissi: se l'import aggiunge una carta che ci rientra,
 * il set si allunga da solo.
 */
@Service
public class CardSetService {

    /** Un set: la regola che sceglie le carte, il premio e l'icona del distintivo. */
    public record SetDef(String key, String title, String description, String icon, int reward, Predicate<Card> rule) {
    }

    static final List<SetDef> SETS = List.of(
            artist("the-dreamer", "The Dreamer", "Il Sognatore"),
            artist("the-innovator", "The Innovator", "L'Innovatore"),
            artist("the-king-of-riffs", "The King of Riffs", "Il Re dei Riff"),
            artist("the-poet", "The Poet", "Il Poeta"),
            artist("the-rebel", "The Rebel", "Il Ribelle"),
            artist("the-showman", "The Showman", "Lo Showman"),
            artist("the-synth-master", "The Synth Master", "Il Maestro dei Synth"),
            artist("the-virtuoso", "The Virtuoso", "Il Virtuoso"),
            new SetDef("fc27-icone-brasile", "Icone del Brasile", "Tutte le icone brasiliane di FC 27", "soccer-ball", 300,
                    c -> fc27Icon(c, "Brazil")),
            new SetDef("fc27-icone-italia", "Icone azzurre", "Tutte le icone italiane di FC 27", "soccer-ball", 250,
                    c -> fc27Icon(c, "Italy")),
            new SetDef("fc27-icone-germania", "Icone tedesche", "Tutte le icone tedesche di FC 27", "soccer-ball", 250,
                    c -> fc27Icon(c, "Germany")),
            new SetDef("pokemon-pikachu", "Pikachu ed Eevee", "Ogni carta di Pikachu ed Eevee", "lightning", 200,
                    named("pokemon", "pikachu|eevee")),
            new SetDef("pokemon-fuoco", "Fiamme di Kanto", "Charmander e Charizard, tutte le versioni", "fire", 200,
                    named("pokemon", "charmander|charizard")),
            new SetDef("dragonball-goku", "Tutti i Goku", "Ogni carta di Goku di Dragon Ball", "hand-fist", 400,
                    named("dragonball", "goku")),
            new SetDef("yugioh-draghi", "Signore dei draghi", "I draghi di Yu-Gi-Oh!", "fire-simple", 350,
                    named("yugioh", "dragon")),
            new SetDef("lorcana-completo", "Lorcana completo", "Tutte le carte di Disney Lorcana", "magic-wand", 400,
                    c -> "lorcana".equals(c.getSource())),
            new SetDef("nikke-parallele", "Parallele di NIKKE", "Le stampe con le stelle di GODDESS OF VICTORY: NIKKE", "star", 350,
                    c -> "nikke".equals(c.getSource()) && c.getMetadata() != null
                            && c.getMetadata().get("stars") instanceof Number stars && stars.intValue() > 0),
            new SetDef("nikke-rapi", "Squadra Counters", "Rapi, Anis e Neon in tutte le versioni", "crosshair", 250,
                    named("nikke", "rapi|anis|neon")),
            new SetDef("cyberpunk-leggende", "Leggende di Night City", "Le carte Legend di Cyberpunk TCG", "lightning", 300,
                    c -> "cyberpunk".equals(c.getSource()) && metaIs(c, "cardType", "(?i)legend")),
            new SetDef("hololive-oshi", "Oshi di hololive", "Le carte Oshi delle idol di hololive", "microphone-stage", 300,
                    c -> "hololive".equals(c.getSource()) && metaIs(c, "cardType", "(?i)oshi")),
            new SetDef("unionarena-punk", "Diavoli e stregoni", "Chainsaw Man e Jujutsu Kaisen di Union Arena", "fire", 300,
                    c -> "unionarena".equals(c.getSource()) && metaIs(c, "series", "(?i)chainsaw|jujutsu")),
            new SetDef("unionarena-ribelli", "Ribelli e mecha", "Code Geass, Evangelion e Gurren Lagann di Union Arena", "robot", 300,
                    c -> "unionarena".equals(c.getSource()) && metaIs(c, "series", "(?i)code geass|evangelion|gurren")),
            new SetDef("grandarchive-campioni", "Campioni di Grand Archive", "I Champion di Grand Archive", "shield", 250,
                    c -> "grandarchive".equals(c.getSource()) && metaIs(c, "cardType", "(?i)champion")),
            new SetDef("wixoss-lrig", "LRIG di WIXOSS", "Le LRIG, le protagoniste di WIXOSS", "sparkle", 250,
                    c -> "wixoss".equals(c.getSource()) && metaIs(c, "cardType", "(?i)^lrig")),
            new SetDef("pokemon-giappone", "Charizard dal Giappone", "Ogni Charizard delle espansioni giapponesi", "fire", 300,
                    named("pokemonjp", "charizard|lizardon")),
            new SetDef("pokemon-promo-mew", "Mew leggendari", "Mew e Mewtwo delle promo Pokémon, Ancient Mew compreso", "sparkle", 300,
                    named("pokemonpromo", "mew")),
            new SetDef("nba-rookie-leggende", "Rookie leggendarie", "Le rookie card delle leggende NBA", "basketball", 400,
                    c -> "nba".equals(c.getSource()) && c.getMetadata() != null
                            && Boolean.TRUE.equals(c.getMetadata().get("rookie")) && Boolean.TRUE.equals(c.getMetadata().get("legend"))),
            new SetDef("nba-downtown", "Downtown", "Tutte le Donruss Optic Downtown", "buildings", 350,
                    c -> "nba".equals(c.getSource()) && metaIs(c, "insert", "(?i)downtown")),
            new SetDef("gundam-assi", "Assi di Gundam", "Le carte epiche e leggendarie di Gundam", "rocket", 250,
                    c -> "gundam".equals(c.getSource()) && Set.of("epic", "legendary").contains(c.getRarity())));

    /** Sotto questo numero di carte un set non ha senso (catalogo non ancora importato). */
    static final int MIN_CARDS = 2;

    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;
    private final WalletService walletService;
    private final JdbcTemplate jdbc;

    public CardSetService(CardRepository cardRepository, UserCardRepository userCardRepository,
                          WalletService walletService, JdbcTemplate jdbc) {
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
        this.walletService = walletService;
        this.jdbc = jdbc;
    }

    private static SetDef artist(String slug, String artistClass, String italian) {
        return new SetDef("artist-" + slug, italian, "Tutte le carte di " + artistClass, "vinyl-record", 150,
                c -> "original".equals(c.getSource()) && c.getArtistClass() != null && artistClass.equals(c.getArtistClass().getName()));
    }

    private static boolean fc27Icon(Card card, String nation) {
        Map<String, Object> m = card.getMetadata();
        return "fc27".equals(card.getSource()) && m != null && "icon".equals(m.get("version")) && nation.equals(m.get("nation"));
    }

    /** Il metadato della carta (tipo, serie...) corrisponde all'espressione. */
    private static boolean metaIs(Card c, String key, String regex) {
        Object value = c.getMetadata() == null ? null : c.getMetadata().get(key);
        return value instanceof String s && PATTERNS.computeIfAbsent(regex, Pattern::compile).matcher(s).find();
    }

    private static final java.util.concurrent.ConcurrentHashMap<String, Pattern> PATTERNS = new java.util.concurrent.ConcurrentHashMap<>();

    private static Predicate<Card> named(String source, String regex) {
        Pattern pattern = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
        return c -> source.equals(c.getSource()) && c.getName() != null && pattern.matcher(c.getName()).find();
    }

    /** Set in vetrina nel pacchetto del weekend: cambia ogni settimana. */
    public record Weekend(boolean active, String key, String title, String icon, List<Card> cards,
                          java.time.Instant startsAt, java.time.Instant endsAt) {
    }

    static final java.time.ZoneId ZONE = java.time.ZoneId.of("Europe/Rome");

    /** Il set della settimana (fra quelli con almeno tre carte) e se oggi e' weekend. */
    @Transactional(readOnly = true)
    public Weekend weekend(java.time.ZonedDateTime now) {
        java.time.LocalDate today = now.withZoneSameInstant(ZONE).toLocalDate();
        java.time.LocalDate saturday = today.with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SATURDAY));
        if (today.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) saturday = today.minusDays(1);
        boolean active = today.getDayOfWeek() == java.time.DayOfWeek.SATURDAY || today.getDayOfWeek() == java.time.DayOfWeek.SUNDAY;
        List<Map.Entry<SetDef, List<Card>>> sets = currentMembers().entrySet().stream()
                .filter(e -> e.getValue().size() >= 3).toList();
        java.time.Instant starts = saturday.atStartOfDay(ZONE).toInstant();
        java.time.Instant ends = saturday.plusDays(2).atStartOfDay(ZONE).toInstant();
        if (sets.isEmpty()) return new Weekend(false, null, null, null, List.of(), starts, ends);
        int index = (int) Math.floorMod(saturday.toEpochDay() / 7, (long) sets.size());
        Map.Entry<SetDef, List<Card>> pick = sets.get(index);
        return new Weekend(active, pick.getKey().key(), pick.getKey().title(), pick.getKey().icon(), pick.getValue(), starts, ends);
    }

    private volatile List<Card> membersCatalog;
    private volatile Map<SetDef, List<Card>> membersCache;

    /**
     * Le carte di ogni set dal catalogo in cache, ricalcolate solo quando il catalogo cambia: con
     * decine di migliaia di carte rifare tutti i filtri a ogni richiesta costerebbe troppo.
     */
    Map<SetDef, List<Card>> currentMembers() {
        List<Card> catalog = cardRepository.findAllActiveWithArtistClass();
        Map<SetDef, List<Card>> cached = membersCache;
        if (cached != null && membersCatalog == catalog) return cached;
        Map<SetDef, List<Card>> fresh = members(catalog);
        membersCache = fresh;
        membersCatalog = catalog;
        return fresh;
    }

    /** Le carte di un set (null se il set non esiste o ha troppe poche carte). */
    public List<Card> setCards(String key) {
        return SETS.stream().filter(s -> s.key().equals(key)).findFirst().map(set -> currentMembers().get(set)).orElse(null);
    }

    /** Le carte di ogni set, dal catalogo attivo. */
    static Map<SetDef, List<Card>> members(List<Card> catalog) {
        Map<SetDef, List<Card>> result = new LinkedHashMap<>();
        for (SetDef set : SETS) {
            List<Card> cards = catalog.stream().filter(set.rule())
                    .sorted(Comparator.comparing(Card::getName, String.CASE_INSENSITIVE_ORDER)).toList();
            if (cards.size() >= MIN_CARDS) result.put(set, cards);
        }
        return result;
    }

    private Set<String> claimed(UUID userId) {
        return new HashSet<>(jdbc.queryForList("SELECT set_key FROM user_set_rewards WHERE user_id = ?", String.class, userId));
    }

    private Set<UUID> owned(UUID userId) {
        return userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).map(uc -> uc.getCard().getId()).collect(Collectors.toSet());
    }

    /** Tutti i set con l'avanzamento del giocatore: prima i completi da ritirare, poi i piu' avanzati. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> progress(UUID userId) {
        Set<UUID> owned = owned(userId);
        Set<String> claimed = claimed(userId);
        List<Map<String, Object>> result = new ArrayList<>();
        currentMembers().forEach((set, cards) -> {
            long have = cards.stream().filter(c -> owned.contains(c.getId())).count();
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("key", set.key());
            view.put("title", set.title());
            view.put("description", set.description());
            view.put("icon", set.icon());
            view.put("reward", set.reward());
            view.put("total", cards.size());
            view.put("owned", have);
            view.put("complete", have == cards.size());
            view.put("claimed", claimed.contains(set.key()));
            result.add(view);
        });
        result.sort(Comparator.comparingInt(CardSetService::rank)
                .thenComparingDouble(v -> -((Number) v.get("owned")).doubleValue() / ((Number) v.get("total")).doubleValue()));
        return result;
    }

    private static int rank(Map<String, Object> view) {
        boolean complete = (boolean) view.get("complete");
        boolean claimed = (boolean) view.get("claimed");
        return complete && !claimed ? 0 : claimed ? 2 : 1;
    }

    /** Ritira il premio di un set completo, una volta sola. */
    @Transactional
    public Map<String, Object> claim(UUID userId, String key) {
        SetDef set = SETS.stream().filter(s -> s.key().equals(key)).findFirst()
                .orElseThrow(() -> ApiException.notFound("set_not_found"));
        List<Card> cards = currentMembers().get(set);
        if (cards == null) throw ApiException.notFound("set_not_found");
        Set<UUID> owned = owned(userId);
        if (!cards.stream().allMatch(c -> owned.contains(c.getId()))) throw ApiException.badRequest("set_incomplete");
        int inserted = jdbc.update("INSERT INTO user_set_rewards (user_id, set_key) VALUES (?, ?) ON CONFLICT DO NOTHING", userId, key);
        if (inserted == 0) throw ApiException.badRequest("set_already_claimed");
        int gold = walletService.adjustGold(userId, set.reward(), WalletTransactionType.SET_REWARD, key,
                "Set completato: " + set.title()).getGold();
        return Map.of("key", key, "reward", set.reward(), "gold", gold);
    }

    /** Distintivi dei set ritirati, per il profilo e la scheda dell'hotel. */
    @Transactional(readOnly = true)
    public List<Map<String, String>> badges(UUID userId) {
        Set<String> claimed = claimed(userId);
        return SETS.stream().filter(s -> claimed.contains(s.key()))
                .map(s -> Map.of("code", "set-" + s.key(), "name", s.title(), "description", "Set completato", "icon", s.icon()))
                .toList();
    }
}
