package com.capstone.vinyldex.hotel;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

/**
 * Cosa dicono gli NPC e come capiscono cosa scrivono i giocatori.
 *
 * Niente intelligenza artificiale: parole chiave e battute scritte a mano, come i bot di Habbo.
 * Basta a far rispondere il barista a "un caffe' per favore" e il cameriere a "ciao Leo".
 */
public final class NpcDialog {

    /** Cosa vuole il giocatore, letto dal suo messaggio. */
    public enum Intent { ORDER, GREET, THANKS, DANCE, MUSIC, HELP, BYE, NONE }

    /** Oggetti in mano: parola chiave -> nome dell'oggetto (lo stesso che il client disegna). */
    private static final Map<String, String> ITEM_WORDS = new LinkedHashMap<>();

    static {
        ITEM_WORDS.put("caffe", "coffee");
        ITEM_WORDS.put("espresso", "coffee");
        ITEM_WORDS.put("cappuccino", "coffee");
        ITEM_WORDS.put("coffee", "coffee");
        ITEM_WORDS.put("cola", "cola");
        ITEM_WORDS.put("succo", "juice");
        ITEM_WORDS.put("aranciata", "juice");
        ITEM_WORDS.put("juice", "juice");
        ITEM_WORDS.put("bolle", "bubble");
        ITEM_WORDS.put("frizzante", "bubble");
        ITEM_WORDS.put("soda", "bubble");
        ITEM_WORDS.put("cocktail", "cocktail");
        ITEM_WORDS.put("mojito", "cocktail");
        // "te" da solo e' anche un pronome ("per te"): conta solo come "un te'" o "del te'".
        ITEM_WORDS.put("un te", "tea");
        ITEM_WORDS.put("del te", "tea");
        ITEM_WORDS.put("the", "tea");
        ITEM_WORDS.put("tea", "tea");
        ITEM_WORDS.put("tisana", "tea");
        ITEM_WORDS.put("gelato", "gelato");
        ITEM_WORDS.put("cono", "gelato");
    }

    private static final List<String> GENERIC_ORDER = List.of("bere", "bibita", "drink", "sete", "ordinare", "ordino", "menu");
    private static final List<String> GREETINGS = List.of("ciao", "salve", "hey", "ehi", "buongiorno", "buonasera", "hola", "hello", "hi");
    private static final List<String> THANKS = List.of("grazie", "thanks", "thx", "gentile");
    private static final List<String> DANCE = List.of("balla", "balliamo", "ballare", "dance");
    private static final List<String> MUSIC = List.of("musica", "canzone", "brano", "pezzo", "metti");
    private static final List<String> HELP = List.of("aiuto", "consiglio", "consigli", "help", "info", "suggerimento");
    private static final List<String> BYE = List.of("bye", "addio", "vado", "notte", "arrivederci");

    /** Nomi leggibili degli oggetti, per le frasi. */
    private static final Map<String, String> ITEM_NAMES = Map.of(
            "coffee", "un caffe'", "cola", "una cola", "juice", "un succo d'arancia", "bubble", "una bibita frizzante",
            "cocktail", "un cocktail al neon", "tea", "una tazza di te'", "gelato", "un gelato");

    private NpcDialog() {
    }

