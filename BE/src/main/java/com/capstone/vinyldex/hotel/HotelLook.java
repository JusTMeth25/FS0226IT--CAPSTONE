package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Aspetto dell'avatar nell'hotel, come codice compatto: "s2.h3.hc1.sh4.p2.t1.f0.a3.b0".
 *
 * Ogni parte e' l'indice di una variante disegnata dal frontend (src/hotel/sprites/avatar.js):
 * s = carnagione, h = taglio di capelli, hc = colore dei capelli, sh = colore della maglia,
 * p = pantaloni, t = tipo di maglia, f = scarpe, a = accessorio, b = corporatura (0 uomo,
 * 1 donna). Le parti dopo i pantaloni sono arrivate dopo e sono facoltative: i codici salvati
 * prima restano validi, e senza corporatura vale "uomo". Poi i pezzi dei negozi del quartiere
 * (LuxuryCatalog): o = capo firmato, w = orologio, r = veicolo, poi facoltativi n = collana ed
 * e = orecchini; zero vuol dire niente. Questi si
 * indossano solo se comprati (lo controlla WardrobeService).
 * Il server non conosce i colori, controlla solo che gli indici esistano: cosi' un client
 * modificato non puo' salvare valori che gli altri non saprebbero disegnare.
 */
public final class HotelLook {

    public static final String DEFAULT = "s1.h1.hc0.sh0.p0.t0.f0.a0.b0";

    /** Tipo di maglia "petto nudo": solo per la corporatura da uomo. */
    static final int BARE_CHEST = 5;

    private static final Pattern FORMAT = Pattern.compile(
            "s[0-5]\\.h[0-9]\\.hc[0-9]\\.sh(?:[0-9]|1[01])\\.p[0-7](?:\\.t([0-5])\\.f[0-5]\\.a[0-6](?:\\.b([01])"
                    + "(?:\\.o(?:[0-9]|1[0-3])\\.w(?:[0-9]|1[01])\\.r[0-9](?:\\.n[0-6]\\.e[0-6])?)?)?)?");

    private HotelLook() {
    }

    public static boolean isValid(String look) {
        if (look == null) return false;
        var match = FORMAT.matcher(look);
        if (!match.matches()) return false;
        boolean bareChest = match.group(1) != null && Integer.parseInt(match.group(1)) == BARE_CHEST;
        boolean woman = "1".equals(match.group(2));
        return !(bareChest && woman);
    }

    /** Indice di una parte del codice ("o", "w", "r"...), 0 se manca. */
    public static int part(String look, String key) {
        if (look == null) return 0;
        for (String piece : look.split("\\.")) {
            String digits = piece.startsWith(key) ? piece.substring(key.length()) : "";
            if (!digits.isEmpty() && digits.chars().allMatch(Character::isDigit)) return Integer.parseInt(digits);
        }
        return 0;
    }

    /** Pezzi dei negozi indossati, come chiavi del catalogo ("o3", "w1", "r5"). */
    public static List<String> luxuryItems(String look) {
        List<String> items = new ArrayList<>();
        for (String key : new String[]{"o", "w", "r", "n", "e"}) {
            int index = part(look, key);
            if (index > 0) items.add(key + index);
        }
        return items;
    }

    /** L'aspetto salvato, oppure quello predefinito se manca o non e' piu' valido. */
    public static String orDefault(String look) {
        return isValid(look) ? look : DEFAULT;
    }
}
