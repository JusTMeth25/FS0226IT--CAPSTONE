package com.capstone.vinyldex.hotel;

import java.util.regex.Pattern;

/**
 * Aspetto dell'avatar nell'hotel, come codice compatto: "s2.h3.hc1.sh4.p2".
 *
 * Ogni parte e' l'indice di una variante disegnata dal frontend (src/hotel/sprites/avatar.js):
 * s = carnagione, h = taglio di capelli, hc = colore dei capelli, sh = maglia, p = pantaloni.
 * Il server non conosce i colori, controlla solo che gli indici esistano: cosi' un client
 * modificato non puo' salvare valori che gli altri non saprebbero disegnare.
 */
public final class HotelLook {

    public static final String DEFAULT = "s1.h1.hc0.sh0.p0";

    private static final Pattern FORMAT = Pattern.compile("s[0-3]\\.h[0-5]\\.hc[0-7]\\.sh[0-9]\\.p[0-7]");

    private HotelLook() {
    }

    public static boolean isValid(String look) {
        return look != null && FORMAT.matcher(look).matches();
    }

    /** L'aspetto salvato, oppure quello predefinito se manca o non e' piu' valido. */
    public static String orDefault(String look) {
        return isValid(look) ? look : DEFAULT;
    }
}
