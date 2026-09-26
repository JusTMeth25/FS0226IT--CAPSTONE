package com.capstone.vinyldex.service;

/**
 * Valori ammessi per Mission.type.
 *
 * Restano stringhe e non un enum perche' l'amministratore crea le missioni dal pannello
 * e i valori sono gia' salvati cosi' nei dati esistenti. Le costanti evitano i refusi.
 */
public final class MissionType {

    private MissionType() {
    }

    /** Contatore: quanti pacchetti sono stati aperti. */
    public static final String OPEN_PACKS = "open_packs";

    /** Contatore: quante carte sono state ottenute in totale, duplicati compresi. */
    public static final String COLLECT_CARDS = "collect_cards";

    /** Contatore per rarita': la rarita' da conteggiare sta in Mission.metadata.rarity. */
    public static final String COLLECT_RARITY = "collect_rarity";

    /** Contatore: quante vendite concluse sul mercato. */
    public static final String SELL_MARKET = "sell_market";

    /** Contatore: quanti acquisti conclusi sul mercato. */
    public static final String BUY_MARKET = "buy_market";

    /** Valore assoluto: quante carte distinte possiede l'utente. */
    public static final String COLLECT_CARDS_UNIQUE = "collect_cards_unique";

    /** Valore assoluto: percentuale di catalogo completata. */
    public static final String ALBUM_PERCENT = "album_percent";

    /** Contatore: gol segnati allo stadio dell'hotel. */
    public static final String HOTEL_GOAL = "hotel_goal";

    /**
     * Contatore: partite ai minigiochi dell'hotel. In metadata: game (facoltativo, "golf" vale
     * per tutte le buche) e minScore, il punteggio minimo perche' la partita conti.
     */
    public static final String HOTEL_MINIGAME = "hotel_minigame";
}
