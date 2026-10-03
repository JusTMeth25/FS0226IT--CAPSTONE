package com.capstone.vinyldex.hotel;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Merci dei negozi del quartiere: capi firmati (parte "o" del codice aspetto), orologi ("w"),
 * veicoli ("r"), collane ("n"), orecchini ("e") e chitarre ("g"). La chiave e' la parte seguita dall'indice:
 * "o3" e' il terzo capo.
 *
 * I nomi dei marchi sono inventati (con un occhio alle case vere): orologi e auto non sono
 * prodotti ufficiali. I disegni stanno nel frontend (src/hotel/sprites/avatar.js e vehicles.js;
 * le auto usano i modelli 3D di Sketchfab, vedi BE/scripts/sketchfab_cars.py) con gli stessi
 * indici; HotelLook controlla quanti ce ne sono.
 */
public final class LuxuryCatalog {

    /** Negozi del quartiere: ognuno vende una parte. */
    public static final String ATELIER = "atelier";
    public static final String WATCHES = "orologi";
    public static final String SKATE = "skate";
    public static final String BIKES = "bici";
    public static final String CARS = "auto";
    public static final String GUITARS = "chitarre";
    public static final String ROCK = "rock";

    /** @param speed solo per i veicoli: caselle per passo (1 a piedi) */
    public record Item(String key, String part, int index, String name, String brand, String shop, int price, int speed,
                       String description) {
    }

