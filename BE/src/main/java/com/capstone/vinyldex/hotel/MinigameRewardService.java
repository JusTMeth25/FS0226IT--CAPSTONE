package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.repository.UserWalletTransactionRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Premi in gold per i record dei minigiochi.
 *
 * I record sono della stanza e si azzerano quando la stanza si svuota: da soli in una stanza
 * appena riaperta qualunque punteggio sarebbe un record. Per questo si premia solo un punteggio
 * vero (almeno un quarto del massimo del gioco) e al massimo qualche record al giorno, contati
 * nel portafoglio cosi' valgono anche dopo un riavvio del server.
 */
@Service
public class MinigameRewardService {

    /** Record premiati al giorno per giocatore. */
    public static final int DAILY_REWARDS = 5;
    /** Premio minimo e massimo: si parte dal minimo e si sale con il punteggio. */
    static final int BASE_GOLD = 20;
    static final int MAX_GOLD = 50;
    /** Sotto questa frazione del punteggio massimo il record non e' premiato. */
    static final double MIN_FRACTION = 0.25;

    public record Reward(int gold, int left, String reason) {
    }

    private final WalletService walletService;
    private final UserWalletTransactionRepository transactionRepository;
    private final Clock clock = Clock.systemDefaultZone();

    public MinigameRewardService(WalletService walletService, UserWalletTransactionRepository transactionRepository) {
        this.walletService = walletService;
        this.transactionRepository = transactionRepository;
    }

    /** Gold per un record: 20 con un quarto del massimo, fino a 50 con il punteggio pieno. */
    static int goldFor(Minigames.Game game, int score) {
        double fraction = Math.min(1, (double) score / game.maxScore());
        if (fraction < MIN_FRACTION) return 0;
        return BASE_GOLD + (int) Math.round((MAX_GOLD - BASE_GOLD) * (fraction - MIN_FRACTION) / (1 - MIN_FRACTION));
    }

    /**
     * Premia un nuovo record della stanza.
     *
     * @return gold dati (0 se il punteggio e' troppo basso o i premi di oggi sono finiti), record
     * premiati ancora possibili oggi e, se non c'e' premio, il perche'
     */
    @Transactional
    public Reward reward(UUID userId, Minigames.Game game, int score) {
        Instant startOfDay = LocalDate.now(clock).atStartOfDay(clock.getZone()).toInstant();
        long today = transactionRepository.countByUserIdAndTypeAndRelatedIdStartingWithAndCreatedAtAfter(
                userId, WalletTransactionType.MINIGAME_REWARD, "minigame:", startOfDay);
        int left = (int) Math.max(0, DAILY_REWARDS - today);
        if (left == 0) return new Reward(0, 0, "limit");
        int gold = goldFor(game, score);
        if (gold == 0) return new Reward(0, left, "low_score");
        walletService.adjustGold(userId, gold, WalletTransactionType.MINIGAME_REWARD, "minigame:" + game.key(),
                "Record della stanza: " + game.title() + ", " + score + " " + game.unit());
        return new Reward(gold, left - 1, null);
    }
}
