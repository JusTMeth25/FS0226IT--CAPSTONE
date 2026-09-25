package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.repository.UserWalletTransactionRepository;
import com.capstone.vinyldex.service.WalletService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Premi in gold per i record dei minigiochi. */
class MinigameRewardServiceTest {

    private final WalletService wallet = mock(WalletService.class);
    private final UserWalletTransactionRepository transactions = mock(UserWalletTransactionRepository.class);
    private final MinigameRewardService service = new MinigameRewardService(wallet, transactions);
    private final Minigames.Game bench = Minigames.forFurni("weight_bench").orElseThrow();
    private final UUID anna = UUID.randomUUID();

    private void rewardedToday(long count) {
        when(transactions.countByUserIdAndTypeAndRelatedIdStartingWithAndCreatedAtAfter(
                eq(anna), eq(WalletTransactionType.MINIGAME_REWARD), eq("minigame:"), any())).thenReturn(count);
    }

    @Test
    @DisplayName("Il premio va da 20 gold (un quarto del massimo) a 50 (punteggio pieno)")
    void goldScale() {
        assertEquals(0, MinigameRewardService.goldFor(bench, 5), "sotto un quarto del massimo niente premio");
        assertEquals(21, MinigameRewardService.goldFor(bench, 8), "appena sopra un quarto");
        Minigames.Game box = Minigames.forFurni("punching_bag").orElseThrow();
        assertEquals(20, MinigameRewardService.goldFor(box, 20), "esattamente un quarto");
        assertEquals(50, MinigameRewardService.goldFor(bench, 30));
        assertEquals(50, MinigameRewardService.goldFor(bench, 99), "mai oltre il massimo");
    }

    @Test
    @DisplayName("Un record vero si paga in gold e scala i premi rimasti oggi")
    void pays() {
        rewardedToday(1);
        MinigameRewardService.Reward reward = service.reward(anna, bench, 30);
        assertEquals(50, reward.gold());
        assertEquals(3, reward.left());
        verify(wallet).adjustGold(eq(anna), eq(50), eq(WalletTransactionType.MINIGAME_REWARD), eq("minigame:bench"), anyString());
    }

    @Test
    @DisplayName("Dopo cinque record premiati nel giorno, o con un punteggio basso, niente gold")
    void limits() {
        rewardedToday(MinigameRewardService.DAILY_REWARDS);
        assertEquals("limit", service.reward(anna, bench, 30).reason());
        rewardedToday(0);
        assertEquals("low_score", service.reward(anna, bench, 2).reason());
        verify(wallet, never()).adjustGold(any(), anyInt(), any(), anyString(), anyString());
    }
}