    public static final List<Item> ITEMS = List.of(
            // Atelier: abiti e capi di sartoria. Si indossano sopra maglia e pantaloni.
            outfit(1, "Completo gessato", "Sartoria Vinile", 900, "Blu notte con la riga sottile, cravatta di seta."),
            outfit(2, "Smoking", "Sartoria Vinile", 1500, "Nero con i revers lucidi e il papillon."),
            outfit(3, "Abito da sera", "Maison Aurora", 1400, "Lungo, rosso rubino, con lo spacco."),
            outfit(4, "Cappotto cammello", "Maison Aurora", 1100, "Lana e cashmere, doppio petto."),
            outfit(5, "Giacca di pelle", "Strada Nera", 700, "Chiodo nero con le zip argento."),
            outfit(6, "Tuta firmata", "Strada Nera", 500, "Tuta di velluto con le bande laterali."),
            outfit(7, "Blazer bianco", "Riviera", 1200, "Doppio petto bianco e pantaloni blu, da yacht."),
            outfit(8, "Abito di paillettes", "Maison Aurora", 2000, "Tutto oro, brilla sotto le luci."),
            outfit(9, "Trench", "Riviera", 950, "Beige con la cintura in vita, per la pioggia elegante."),
            outfit(10, "Smoking bianco", "Sartoria Vinile", 1700, "Giacca bianca, pantaloni neri e papillon: gran gala."),
            outfit(11, "Giacca di velluto", "Sartoria Vinile", 1100, "Velluto bordeaux, camicia aperta, niente cravatta."),
            outfit(12, "Kimono di seta", "Maison Aurora", 1600, "Seta blu notte con i fiori di ciliegio e l'obi rosso."),
            outfit(13, "Tailleur rosa", "Maison Aurora", 1300, "Giacca e pantaloni rosa cipria con i bottoni d'oro."),
            // Rock Store: abbigliamento da palco.
            rock(14, "Gilet borchiato", "Amplificato", 650, "Pelle nera con le borchie, jeans strappati."),
            rock(15, "Maglia della band", "Amplificato", 300, "T-shirt nera dei Vinyl Thunder e jeans neri attillati."),
            rock(16, "Camicia di flanella", "Garage 91", 350, "Quadri rossi e neri aperti su una maglia grigia."),
            rock(17, "Tuta glam leopardata", "Glam Palace", 900, "Anni 80, tutta maculata, con la cintura d'argento."),
            rock(18, "Giacca di jeans con toppe", "Garage 91", 550, "Toppe delle band e spille, sopra una maglia bianca."),
            rock(19, "Completo di pelle rossa", "Glam Palace", 1200, "Giacca e pantaloni di pelle rossa con le zip."),
            // Gioielleria: orologi al polso.
            watch(1, "Submarino", "Rolaix", 2500, "Acciaio con la ghiera verde, subacqueo."),
            watch(2, "Daytona d'oro", "Rolaix", 4500, "Cronografo in oro giallo, quadrante champagne."),
            watch(3, "Nautilo", "Patec Philippa", 5000, "Acciaio con il quadrante blu a righe orizzontali."),
            watch(4, "Calatrava", "Patec Philippa", 4000, "Oro rosa, sottile e classico, cinturino in pelle."),
            watch(5, "Quercia Reale", "Audemar Piguay", 5500, "Cassa ottagonale in acciaio, otto viti a vista."),
            watch(6, "Offshore Nero", "Audemar Piguay", 6000, "Ceramica nera e gomma, per chi va di fretta."),
            watch(7, "GMT Pepsi", "Rolaix", 3500, "Ghiera rossa e blu per due fusi orari, bracciale jubilee."),
            watch(8, "Day-Date Platino", "Rolaix", 7500, "Platino con il quadrante azzurro ghiaccio."),
            watch(9, "Aquanaut Verde", "Patec Philippa", 5200, "Cinturino in gomma e quadrante verde a scacchi."),
            watch(10, "Codice 11.59", "Audemar Piguay", 6800, "Oro rosa, cassa rotonda, quadrante blu profondo."),
            watch(11, "RM Scheletrato", "Richard Milla", 9500, "Cassa a botte e movimento a vista, cinturino rosso."),
            // Gioielleria: collane e orecchini.
            jewel("n", 1, "Collana di perle", "Maison Aurora", 1200, "Un filo di perle bianche, classico da sera."),
            jewel("n", 2, "Catena d'oro", "Strada Nera", 1800, "Catena cubana spessa in oro giallo."),
            jewel("n", 3, "Riviera di diamanti", "Maison Aurora", 5000, "Diamanti in fila che brillano a ogni passo."),
            jewel("n", 4, "Pendente smeraldo", "Riviera", 3200, "Una goccia di smeraldo su una catenina d'oro."),
            jewel("n", 5, "Collier di rubini", "Maison Aurora", 4200, "Rubini incastonati in oro bianco."),
            jewel("n", 6, "Medaglione d'oro", "Sartoria Vinile", 900, "Medaglione tondo con il disco inciso."),
            jewel("e", 1, "Punti luce", "Maison Aurora", 1500, "Due diamanti, piccoli e brillanti."),
            jewel("e", 2, "Cerchi d'oro", "Strada Nera", 700, "Cerchi grandi in oro giallo."),
            jewel("e", 3, "Perle pendenti", "Maison Aurora", 900, "Perle che scendono da un gancetto d'oro."),
            jewel("e", 4, "Gocce di smeraldo", "Riviera", 2200, "Smeraldi a goccia, verde intenso."),
            jewel("e", 5, "Rubini", "Maison Aurora", 1900, "Due rubini rotondi montati in oro."),
            jewel("e", 6, "Zaffiri", "Maison Aurora", 2400, "Zaffiri blu con il contorno di brillanti."),
            // Skate shop, negozio di bici e concessionaria: si guidano nelle stanze all'aperto.
            ride(1, "Skateboard street", "Skate Vinile", SKATE, 150, 2, "Tavola corta con le ruote al neon."),
            ride(2, "Longboard", "Skate Vinile", SKATE, 250, 2, "Lungo e morbido, per le discese."),
            ride(3, "BMX", "Ruota Libera", BIKES, 350, 2, "Telaio basso per i salti."),
            ride(4, "Bici da corsa", "Ruota Libera", BIKES, 600, 3, "Carbonio e manubrio da corsa."),
            ride(5, "Spider rossa", "Ferraro", CARS, 6000, 4, "V8 rosso corsa, cabriolet."),
            ride(6, "Toro giallo", "Lamborgo", CARS, 8000, 4, "Linee a spigolo, porte ad ali."),
            ride(7, "Novecento undici", "Porsa", CARS, 5000, 4, "Coupe' bianca, motore dietro."),
            ride(8, "Hypercar nera", "Bugatto", CARS, 12000, 5, "Nera e bianca, linee da astronave: la piu' veloce del quartiere."),
            ride(9, "Coupe' blu", "Lotto", CARS, 7000, 4, "Coupe' sportiva bassa e leggera, blu elettrico."),
            // Rock Store: chitarre e bassi. Si portano a tracolla e si suonano nella gara rock.
            guitar(1, "Chitarra classica", "Liuteria Vinile", 400, "Corde di nylon e cassa di cedro: arpeggi e flamenco."),
            guitar(2, "Acustica western", "Liuteria Vinile", 700, "Corde di metallo, cassa grande, suono pieno da falo'."),
            guitar(3, "Stratosfera rossa", "Fendra", 1200, "Rossa come il controller di Rock Band 4: il suono del rock classico."),
            guitar(4, "Les Pauline bianca", "Gibbon", 1800, "Bianca come il controller di Guitar Hero III: il suono grosso dell'hard rock."),
            guitar(5, "Volo V bianca", "Gibbon", 1600, "La V del controller di Guitar Hero: Metallica, per gli assoli anni 80."),
            guitar(6, "Esplosiva nera", "Gibbon", 1700, "Le ali a spigoli del controller di Guitar Hero: Warriors of Rock, per il metal."),
            guitar(7, "Basso Precisione", "Fendra", 1000, "Quattro corde, blu, il basso di tutte le band."),
            guitar(8, "Basso Jazzista", "Fendra", 1100, "Manico sottile e suono ricco, finitura sunburst."),
            guitar(9, "Doppio manico", "Gibbon", 3000, "Dodici e sei corde insieme, per le ballate epiche."),
            guitar(10, "SG da palco nera", "Gibbon", 2200, "Le doppie corna e i cinque tasti colorati del controller di Guitar Hero II."),
            guitar(11, "Jaguaro azzurra", "Fendra", 1500, "Il controller di Rock Band 4: spalla sfalsata e suono pulito da surf rock."));

