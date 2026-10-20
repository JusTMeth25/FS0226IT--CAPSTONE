package com.capstone.vinyldex.service;

import java.util.UUID;

/**
 * Sa se un giocatore e' impegnato in qualcosa che non va interrotto (sfida, torneo, minigioco,
 * battaglia contro gli NPC). L'implementazione sta nell'hotel (HotelActivity), che conosce le
 * partite in corso; qui serve a TradeService per non recapitare proposte in quel momento.
 */
public interface UserActivity {

    boolean isBusy(UUID userId);

    /**
     * Battaglia contro gli NPC nella pagina Battaglie (la gioca il client): iniziata o finita.
     * Se il client non dice "finita" (pagina chiusa a meta') scade da sola.
     */
    void setInBattle(UUID userId, boolean inBattle);
}
