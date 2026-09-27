package com.capstone.vinyldex.hotel;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Merci dei negozi del quartiere: capi firmati (parte "o" del codice aspetto), orologi ("w") e
 * veicoli ("r"). La chiave e' la parte seguita dall'indice: "o3" e' il terzo capo.
 *
 * I nomi dei marchi sono inventati (con un occhio alle case vere): orologi e auto non sono
 * prodotti ufficiali. I disegni stanno nel frontend (src/hotel/sprites/avatar.js e vehicles.js)
 * con gli stessi indici; HotelLook controlla quanti ce ne sono.
 */
public final class LuxuryCatalog {

    /** Negozi del quartiere: ognuno vende una parte. */
    public static final String ATELIER = "atelier";
    public static final String WATCHES = "orologi";
    public static final String SKATE = "skate";
    public static final String BIKES = "bici";
    public static final String CARS = "auto";

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
            // Gioielleria: orologi al polso.
            watch(1, "Submarino", "Rolaix", 2500, "Acciaio con la ghiera verde, subacqueo."),
            watch(2, "Daytona d'oro", "Rolaix", 4500, "Cronografo in oro giallo, quadrante champagne."),
            watch(3, "Nautilo", "Patec Philippa", 5000, "Acciaio con il quadrante blu a righe orizzontali."),
            watch(4, "Calatrava", "Patec Philippa", 4000, "Oro rosa, sottile e classico, cinturino in pelle."),
            watch(5, "Quercia Reale", "Audemar Piguay", 5500, "Cassa ottagonale in acciaio, otto viti a vista."),
            watch(6, "Offshore Nero", "Audemar Piguay", 6000, "Ceramica nera e gomma, per chi va di fretta."),
            // Skate shop, negozio di bici e concessionaria: si guidano nelle stanze all'aperto.
            ride(1, "Skateboard street", "Skate Vinile", SKATE, 150, 2, "Tavola corta con le ruote al neon."),
            ride(2, "Longboard", "Skate Vinile", SKATE, 250, 2, "Lungo e morbido, per le discese."),
            ride(3, "BMX", "Ruota Libera", BIKES, 350, 2, "Telaio basso per i salti."),
            ride(4, "Bici da corsa", "Ruota Libera", BIKES, 600, 3, "Carbonio e manubrio da corsa."),
            ride(5, "Spider rossa", "Ferraro", CARS, 6000, 4, "V8 rosso corsa, cabriolet."),
            ride(6, "Toro giallo", "Lamborgo", CARS, 8000, 4, "Linee a spigolo, porte ad ali."),
            ride(7, "Novecento undici", "Porsa", CARS, 5000, 4, "Coupe' bianca, motore dietro."),
            ride(8, "Hypercar nera", "Bugatto", CARS, 12000, 5, "Nera e blu, la piu' veloce del quartiere."));

    private static final Map<String, Item> BY_KEY = ITEMS.stream().collect(Collectors.toMap(Item::key, Function.identity()));

    /** Quante varianti ha ogni parte (compreso lo zero, "niente"). */
    public static final int OUTFITS = 9;
    public static final int WATCH_COUNT = 7;
    public static final int RIDES = 9;

    private LuxuryCatalog() {
    }

    private static Item outfit(int index, String name, String brand, int price, String description) {
        return new Item("o" + index, "o", index, name, brand, ATELIER, price, 1, description);
    }

    private static Item watch(int index, String name, String brand, int price, String description) {
        return new Item("w" + index, "w", index, name, brand, WATCHES, price, 1, description);
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
