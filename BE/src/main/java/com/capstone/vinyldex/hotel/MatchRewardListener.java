package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.service.WalletService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** Premi delle partite a squadre allo stadio e delle gare di go-kart. */
@Component
public class MatchRewardListener {

    private static final Logger LOG = LoggerFactory.getLogger(MatchRewardListener.class);
    static final int WIN = 40;
    static final int DRAW = 20;
    static final int LOSS = 10;

    private final WalletService walletService;
    private final RoomRegistry registry;

    public MatchRewardListener(WalletService walletService, RoomRegistry registry) {
        this.walletService = walletService;
        this.registry = registry;
    }

    @EventListener
    public void onMatch(HotelGameEvents.MatchPlayed event) {
        event.winners().forEach(id -> pay(id, event.draw() ? DRAW : WIN, event.draw() ? "Stadio: partita pareggiata" : "Stadio: partita vinta"));
        event.losers().forEach(id -> pay(id, LOSS, "Stadio: partita giocata"));
    }

    static final int[] KART_PRIZES = {60, 30, 15};

    @EventListener
    public void onKartRace(HotelGameEvents.KartRaceFinished event) {
        for (int i = 0; i < event.order().size() && i < KART_PRIZES.length; i++) {
            pay(event.order().get(i), KART_PRIZES[i], "Gara di go-kart, " + (i + 1) + "° posto");
        }
    }

    static final int QUIZ_PRIZE = 30;

    @EventListener
    public void onQuiz(HotelGameEvents.QuizWon event) {
        pay(event.userId(), QUIZ_PRIZE, "Quiz: hai indovinato " + event.cardName());
    }

    private void pay(UUID userId, int gold, String note) {
        try {
            walletService.adjustGold(userId, gold, WalletTransactionType.MINIGAME_REWARD, "match", note);
            HotelSession session = registry.sessionOf(userId);
            if (session != null) session.send(Map.of("type", "match_reward", "gold", gold, "note", note));
        } catch (RuntimeException ex) {
            LOG.warn("Premio partita non pagato a {}: {}", userId, ex.getMessage());
        }
    }
}
