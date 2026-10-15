package com.capstone.vinyldex.service;

import java.time.Duration;

/**
 * Quanti scambi si possono concludere: al massimo PER_WINDOW ogni WINDOW, contati a parte per gli
 * scambi con gli NPC (NpcDeals) e per quelli fra giocatori (TradeService). La finestra scorre:
 * conta quanti scambi ci sono stati negli ultimi 30 minuti, non da un orario fisso.
 */
public final class TradeLimits {

    public static final int PER_WINDOW = 5;
    public static final Duration WINDOW = Duration.ofMinutes(30);

    private TradeLimits() {
    }
}
