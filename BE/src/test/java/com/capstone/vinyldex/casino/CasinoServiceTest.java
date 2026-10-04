package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.RoomRegistry;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Cassa, regalo del giorno e puntate: i saldi tornano sempre, si vinca o si perda. */
class CasinoServiceTest {

    private final UserRepository users = mock(UserRepository.class);
    private final WalletService wallet = mock(WalletService.class);
    private final RoomRegistry registry = mock(RoomRegistry.class);
    private final User user = new User();
    private CasinoService casino;

    @BeforeEach
    void setUp() {
        user.setId(UUID.randomUUID());
        user.setUsername("giocatore");
        user.setGold(1_000);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        when(users.findByIdForUpdate(user.getId())).thenReturn(Optional.of(user));
        // Il portafoglio vero: sposta i gold e rifiuta il saldo negativo.
        when(wallet.adjustGold(eq(user.getId()), anyInt(), eq(WalletTransactionType.CASINO), any(), any())).thenAnswer(inv -> {
            int delta = inv.getArgument(1);
            if (user.getGold() + delta < 0) throw ApiException.insufficientGold();
            user.setGold(user.getGold() + delta);
            return user;
        });
        casino = new CasinoService(users, wallet, registry, new Random(42), false);
    }

    @Test
    @DisplayName("Alla cassa i gold diventano fiches e tornano gold, 1 a 1")
    void cashier() {
        casino.exchange(user.getId(), "buy", 300);
        assertEquals(700, user.getGold());
        assertEquals(300, user.getCasinoChips());
        casino.exchange(user.getId(), "sell", 100);
        assertEquals(800, user.getGold());
        assertEquals(200, user.getCasinoChips());
        assertThrows(ApiException.class, () -> casino.exchange(user.getId(), "sell", 1_000));
    }

    @Test
    @DisplayName("Il regalo di fiches si prende una volta al giorno")
    void dailyBonus() {
        casino.dailyBonus(user.getId());
        assertEquals(CasinoService.DAILY_CHIPS, user.getCasinoChips());
        assertThrows(ApiException.class, () -> casino.dailyBonus(user.getId()));
    }

    @Test
    @DisplayName("Ogni giro scala la puntata e paga la vincita: il saldo finale torna con quanto restituito")
    void spinsKeepTheBooks() {
        casino.exchange(user.getId(), "buy", 500);
        for (int i = 0; i < 50; i++) {
            int before = user.getCasinoChips();
            Map<String, Object> spin = casino.slot(user.getId(), 5, "chips");
            assertEquals(before - 5 + (int) spin.get("returned"), user.getCasinoChips());
        }
        int gold = user.getGold();
        Map<String, Object> wheel = casino.roulette(user.getId(), List.of(new CasinoService.RouletteBet("red", 10),
                new CasinoService.RouletteBet("n:7", 5)), "gold");
        assertEquals(gold - 15 + (int) wheel.get("returned"), user.getGold());
        assertThrows(ApiException.class, () -> casino.slot(user.getId(), 0, "chips"));
        assertThrows(ApiException.class, () -> casino.slot(user.getId(), 5_000, "chips"));
    }

    @Test
    @DisplayName("Blackjack: la carta coperta del banco non si vede finche' la mano non e' finita")
    void blackjackHand() {
        casino.exchange(user.getId(), "buy", 100);
        Map<String, Object> hand = casino.blackjackDeal(user.getId(), 10, "chips");
        if (!(boolean) hand.get("done")) {
            assertEquals("??", ((List<?>) hand.get("dealer")).get(1));
            Map<String, Object> end = casino.blackjackAction(user.getId(), "stand");
            assertTrue((boolean) end.get("done"));
            assertEquals(90 + (int) end.get("returned"), user.getCasinoChips());
        }
        assertThrows(ApiException.class, () -> casino.blackjackAction(user.getId(), "hit"));
    }

    @Test
    @DisplayName("Video poker: si tengono le carte scelte e si paga la mano finale")
    void videoPoker() {
        casino.exchange(user.getId(), "buy", 100);
        Map<String, Object> deal = casino.pokerDeal(user.getId(), 10, "chips");
        List<?> first = (List<?>) deal.get("cards");
        Map<String, Object> end = casino.pokerDraw(user.getId(), List.of(true, true, false, false, false));
        List<?> last = (List<?>) end.get("cards");
        assertEquals(first.get(0), last.get(0));
        assertEquals(first.get(1), last.get(1));
        assertEquals(90 + (int) end.get("returned"), user.getCasinoChips());
    }
}
