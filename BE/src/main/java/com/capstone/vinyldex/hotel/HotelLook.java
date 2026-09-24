package com.capstone.vinyldex.hotel;

import java.util.regex.Pattern;

/**
 * Aspetto dell'avatar nell'hotel, come codice compatto: "s2.h3.hc1.sh4.p2.t1.f0.a3".
 *
 * Ogni parte e' l'indice di una variante disegnata dal frontend (src/hotel/sprites/avatar.js):
 * s = carnagione, h = taglio di capelli, hc = colore dei capelli, sh = colore della maglia,
 * p = pantaloni, t = tipo di maglia, f = scarpe, a = accessorio. Le ultime tre sono arrivate
 * dopo e sono facoltative: i codici salvati prima restano validi.
 * Il server non conosce i colori, controlla solo che gli indici esistano: cosi' un client
 * modificato non puo' salvare valori che gli altri non saprebbero disegnare.
 */
public final class HotelLook {

    public static final String DEFAULT = "s1.h1.hc0.sh0.p0.t0.f0.a0";

    private static final Pattern FORMAT = Pattern.compile(
            "s[0-5]\\.h[0-9]\\.hc[0-9]\\.sh(?:[0-9]|1[01])\\.p[0-7](?:\\.t[0-4]\\.f[0-5]\\.a[0-6])?");

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
