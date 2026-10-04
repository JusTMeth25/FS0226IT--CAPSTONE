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
        // Caffetteria del quartiere: prima le parole piu' lunghe ("caffellatte" prima di "caffe").
        ITEM_WORDS.put("caffellatte", "latte");
        ITEM_WORDS.put("latte macchiato", "latte");
        ITEM_WORDS.put("latte", "latte");
        ITEM_WORDS.put("frappuccino", "frappe");
        ITEM_WORDS.put("frappe", "frappe");
        ITEM_WORDS.put("frullato", "frappe");
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
        ITEM_WORDS.put("pizza", "pizza");
        ITEM_WORDS.put("trancio", "pizza");
        ITEM_WORDS.put("margherita", "pizza");
        ITEM_WORDS.put("libro", "book");
        ITEM_WORDS.put("romanzo", "book");
        ITEM_WORDS.put("leggere", "book");
        ITEM_WORDS.put("gelato", "gelato");
        ITEM_WORDS.put("cono", "gelato");
        ITEM_WORDS.put("popcorn", "popcorn");
        ITEM_WORDS.put("pop corn", "popcorn");
        // "acqua" da sola e' anche il mare e la piscina: conta solo come "dell'acqua" o "un'acqua".
        ITEM_WORDS.put("dell acqua", "water");
        ITEM_WORDS.put("un acqua", "water");
        ITEM_WORDS.put("d acqua", "water");
        ITEM_WORDS.put("borraccia", "water");
        ITEM_WORDS.put("water", "water");
    }

    private static final List<String> GENERIC_ORDER = List.of("bere", "bibita", "drink", "sete", "ordinare", "ordino", "menu");
    private static final List<String> GREETINGS = List.of("ciao", "salve", "hey", "ehi", "buongiorno", "buonasera", "hola", "hello", "hi");
    private static final List<String> THANKS = List.of("grazie", "thanks", "thx", "gentile");
    private static final List<String> DANCE = List.of("balla", "balliamo", "ballare", "dance");
    private static final List<String> MUSIC = List.of("musica", "canzone", "brano", "pezzo", "metti");
    private static final List<String> HELP = List.of("aiuto", "consiglio", "consigli", "help", "info", "suggerimento");
    private static final List<String> BYE = List.of("bye", "addio", "vado", "notte", "arrivederci");

    /** Nomi leggibili degli oggetti, per le frasi. */
    private static final Map<String, String> ITEM_NAMES = Map.ofEntries(
            Map.entry("coffee", "un caffe'"), Map.entry("cola", "una cola"), Map.entry("juice", "un succo d'arancia"),
            Map.entry("bubble", "una bibita frizzante"), Map.entry("cocktail", "un cocktail al neon"),
            Map.entry("tea", "una tazza di te'"), Map.entry("gelato", "un gelato"), Map.entry("pizza", "un trancio di pizza"),
            Map.entry("book", "un bel libro"), Map.entry("popcorn", "un secchiello di popcorn"),
            Map.entry("water", "una borraccia d'acqua fresca"), Map.entry("latte", "un caffellatte grande"),
            Map.entry("frappe", "un frappe' al caramello con la panna"));

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
            case CHEF -> "Benvenuto in pizzeria, " + user + "! Il forno e' caldo, una margherita?";
            case LIBRARIAN -> "Benvenuto in biblioteca, " + user + ". Sussurra, qui si legge!";
            case NEWSAGENT -> pick(random, List.of("Ciao " + user + "! Giornali, fumetti e pacchetti di carte: cosa ti do?",
                    "Benvenuto in edicola, " + user + "! Cliccami per comprare i pacchetti."));
            case USHER -> "Buona visione, " + user + "! Popcorn e cola li porto io.";
            case TRAINER -> pick(random, List.of("Forza " + user + ", dieci giri di tapis roulant!", "Ciao " + user + "! Ti serve acqua?"));
            case HOCKEY_PLAYER -> pick(random, List.of("Ciao " + user + "! Prendi una mazza e scendi in pista!",
                    "Ehi " + user + ", il ghiaccio e' velocissimo oggi."));
            case TAILOR -> pick(random, List.of("Benvenuto in atelier, " + user + "! Clicca il banco: ti consiglio io come vestirti.",
                    "Ciao " + user + "! Un completo su misura? Prova e ti dico come sta."));
            case MUSICIAN -> pick(random, List.of("Yeah " + user + "! Sali sulla pedana e sfidaci alla gara rock!",
                    "Ciao " + user + "! Stasera si suona forte."));
            case CROUPIER -> pick(random, List.of("Benvenuto al casino, " + user + "! Clicca il tavolo e fai il tuo gioco.",
                    "Buonasera " + user + ". Le fiches si cambiano alla cassa, e oggi ce ne sono anche di regalo.",
                    "Ciao " + user + "! Si accettano puntate: fiches o gold, come preferisci."));
            case CLERK -> pick(random, List.of("Ciao " + user + "! Dai un'occhiata alla merce, il banco e' qui.",
                    "Benvenuto " + user + "! Se qualcosa ti piace, clicca il banco per comprarlo."));
            case FOOTBALLER -> pick(random, List.of("Ciao " + user + "! Passami la palla!",
                    "Ehi " + user + ", giochi con noi? Blu contro Rossi, si arriva a 5!"));
            case FIGHTER -> pick(random, List.of("Ehi " + user + ", hai il coraggio di sfidarmi?",
                    "Ciao " + user + "! Le mie carte sono pronte, e le tue?"));
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
            case BARISTA, WAITER, ICE_CREAM, CHEF, NEWSAGENT, USHER -> "Sono in servizio, ballo dopo il turno!";
            case TRAINER -> "Balla pure, e' un ottimo allenamento! Io conto le ripetizioni.";
            case LIBRARIAN -> "In biblioteca? Shhh!";
            case LIFEGUARD -> "Devo tenere d'occhio la vasca, scusa!";
            default -> "Magari dopo!";
        };
    }

    // ------------------------------------------------------------------ sfide e scambi

    public static String acceptChallenge(String user, Random random) {
        return pick(random, List.of("Accetto, " + user + "! Vediamo cosa sai fare.", "Sfida accettata! Preparati, " + user + ".",
                "Ci sto! Scegli bene le tue carte, " + user + "."));
    }

    public static String refuseChallenge(NpcRoster.Role role) {
        return role == NpcRoster.Role.REFEREE ? "Io arbitro, non gioco! Sfida uno degli sfidanti." : "Adesso non posso, sono gia' impegnato!";
    }

    public static String challengeYou(String user, Random random) {
        return pick(random, List.of(user + ", ti sfido! Accetti?", "Ehi " + user + ", facciamo una partita?",
                "Tu, " + user + "! Sfida a tre round, ci stai?"));
    }

    public static String matchWon(String user) {
        return "Bella partita, " + user + ", ma stavolta ho vinto io!";
    }

    public static String matchLost(String user) {
        return "Complimenti " + user + ", mi hai battuto! La prossima volta non ti va cosi' liscia.";
    }

    public static String matchDraw(String user) {
        return "Pareggio! Sei tosto, " + user + ".";
    }

    public static String tradeOffer(String user, Random random) {
        return pick(random, List.of(user + ", ho una proposta di scambio per te!", "Ehi " + user + ", scambiamo una carta?",
                user + ", guarda cosa ti offro in cambio di una tua doppia!"));
    }

    public static String tradeDone(String user) {
        return "Affare fatto, " + user + "! Goditi la carta nuova.";
    }

    public static String tradeUnfair(String user) {
        return "Mmh, " + user + ", cosi' ci rimetto troppo. Offrimi qualcosa di piu' raro!";
    }

    public static String tradeDeclined(String user) {
        return "Peccato, " + user + ". Magari la prossima volta!";
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

    /** L'istruttrice vede qualcuno cominciare un esercizio (o un gioco). */
    public static String workoutStart(String game, String user, Random random) {
        return switch (game) {
            case "bench" -> pick(random, List.of("Forza " + user + ", schiena dritta e spingi!", "Dai " + user + ", vediamo quante ne fai!"));
            case "run" -> pick(random, List.of("Via, " + user + "! Tieni il ritmo!", "Corri " + user + ", corri!"));
            case "box" -> pick(random, List.of("Guardia alta, " + user + "!", "Destro, sinistro, montante: vai " + user + "!"));
            default -> "Buona fortuna, " + user + "!";
        };
    }

    /** Commento a fine partita, con il punteggio. */
    public static String workoutDone(String unit, String user, int score, boolean record) {
        if (record) return "Record della stanza, " + user + ": " + score + " " + unit + "! Incredibile!";
        if (score == 0) return "Non mollare, " + user + ", la prossima va meglio!";
        return score + " " + unit + ", brava/o " + user + "! Riprova e batti il record.";
    }

    /** Un NPC ha appena aperto un pacchetto e mostra la carta migliore. */
    public static String packOpened(String packName, String cardName, Random random) {
        return pick(random, List.of("Guardate cosa c'era nel mio " + packName + ": " + cardName + "!",
                "Ho appena aperto un " + packName + " e mi e' uscita " + cardName + "!",
                "Evvai, " + cardName + "! Il " + packName + " oggi porta fortuna."));
    }

    /** L'edicolante ha venduto un pacchetto. */
    public static String packSold(String user, String packName, Random random) {
        return pick(random, List.of("Ecco il tuo " + packName + ", " + user + "! Lo trovi nella borsa.",
                packName + " per " + user + ": buona fortuna con le leggendarie!",
                "Affare fatto, " + user + "! Aprilo dalla borsa quando vuoi."));
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
            case CHEF -> List.of("Pizza calda appena sfornata!", "Oggi c'e' la speciale al neon: pomodoro e fiordilatte viola... scherzo!",
                    "Chi vuole un trancio?");
            case LIBRARIAN -> List.of("Shhh, per favore.", "Nuovi arrivi sullo scaffale dei manga.", "I libri si restituiscono entro domani!");
            case NEWSAGENT -> List.of("Pacchetti freschi appena arrivati!", "Il Premium ha una leggendaria garantita, eh!",
                    "Giornali, fumetti, carte VinylDex!");
            case USHER -> List.of("Il film sta per iniziare!", "Popcorn caldi, chi li vuole?", "Spegnete i telefoni, per favore.");
            case TRAINER -> List.of("Uno, due, tre, respira!", "Chi fa una serie di addominali con me?", "Bevete acqua, e' importante!");
            case FOOTBALLER -> List.of("Palla al centro!", "Passala, sono smarcato!", "Che tiro!", "Chi segna vince!");
            case HOCKEY_PLAYER -> List.of("Disco al centro!", "Che velocita' sul ghiaccio!", "Tiro in porta!", "Occhio al bastone!");
            case TAILOR -> List.of("Una giacca deve cadere perfetta sulle spalle.", "Il gessato non passa mai di moda.",
                    "Con lo smoking ci vuole un orologio sottile.", "Chi vuole un consiglio di stile?");
            case CROUPIER -> List.of("Fate il vostro gioco!", "Rien ne va plus.", "Il banco paga!", "Carte in tavola.",
                    "Chi tenta la fortuna stasera?", "Il rosso e' caldo, stasera.");
            case CLERK -> List.of("Arrivata merce nuova!", "Chiedete pure, sono qui per voi.", "Oggi e' il giorno giusto per un regalo.");
            case MUSICIAN -> List.of("Uno, due, tre, quattro!", "Alzate il volume!", "Chi ha il coraggio di battere il mio assolo?",
                    "Questo pezzo e' dedicato a voi!", "Rock and roll!");
            case FIGHTER -> List.of("Chi ha il coraggio di sfidarmi?", "La mia squadra oggi e' imbattibile.",
                    "Scambio carte doppie, chi ci sta?");
            case GUEST -> List.of("Che bella giornata!", "Qualcuno vuole scambiare carte?", "Adoro questo posto.",
                    "Ho appena aperto un pacchetto fortunato!", "Ci vediamo al Neon Bar stasera?");
        });
    }

    public static String smallTalk(NpcRoster.Role role, String user, Random random) {
        return pick(random, switch (role) {
            case BARISTA, WAITER, ICE_CREAM, CHEF, USHER -> List.of("Dimmi pure, " + user + ": cosa ti porto?", "Eccomi, " + user + "! Hai gia' scelto?");
            case NEWSAGENT -> List.of("Vuoi un pacchetto, " + user + "? Cliccami e scegli quale.",
                    "Il Deluxe oggi va a ruba, " + user + "!");
            case RECEPTIONIST, LIBRARIAN, TRAINER -> List.of("Dimmi pure, " + user + ", come posso aiutarti?", "Eccomi, " + user + "!");
            default -> List.of("Dimmi pure, " + user + ".", "Tutto bene, " + user + "?", "Eccomi, " + user + "!");
        });
    }

    /** Il modello non ha risposto e la frase non e' tra quelle che si capiscono a parole chiave. */
    public static String didntCatch(String user, Random random) {
        return pick(random, List.of(
                "Scusa " + user + ", c'e' un gran via vai e non ho capito bene. Me lo ripeti?",
                "Aspetta " + user + ", mi sono distratto un attimo: puoi ridirmelo?",
                "Non sono sicuro di aver capito, " + user + ". Me lo chiedi in un altro modo?"));
    }
}
