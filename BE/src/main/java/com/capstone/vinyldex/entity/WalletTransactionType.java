package com.capstone.vinyldex.entity;

/** Causale di ogni movimento di gold. Ogni variazione di saldo ne registra una. */
public enum WalletTransactionType {
    PACK_OPEN_PAID,
    PACK_OPEN_FREE,
    MARKET_SALE,
    MARKET_PURCHASE,
    TRADE,
    MISSION_REWARD,
    LEVEL_REWARD,
    ALBUM_REWARD,
    DAILY_LOGIN,
    BATTLE_REWARD,
    ADMIN_ADJUST,
    /** Acquisto di un mobile nel negozio dell'hotel. */
    FURNI_PURCHASE,
    /** Ricompensa di una sfida fra giocatori nell'hotel. */
    PVP_REWARD,
    /** Pacchetto comprato in edicola: finisce nella borsa e si apre piu' tardi. */
    PACK_PURCHASE,
    /** Carta rivenduta al negozio dell'hotel in cambio di gold. */
    CARD_BUYBACK,
    /** Premio per un record della stanza in un minigioco dell'hotel. */
    MINIGAME_REWARD,
    /** Carta vinta all'asta dell'hotel. */
    AUCTION,
    /** Carta mandata al perito per il voto. */
    GRADING,
    /** Premio per un set di carte completato. */
    SET_REWARD,
    /** Animale da compagnia: acquisto e cibo. */
    PET,
    /** Premio di un evento a orario dell'hotel. */
    EVENT_REWARD,
    /** Premio della mostra delle collezioni. */
    GALLERY_REWARD,
    /** Sfida della carta del giorno vinta. */
    DAILY_CARD,
    /** Fondazione di un club. */
    CLUB,
    /** Premio per una festa nell'hotel. */
    PARTY,
    /** Compravendita al banchetto di una stanza. */
    STALL,
    /** Gold regalati per posta. */
    MAIL,
    /** Premio di un torneo a eliminazione. */
    TOURNAMENT,
    /** Premio di fine stagione sportiva. */
    SEASON_REWARD,
    /** Capi, orologi e veicoli comprati nei negozi del quartiere. */
    LUXURY,
    /** Casino dell'hotel: fiches alla cassa, puntate e vincite in gold. */
    CASINO,
    /** Tabaccheria, Green Shop e tipo losco della discoteca (SmokeShop). */
    SHOP
}