    private static final Map<String, Item> BY_KEY = ITEMS.stream().collect(Collectors.toMap(Item::key, Function.identity()));

    /** Quante varianti ha ogni parte (compreso lo zero, "niente"). */
    public static final int OUTFITS = 20;
    public static final int WATCH_COUNT = 12;
    public static final int RIDES = 10;
    public static final int NECKLACES = 7;
    public static final int GUITAR_COUNT = 12;
    public static final int EARRINGS = 7;

    private LuxuryCatalog() {
    }

    private static Item outfit(int index, String name, String brand, int price, String description) {
        return new Item("o" + index, "o", index, name, brand, ATELIER, price, 1, description);
    }

    private static Item watch(int index, String name, String brand, int price, String description) {
        return new Item("w" + index, "w", index, name, brand, WATCHES, price, 1, description);
    }

    private static Item rock(int index, String name, String brand, int price, String description) {
        return new Item("o" + index, "o", index, name, brand, ROCK, price, 1, description);
    }

    private static Item guitar(int index, String name, String brand, int price, String description) {
        return new Item("g" + index, "g", index, name, brand, GUITARS, price, 1, description);
    }

    private static Item jewel(String part, int index, String name, String brand, int price, String description) {
        return new Item(part + index, part, index, name, brand, WATCHES, price, 1, description);
    }

    private static Item ride(int index, String name, String brand, String shop, int price, int speed, String description) {
        return new Item("r" + index, "r", index, name, brand, shop, price, speed, description);
    }

    public static Optional<Item> get(String key) {
        return Optional.ofNullable(key == null ? null : BY_KEY.get(key));
    }

    /** Caselle per passo con il veicolo del codice aspetto (1 a piedi o senza veicolo). */
    public static int speedOf(String look) {
        int ride = HotelLook.part(look, "r");
        return ride <= 0 ? 1 : get("r" + ride).map(Item::speed).orElse(1);
    }
}