    /** Minuscolo, senza accenti e senza punteggiatura: "Un caffè, per favore!" -> "un caffe per favore". */
    static String normalize(String text) {
        String plain = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return plain.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    private static boolean hasWord(String normalized, List<String> words) {
        String padded = " " + normalized + " ";
        return words.stream().anyMatch(w -> padded.contains(" " + w + " "));
    }

    public static boolean mentions(String text, String name) {
        return (" " + normalize(text) + " ").contains(" " + normalize(name) + " ");
    }

    /** L'oggetto chiesto nel messaggio, oppure null. */
    public static String requestedItem(String text) {
        String padded = " " + normalize(text) + " ";
        return ITEM_WORDS.entrySet().stream()
                .filter(e -> padded.contains(" " + e.getKey() + " "))
                .map(Map.Entry::getValue)
                .findFirst().orElse(null);
    }

    public static Intent intentOf(String text) {
        String n = normalize(text);
        if (requestedItem(text) != null || hasWord(n, GENERIC_ORDER)) return Intent.ORDER;
        if (hasWord(n, THANKS)) return Intent.THANKS;
        if (hasWord(n, DANCE)) return Intent.DANCE;
        if (hasWord(n, MUSIC)) return Intent.MUSIC;
        if (hasWord(n, GREETINGS)) return Intent.GREET;
        if (hasWord(n, BYE)) return Intent.BYE;
        if (hasWord(n, HELP)) return Intent.HELP;
        return Intent.NONE;
    }

    public static String itemName(String item) {
        return ITEM_NAMES.getOrDefault(item, "qualcosa");
    }

    // ------------------------------------------------------------------ battute

    private static String pick(Random random, List<String> lines) {
        return lines.get(random.nextInt(lines.size()));
    }

    public static String greeting(NpcRoster.Role role, String user, Random random) {
        return switch (role) {
            case RECEPTIONIST -> pick(random, List.of(
                    "Benvenuto al VinylDex Hotel, " + user + "! Se ti serve una mano, chiedi pure.",
                    "Ciao " + user + "! Dal navigatore trovi piscina, bar e giardino."));
            case BARISTA -> pick(random, List.of("Ehi " + user + "! Cosa ti preparo?", "Ciao " + user + ", il bancone e' tutto tuo."));
            case WAITER -> pick(random, List.of("Buongiorno " + user + "! Se vuoi qualcosa, te lo porto io.", "Ciao " + user + "!"));
            case LIFEGUARD -> "Ciao " + user + "! Acqua perfetta oggi, ma niente corse a bordo vasca.";
            case DJ -> "Yo " + user + "! Chiedimi un pezzo e lo metto su.";
            case ICE_CREAM -> "Ciao " + user + "! Un bel gelato?";
            case GARDENER -> "Ciao " + user + "! Attento alle aiuole, le ho appena sistemate.";
            case REFEREE -> "Benvenuto nell'Arena, " + user + ". Clicca un giocatore e sfidalo!";
            case GUEST -> pick(random, List.of("Ciao " + user + "!", "Ehi " + user + ", come va?", "Ciao! Bella stanza, vero?"));
        };
    }

    public static String served(NpcRoster.Role role, String user, String item, Random random) {
        String thing = itemName(item);
        return pick(random, List.of(
                "Ecco a te " + thing + ", " + user + "!",
                thing.substring(0, 1).toUpperCase(Locale.ROOT) + thing.substring(1) + " per " + user + ". Buona pausa!",
                "Servito! " + thing.substring(0, 1).toUpperCase(Locale.ROOT) + thing.substring(1) + " appena fatto."));
    }

    public static String notOnMenu(String item, List<String> menu) {
        return "Mi spiace, " + itemName(item) + " qui non ce l'ho. Posso darti " + itemName(menu.get(0)) + ".";
    }

    public static String comeCloser(String user) {
        return "Vieni pure al bancone, " + user + ", te lo preparo subito!";
    }

    public static String onMyWay(String user, String item) {
        return "Subito, " + user + "! Ti porto " + itemName(item) + ".";
    }

    public static String cantReach(String user) {
        return "Non riesco ad arrivare da te, " + user + ". Vieni tu al bancone?";
    }

    public static String thanks(String user, Random random) {
        return pick(random, List.of("Figurati, " + user + "!", "Prego! Torna quando vuoi.", "E' un piacere!"));
    }

    public static String bye(String user) {
        return "A presto, " + user + "!";
    }

    public static String help(Random random) {
        return pick(random, List.of(
                "Apri pacchetti per trovare carte nuove: le rare valgono parecchio!",
                "Puoi scambiare carte con gli altri: clicca un avatar e scegli Proponi scambio.",
                "Nella tua stanza metti le carte migliori in vetrina: le vedono tutti.",
                "In Arena si sfidano gli altri giocatori a colpi di carte.",
                "Dai rispetto ai giocatori simpatici: ne hai tre al giorno."));
    }

    public static String cannotDance(NpcRoster.Role role) {
        return switch (role) {
            case BARISTA, WAITER, ICE_CREAM -> "Sono in servizio, ballo dopo il turno!";
            case LIFEGUARD -> "Devo tenere d'occhio la vasca, scusa!";
            default -> "Magari dopo!";
        };
    }

    public static String dancing() {
        return "Si balla!";
    }

    public static String musicChange(Random random) {
        return pick(random, List.of("Cambio pezzo, alziamo il volume!", "Questo e' per te!", "Ecco un classico della casa!"));
    }

    public static String noDj() {
        return "Per la musica chiedi al DJ, o usa il jukebox!";
    }

    public static String noService() {
        return "Io non servo da bere, chiedi al bancone!";
    }

    /** Battute dette ogni tanto, senza che nessuno chieda nulla. */
    public static String idle(NpcRoster.Role role, Random random) {
        return pick(random, switch (role) {
            case RECEPTIONIST -> List.of("Benvenuti al VinylDex Hotel!", "Oggi il bar ha i cocktail al neon, provateli.",
                    "Qualcuno ha trovato una leggendaria oggi?");
            case BARISTA -> List.of("Chi ha sete?", "Offro io il prossimo giro... scherzo!", "Il menu e' sul bancone, chiedete pure.");
            case WAITER -> List.of("Qualcuno ha bisogno di qualcosa?", "Arrivo subito!", "Tavolo libero qui!");
            case LIFEGUARD -> List.of("Niente tuffi di testa!", "Ricordatevi la crema solare!", "Acqua a 27 gradi, perfetta.");
            case DJ -> List.of("Mani in alto!", "Questo pezzo e' una bomba.", "Chiedetemi un brano!");
            case ICE_CREAM -> List.of("Gelati freschi!", "Oggi c'e' il gusto vinile: nero con la ciliegina rosa!");
            case GARDENER -> List.of("Queste rose crescono bene.", "Qualcuno ha visto il mio annaffiatoio?");
            case REFEREE -> List.of("Chi si sfida adesso?", "Tre round, vince il migliore!", "Scegliete bene le carte.");
            case GUEST -> List.of("Che bella giornata!", "Qualcuno vuole scambiare carte?", "Adoro questo posto.",
                    "Ho appena aperto un pacchetto fortunato!", "Ci vediamo al Neon Bar stasera?");
        });
    }

    public static String smallTalk(NpcRoster.Role role, String user, Random random) {
        return pick(random, List.of(
                "Dimmi pure, " + user + ".",
                "Tutto bene, " + user + "?",
                idle(role, random)));
    }
}
