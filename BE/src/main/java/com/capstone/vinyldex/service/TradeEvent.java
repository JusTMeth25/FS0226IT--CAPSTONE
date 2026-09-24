package com.capstone.vinyldex.service;

import java.util.UUID;

/**
 * Qualcosa e' cambiato in uno scambio e un giocatore va avvisato.
 *
 * TradeService lo pubblica senza sapere chi ascolta: l'hotel lo inoltra in diretta a chi e'
 * collegato, cosi' lo scambio si vede e si gestisce senza passare dalla pagina Scambi.
 *
 * @param kind      "received", "accepted", "rejected" o "cancelled"
 * @param notifyId  chi deve ricevere l'avviso
 * @param otherName nome dell'altro giocatore coinvolto
 */
public record TradeEvent(UUID tradeId, String kind, UUID notifyId, String otherName) {
}
