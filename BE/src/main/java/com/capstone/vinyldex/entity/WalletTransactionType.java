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
    PACK_PURCHASE
}
