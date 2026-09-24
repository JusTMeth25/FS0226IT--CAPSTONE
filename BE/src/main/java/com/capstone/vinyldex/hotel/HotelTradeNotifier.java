package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.service.TradeEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * Inoltra gli eventi degli scambi a chi e' collegato all'hotel, in diretta.
 *
 * Parte solo a transazione confermata: se lo scambio fallisse a meta' (carte insufficienti,
 * gold mancanti) nessuno riceverebbe un avviso per qualcosa che non e' successo.
 */
@Component
public class HotelTradeNotifier {

    private final RoomRegistry registry;

    public HotelTradeNotifier(RoomRegistry registry) {
        this.registry = registry;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTrade(TradeEvent event) {
        HotelSession session = registry.sessionOf(event.notifyId());
        if (session == null) return;
        session.send(Map.of("type", "trade_event", "kind", event.kind(), "tradeId", event.tradeId(),
                "other", event.otherName()));
    }
}
