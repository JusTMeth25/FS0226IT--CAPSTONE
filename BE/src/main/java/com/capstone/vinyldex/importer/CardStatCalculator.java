package com.capstone.vinyldex.importer;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Statistiche di gioco (fans, style, influence, energy) per le carte importate da altri TCG.
 *
 * Le carte originali VinylDex hanno statistiche disegnate a mano; quelle importate partivano tutte
 * da 50. Qui si ricavano dai dati reali di ogni gioco, cosi' una carta forte nel suo TCG e' forte
 * anche nelle battaglie VinylDex (un Charizard ex batte un Magikarp).
 *
 * Ogni statistica e' un punteggio da 0 a 1 calcolato con regole diverse per gioco:
 * - fans: quanto e' ricercata. Percentile del prezzo di mercato nella distribuzione reale della
 *   fonte (PriceRarityMapper) piu' un bonus per i personaggi iconici del franchise.
 * - style: quanto e' bella da collezionare. Versioni speciali riconosciute dal nome e dal set
 *   (illustration rare, alternate art, enchanted, manga, ...) piu' parte del prezzo.
 * - influence: quanto pesa nel suo gioco. Tipo di carta (leader, leggendaria, planeswalker,
 *   Pokemon con regola, mostro dell'Extra Deck, ...) e costo.
 * - energy: forza bruta. HP e danni, ATK/DEF, forza/costituzione, power, DP a seconda del gioco,
 *   normalizzati sui massimi reali di quel gioco.
 *
 * Il punteggio viene poi fuso con la rarita' VinylDex della carta, con lo stesso peso delle
 * carte originali: il centro di ogni fascia (common 62 ... legendary 93) e' la media misurata
 * sulle 43 carte VinylDex. Cosi' le due famiglie di carte restano confrontabili in battaglia.
 *
 * Tarature dai dati reali dei giochi (massimi e scale ufficiali):
 * - Pokemon: HP fino a 340 (VMAX/VSTAR e Pokemon ex), danni degli attacchi fino a ~330.
 * - Yu-Gi-Oh!: ATK/DEF fino a 5000 (Five-Headed Dragon), mostri forti 2500-3000.
 * - Magic: forza + costituzione tipiche 2-12, valore di mana fino a 7+ per le minacce.
 * - One Piece: power dei personaggi 0-12000, leader con 3-5 vite.
 * - Dragon Ball Super: power da 5000 a 35000.
 * - Digimon: DP da 1000 a 16000, costo di gioco fino a 14 circa.
 * - Gundam: AP e HP da 0 a 7.
 * - Lorcana: forza 0-10, volonta' 1-12, leggenda 0-4.
 * - Riftbound: might da 0 a 10.
 */
@Component
public class CardStatCalculator {

    /** Stat di partenza assegnata dall'import prima di questo calcolo. */
    public static final int LEGACY_DEFAULT_STAT = 50;

    private static final Map<String, Double> RARITY_CENTER = Map.of(
            "common", 62.0, "uncommon", 70.0, "rare", 78.0, "epic", 85.0, "legendary", 93.0);

    /** Posizione indicativa nella distribuzione quando la fonte non ha prezzi di mercato. */
    private static final Map<String, Double> RARITY_PERCENTILE = Map.of(
            "common", 0.30, "uncommon", 0.55, "rare", 0.75, "epic", 0.88, "legendary", 0.97);

    /** Peso della rarita' nel risultato: il resto viene dal punteggio del gioco d'origine. */
    private static final double RARITY_WEIGHT = 0.4;

    private static final Pattern NUMBER = Pattern.compile("-?\\d+(\\.\\d+)?");

    private final PriceRarityMapper priceRarityMapper;

    public CardStatCalculator(PriceRarityMapper priceRarityMapper) {
        this.priceRarityMapper = priceRarityMapper;
    }

    public record Stats(int fans, int style, int influence, int energy) {
        public int total() {
            return fans + style + influence + energy;
        }
    }

    /** Dati della carta usati dal calcolo: gli stessi disponibili sia all'import sia sul database. */
    public record Input(String source, String code, String name, String setName, String rarity,
                        Double marketPrice, Map<String, Object> metadata) {
    }

    private record Scores(double fans, double style, double influence, double energy) {
    }

    public Stats calculate(Input card) {
        Map<String, Object> meta = card.metadata() == null ? Map.of() : card.metadata();
        String name = lower(card.name());
        String set = lower(card.setName());
        // Map.of non accetta chiavi null: una rarita' mancante vale come comune.
        String rarity = card.rarity() == null ? "common" : card.rarity();
        Double pricePct = priceRarityMapper.pricePercentile(card.source(), card.marketPrice());
        double popularity = pricePct != null
                ? pricePct
                : RARITY_PERCENTILE.getOrDefault(rarity, 0.3);
        double variant = variantScore(name + " " + set + " " + lower(str(meta, "tcgRarity")));

        Scores scores = switch (card.source() == null ? "" : card.source()) {
            case "pokemon" -> pokemon(name, meta, popularity, variant);
            case "yugioh" -> yugioh(name, meta, popularity, variant);
            case "scryfall" -> magic(name, set, meta, popularity, variant);
            case "onepiece" -> onePiece(name, meta, popularity, variant);
            case "dragonball" -> dragonBall(name, meta, popularity, variant);
            case "digimon" -> digimon(name, meta, popularity, variant);
            case "gundam" -> gundam(name, meta, popularity, variant);
            case "lorcana" -> lorcana(name, meta, popularity, variant);
            case "riftbound" -> riftbound(name, meta, popularity, variant);
            default -> new Scores(popularity, variant, 0.45, 0.45);
        };

        double center = RARITY_CENTER.getOrDefault(rarity, RARITY_CENTER.get("common"));
        return new Stats(
                blend(center, scores.fans(), card.code(), "fans"),
                blend(center, scores.style(), card.code(), "style"),
                blend(center, scores.influence(), card.code(), "influence"),
                blend(center, scores.energy(), card.code(), "energy"));
    }

    // ---------------------------------------------------------------- Pokemon

    private static final List<String> POKEMON_ICONS = List.of(
            "charizard", "pikachu", "mewtwo", "umbreon", "gengar", "eevee", "vaporeon", "jolteon",
            "flareon", "espeon", "leafeon", "glaceon", "sylveon", "rayquaza", "lugia", "blastoise",
            "venusaur", "snorlax", "lucario", "greninja", "gardevoir", "dragonite", "gyarados", "mimikyu");

    private static final List<String> POKEMON_LEGENDS = List.of(
            "mew", "lugia", "ho-oh", "rayquaza", "groudon", "kyogre", "arceus", "dialga", "palkia",
            "giratina", "zekrom", "reshiram", "kyurem", "xerneas", "yveltal", "zacian", "zamazenta",
            "eternatus", "koraidon", "miraidon", "necrozma", "solgaleo", "lunala", "celebi", "jirachi",
            "darkrai", "deoxys", "articuno", "zapdos", "moltres", "suicune", "entei", "raikou");

    private Scores pokemon(String name, Map<String, Object> meta, double popularity, double variant) {
        Double hp = num(meta, "hp");
        Double damage = num(meta, "maxDamage");
        boolean isPokemon = hp != null;

        double ruleBox = pokemonRuleBox(name, lower(String.join(" ", list(meta, "subtypes"))));
        double legend = containsWord(name, POKEMON_LEGENDS) ? 0.1 : 0;
        double icon = containsWord(name, POKEMON_ICONS) ? 1 : containsWord(name, POKEMON_LEGENDS) ? 0.6 : 0;

        double energy;
        double influence;
        if (isPokemon) {
            double hpScore = clamp(hp / 340);
            double damageScore = damage != null ? clamp(damage / 330) : hpScore;
            energy = clamp(0.75 * hpScore + 0.25 * damageScore + 0.1 * ruleBox);
            influence = clamp(0.35 + 0.2 * hpScore + 0.45 * ruleBox + legend);
        } else {
            // Allenatori ed Energie: utili, ma senza forza propria.
            energy = 0.3;
            influence = 0.45;
        }

        return new Scores(
                clamp(0.75 * popularity + 0.25 * icon),
                clamp(0.55 * Math.max(variant, 0.25 + 0.5 * ruleBox) + 0.45 * popularity),
                influence,
                energy);
    }

    /**
     * Pokemon "con regola" (ex, V, VMAX, GX, ...): piu' forti e piu' importanti degli altri.
     * Il trattino viene tolto perche' le stampe scrivono sia "Venusaur-EX" sia "Pikachu ex".
     */
    static double pokemonRuleBox(String name, String subtypes) {
        String all = " " + name.replace('-', ' ') + " " + subtypes + " ";
        if (all.matches(".*( vmax | vstar | tag team |&| mega |^ m | ex ).*")) return 1.0;
        if (all.matches(".*( gx | v | v union ).*")) return 0.85;
        if (all.matches(".*( lv\\.x | break | prime | radiant | star |◇).*")) return 0.7;
        return 0;
    }

    // ---------------------------------------------------------------- Yu-Gi-Oh!

    private static final List<String> YUGIOH_ICONS = List.of(
            "blue-eyes", "dark magician", "exodia", "red-eyes", "kuriboh", "slifer", "obelisk",
            "the winged dragon of ra", "summoned skull", "stardust dragon", "elemental hero",
            "black luster soldier", "jinzo", "pot of greed", "ash blossom", "utopia", "cyber dragon");

    private Scores yugioh(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "type"));
        Double atk = num(meta, "atk");
        Double def = num(meta, "def");
        boolean monster = type.contains("monster");
        double icon = containsAny(name, YUGIOH_ICONS) ? 1 : 0;

        double energy;
        double influence;
        if (monster) {
            double a = atk == null ? 0 : atk;
            double d = def == null ? 0 : def;
            energy = clamp((0.65 * a + 0.35 * d) / 3800);
            double kind;
            if (type.contains("token")) kind = 0.1;
            else if (type.matches(".*(link|xyz|synchro|fusion|ritual).*")) kind = 0.7;
            else if (type.contains("effect")) kind = 0.5;
            else kind = 0.38;
            if (type.contains("pendulum")) kind += 0.05;
            influence = clamp(kind + 0.2 * clamp(a / 5000));
        } else {
            energy = 0.3;
            influence = type.contains("trap") ? 0.48 : 0.5;
        }

        return new Scores(
                clamp(0.75 * popularity + 0.25 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- Magic

    private static final List<String> MAGIC_ICONS = List.of(
            "black lotus", "ancestral recall", "time walk", "mox ", "sol ring", "lightning bolt",
            "shivan dragon", "serra angel", "jace", "liliana", "chandra", "nicol bolas", "emrakul",
            "ulamog", "urza", "teferi", "gideon", "ajani", "garruk", "llanowar elves", "counterspell",
            "dark ritual", "sheoldred", "ragavan", "the one ring");

    private Scores magic(String name, String set, Map<String, Object> meta, double popularity, double variant) {
        String typeLine = lower(str(meta, "typeLine"));
        Double cmc = num(meta, "cmc");
        if (cmc == null) cmc = manaValue(str(meta, "manaCost"));
        Double power = num(meta, "power");
        Double toughness = num(meta, "toughness");
        Double edhrecRank = num(meta, "edhrecRank");

        boolean creature = typeLine.contains("creature");
        boolean legendary = typeLine.contains("legendary");
        double icon = containsAny(name, MAGIC_ICONS) ? 1 : 0;

        double energy;
        if (typeLine.contains("planeswalker")) energy = 0.7;
        else if (creature) {
            energy = power != null && toughness != null
                    ? clamp((power + toughness) / 14)
                    : clamp(0.15 + cmc / 8);
        } else if (typeLine.contains("instant") || typeLine.contains("sorcery")) energy = clamp(0.25 + 0.06 * cmc);
        else if (typeLine.contains("land")) energy = 0.2;
        else energy = 0.3;

        double influence;
        if (typeLine.contains("planeswalker")) influence = 0.9;
        else if (legendary && creature) influence = 0.8;
        else if (legendary) influence = 0.7;
        else if (typeLine.contains("basic land")) influence = 0.1;
        else if (typeLine.contains("land")) influence = 0.3;
        else if (creature) influence = clamp(0.4 + 0.05 * cmc);
        else influence = 0.45;
        if (edhrecRank != null) influence = clamp(0.6 * influence + 0.4 * (1 - edhrecRank / 20000));

        // Set celebrativi di Magic: ristampe con cornici e illustrazioni speciali.
        double setBonus = set.matches(".*(masterpiece|secret lair|timeshifted|expedition|invention|showcase).*") ? 0.85 : 0;

        return new Scores(
                clamp(0.75 * popularity + 0.25 * icon),
                clamp(0.55 * Math.max(variant, setBonus) + 0.45 * popularity),
                influence,
                energy);
    }

    /** Valore di mana da un costo come "{2}{W}{W}": numeri sommati, ogni simbolo colorato vale 1. */
    private static double manaValue(String manaCost) {
        if (manaCost == null || manaCost.isBlank()) return 0;
        double total = 0;
        Matcher symbols = Pattern.compile("\\{([^}]+)}").matcher(manaCost);
        while (symbols.find()) {
            String symbol = symbols.group(1);
            if (symbol.matches("\\d+")) total += Integer.parseInt(symbol);
            else if (!symbol.equalsIgnoreCase("X")) total += 1;
        }
        return total;
    }

    // ---------------------------------------------------------------- One Piece

    private static final List<String> ONE_PIECE_ICONS = List.of(
            "luffy", "zoro", "nami", "sanji", "shanks", "portgas", " ace", "law", "boa hancock",
            "yamato", "kaido", "linlin", "big mom", "newgate", "whitebeard", "roger", "kid", "sabo",
            "robin", "chopper", "mihawk", "buggy", "uta", "usopp");

    private Scores onePiece(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "type"));
        Double power = num(meta, "power");
        Double life = num(meta, "life");
        Double cost = num(meta, "cost");
        double icon = containsAny(" " + name, ONE_PIECE_ICONS) ? 1 : 0;

        double energy;
        double influence;
        if (type.contains("leader")) {
            energy = clamp(0.55 + (power == null ? 0 : power / 30000) + (life == null ? 0 : life * 0.03));
            influence = 0.92;
        } else if (type.contains("character")) {
            double p = power == null ? 0 : power;
            energy = clamp(p / 12000);
            influence = clamp(0.4 + (cost != null ? 0.05 * cost : 0.3 * p / 10000));
        } else if (type.contains("don")) {
            energy = 0.1;
            influence = 0.1;
        } else {
            energy = 0.3;
            influence = type.contains("stage") ? 0.4 : 0.45;
        }

        return new Scores(
                clamp(0.75 * popularity + 0.25 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- Dragon Ball Super

    private static final List<String> DRAGON_BALL_ICONS = List.of(
            "goku", "vegeta", "gohan", "frieza", "broly", "cell", "buu", "trunks", "piccolo",
            "beerus", "jiren", "gogeta", "vegito", "whis", "zamasu", "goku black", "bardock");

    private Scores dragonBall(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "cardType"));
        Double power = num(meta, "power");
        double icon = containsAny(name, DRAGON_BALL_ICONS) ? 1 : 0;
        double powerScore = power == null ? 0.3 : clamp((power - 5000) / 30000);

        double energy;
        double influence;
        if (type.contains("leader")) {
            energy = Math.max(powerScore, 0.6);
            influence = 0.9;
        } else if (type.contains("unison")) {
            energy = powerScore;
            influence = 0.7;
        } else if (type.contains("z-extra")) {
            energy = 0.35;
            influence = 0.6;
        } else if (type.contains("battle")) {
            energy = powerScore;
            influence = clamp(0.45 + 0.35 * powerScore);
        } else {
            energy = 0.3;
            influence = type.contains("field") ? 0.4 : 0.45;
        }

        return new Scores(
                clamp(0.75 * popularity + 0.25 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- Digimon

    private static final List<String> DIGIMON_ICONS = List.of(
            "agumon", "gabumon", "omnimon", "omegamon", "wargreymon", "metalgarurumon", "imperialdramon",
            "gallantmon", "dukemon", "alphamon", "beelzemon", "guilmon", "patamon", "angemon", "gatomon",
            "tailmon", "veemon", "jesmon", "magnamon", "examon", "ulforceveedramon", "lucemon",
            "millenniummon", "diaboromon");

    private Scores digimon(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "type"));
        Double dp = num(meta, "dp");
        Double playCost = num(meta, "playCost");
        double icon = containsAny(name, DIGIMON_ICONS) ? 1 : 0;

        double energy;
        double influence;
        if (type.contains("egg")) {
            energy = 0.15;
            influence = 0.25;
        } else if (type.contains("tamer")) {
            energy = 0.35;
            influence = 0.6;
        } else if (type.contains("option")) {
            energy = 0.3;
            influence = 0.45;
        } else {
            energy = dp == null ? 0.35 : clamp(dp / 15000);
            influence = playCost == null ? 0.45 : clamp(0.35 + 0.55 * Math.min(playCost, 14) / 14);
        }

        return new Scores(
                clamp(0.75 * popularity + 0.25 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- Gundam

    private static final List<String> GUNDAM_ICONS = List.of(
            "rx-78", "char", "zaku", "wing gundam", "unicorn", "freedom", "exia", "barbatos", "sazabi",
            "nu gundam", "ν gundam", "amuro", "zeta", "strike", "aerial", "deathscythe");

    private Scores gundam(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "cardType"));
        double ap = orZero(num(meta, "ap"));
        double hp = orZero(num(meta, "hp"));
        double icon = containsAny(name, GUNDAM_ICONS) ? 1 : name.contains("gundam") ? 0.7 : 0;

        double energy;
        double influence;
        if (type.contains("token")) {
            energy = clamp(0.1 + (ap + hp) / 24);
            influence = 0.15;
        } else if (type.contains("unit")) {
            energy = clamp((ap + hp) / 11);
            influence = clamp(0.45 + 0.4 * (ap + hp) / 12);
        } else if (type.contains("resource")) {
            energy = 0.1;
            influence = 0.1;
        } else if (type.contains("base")) {
            energy = clamp(0.6 * hp / 7);
            influence = 0.4;
        } else if (type.contains("pilot")) {
            energy = 0.35;
            influence = 0.6;
        } else {
            energy = 0.3;
            influence = 0.45;
        }

        return new Scores(
                clamp(0.6 * popularity + 0.4 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- Lorcana

    private static final List<String> LORCANA_ICONS = List.of(
            "mickey", "elsa", "anna", "stitch", "simba", "maleficent", "ursula", "genie", "belle",
            "beast", "rapunzel", "ariel", "moana", "cinderella", "jafar", "hades", "donald", "goofy");

    private Scores lorcana(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "type"));
        Double strength = num(meta, "strength");
        Double willpower = num(meta, "willpower");
        Double lore = num(meta, "lore");
        Double cost = num(meta, "cost");
        double icon = containsAny(name, LORCANA_ICONS) ? 1 : 0;

        double energy;
        double influence;
        if (type.contains("character")) {
            energy = strength != null && willpower != null ? clamp((strength + willpower) / 16) : 0.45;
            influence = clamp(0.4 + (lore != null ? 0.1 * lore : 0.1) + (cost != null ? 0.03 * cost : 0));
        } else if (type.contains("location")) {
            energy = willpower != null ? clamp(willpower / 12) : 0.35;
            influence = 0.45;
        } else {
            energy = 0.3;
            influence = type.contains("song") ? 0.5 : 0.45;
        }

        return new Scores(
                clamp(0.6 * popularity + 0.4 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- Riftbound

    private static final List<String> RIFTBOUND_ICONS = List.of(
            "jinx", "ahri", "yasuo", "lux", "teemo", "garen", "darius", "annie", "viktor", "kai'sa",
            "miss fortune", "lee sin", "volibear", "sett", "leona", "master yi", "yone", "ezreal",
            "vi", "caitlyn", "ekko", "jayce");

    private Scores riftbound(String name, Map<String, Object> meta, double popularity, double variant) {
        String type = lower(str(meta, "type"));
        Double might = num(meta, "might");
        double icon = containsWord(name, RIFTBOUND_ICONS) ? 1 : 0;

        double energy = might != null ? clamp(might / 10) : 0.3;
        double influence;
        if (type.contains("legend")) influence = 0.95;
        else if (type.contains("champion")) influence = 0.85;
        else if (type.contains("unit")) influence = clamp(0.45 + 0.3 * (might == null ? 0 : might) / 10);
        else if (type.contains("rune") || type.contains("token")) influence = 0.15;
        else if (type.contains("battlefield")) influence = 0.35;
        else influence = 0.45;

        return new Scores(
                clamp(0.6 * popularity + 0.4 * icon),
                clamp(0.55 * variant + 0.45 * popularity),
                influence,
                energy);
    }

    // ---------------------------------------------------------------- comuni

    /**
     * Quanto e' speciale la versione della carta, letto dal nome, dal set e dalla rarita' originale.
     * Le etichette sono quelle usate dai TCG e da TCGplayer per le stampe da collezione.
     */
    static double variantScore(String text) {
        if (text.matches(".*(special illustration|hyper rare|secret|gold|enchanted|manga|starlight|ghost"
                + "|quarter century|serial|god rare|treasure rare|overnumbered|iconic|1st edition).*")) {
            return 1.0;
        }
        if (text.matches(".*(alternate art|alt art|alternative art|parallel|full art|illustration rare|shiny"
                + "|rainbow|borderless|showcase|\\(sp\\)|special rare|jolly roger|textured|signature).*")) {
            return 0.8;
        }
        if (text.matches(".*(holo|foil|ultra rare|double rare|promo|prism|collector).*")) {
            return 0.55;
        }
        return 0.25;
    }

    /**
     * Punteggio 0-1 in una statistica da 40 a 100: 40% la fascia della rarita', 60% il punteggio,
     * piu' qualche punto di variazione stabile per carta, cosi' carte simili non hanno numeri
     * identici e rifare il calcolo non cambia il risultato.
     */
    private static int blend(double rarityCenter, double score, String code, String stat) {
        double fromScore = 45 + 55 * clamp(score);
        int jitter = Math.floorMod(Objects.hash(code, stat), 7) - 3;
        long value = Math.round(RARITY_WEIGHT * rarityCenter + (1 - RARITY_WEIGHT) * fromScore) + jitter;
        return (int) Math.max(40, Math.min(100, value));
    }

    private static double clamp(double value) {
        return Math.max(0, Math.min(1, value));
    }

    private static double orZero(Double value) {
        return value == null ? 0 : value;
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static String str(Map<String, Object> meta, String key) {
        Object value = meta.get(key);
        return value == null ? null : value.toString();
    }

    private static List<String> list(Map<String, Object> meta, String key) {
        Object value = meta.get(key);
        if (value instanceof Collection<?> items) return items.stream().map(String::valueOf).toList();
        return value == null ? List.of() : List.of(value.toString());
    }

    /** Legge un numero anche da stringhe come "120+", "4" o "13000". */
    private static Double num(Map<String, Object> meta, String key) {
        Object value = meta.get(key);
        if (value instanceof Number n) return n.doubleValue();
        if (value == null) return null;
        Matcher m = NUMBER.matcher(value.toString());
        return m.find() ? Double.parseDouble(m.group()) : null;
    }

    private static boolean containsAny(String text, List<String> needles) {
        return needles.stream().anyMatch(text::contains);
    }

    /** Come containsAny ma a parola intera: "mew" non deve scattare dentro "mewtwo". */
    private static boolean containsWord(String text, List<String> words) {
        return words.stream().anyMatch(w -> Pattern.compile("(^|[^a-z])" + Pattern.quote(w) + "($|[^a-z])").matcher(text).find());
    }
}
