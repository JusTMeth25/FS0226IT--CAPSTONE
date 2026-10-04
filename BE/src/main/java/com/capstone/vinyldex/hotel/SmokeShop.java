package com.capstone.vinyldex.hotel;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Catalogo di tabaccheria, Green Shop (erba light) e del tipo losco della discoteca.
 *
 * Tutto finto, come le bibite del bar: l'oggetto finisce in mano all'avatar e ogni tiro (il
 * pulsante "Fuma" dell'hotel) fa uscire il fumo. Erba e "roba" del tipo losco danno anche un
 * effetto per un po': l'avatar rilassato in una nuvola verde, o il "trip" arcobaleno che fa ballare.
 */
public final class SmokeShop {

    public static final String TOBACCO = "tabacchi";
    public static final String GREEN = "green";
    public static final String DEALER = "dealer";

    /**
     * @param puffs   tiri prima che finisca (o 1: si ingoia)
     * @param effect  null, "chill" (erba) o "trip" (roba del tipo losco)
     * @param effectMillis quanto dura l'effetto dall'ultimo tiro
     */
    public record Item(String id, String name, String shop, int price, int puffs, String effect, long effectMillis, String text) {
    }

    private static final Map<String, Item> ITEMS = new LinkedHashMap<>();

    static {
        add(new Item("cigarette", "Sigaretta", TOBACCO, 8, 5, null, 0, "Una bionda classica, cinque tiri."));
        add(new Item("cigar", "Sigaro cubano", TOBACCO, 40, 8, null, 0, "Arrotolato a mano, da gustare con calma."));
        add(new Item("pipe", "Pipa", TOBACCO, 25, 7, null, 0, "Tabacco aromatico alla vaniglia, da vecchio lupo di mare."));
        add(new Item("joint", "Canna", GREEN, 25, 6, "chill", 120_000, "Erba light gia' rollata: rilassa e mette fame."));
        add(new Item("blunt", "Spinello XL", GREEN, 50, 10, "chill", 240_000, "Il formato da condividere (ma fuma solo chi lo tiene)."));
        add(new Item("bong", "Bong", GREEN, 60, 4, "chill", 300_000, "Vetro soffiato e bolle: pochi tiri, tanta nuvola."));
        add(new Item("pill", "Pasticca arcobaleno", DEALER, 60, 1, "trip", 90_000, "Fa vedere tutto a colori e balli da solo. Non chiedere cosa c'e' dentro."));
        add(new Item("mushroom", "Funghetto magico", DEALER, 45, 1, "trip", 120_000, "Il pavimento respira e i muri cambiano colore."));
    }

    private SmokeShop() {
    }

    private static void add(Item item) {
        ITEMS.put(item.id(), item);
    }

    public static Item item(String id) {
        return id == null ? null : ITEMS.get(id);
    }

    public static List<Item> shop(String shop) {
        return ITEMS.values().stream().filter(i -> i.shop().equals(shop)).toList();
    }

    public static boolean isSmoke(String handItem) {
        return ITEMS.containsKey(handItem);
    }
}
