package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserPackCredit;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.PackOpeningCardRepository;
import com.capstone.vinyldex.repository.PackOpeningRepository;
import com.capstone.vinyldex.repository.PackRepository;
import com.capstone.vinyldex.repository.UserPackCreditRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Acquisto in edicola: si pagano i gold e il pacchetto finisce nella borsa, senza aprirlo. */
class PackServiceBuyTest {

    private final PackRepository packs = mock(PackRepository.class);
    private final UserPackCreditRepository credits = mock(UserPackCreditRepository.class);
    private final WalletService wallet = mock(WalletService.class);
    private PackService service;
    private final User anna = new User();
    private final Pack deluxe = new Pack();

    @BeforeEach
    void setUp() {
        service = new PackService(packs, mock(UserRepository.class), credits, mock(PackOpeningRepository.class),
                mock(PackOpeningCardRepository.class), mock(PackGenerator.class), wallet, mock(UserCardService.class),
                mock(MissionEngine.class));
        anna.setId(UUID.randomUUID());
        anna.setGold(400);
        deluxe.setId(UUID.randomUUID());
        deluxe.setCode("pack-deluxe");
        deluxe.setName("Pacchetto Deluxe");
        deluxe.setPriceGold(100);
        when(packs.findByCodeWithRates("pack-deluxe")).thenReturn(Optional.of(deluxe));
        when(wallet.adjustGold(eq(anna.getId()), eq(-100), eq(WalletTransactionType.PACK_PURCHASE), anyString(), anyString()))
                .thenAnswer(inv -> {
                    anna.setGold(anna.getGold() - 100);
                    return anna;
                });
    }

    @Test
    @DisplayName("Il primo acquisto crea il pacchetto nella borsa e scala il prezzo")
    void firstPurchase() {
        when(credits.findByUserIdAndPackCode(anna.getId(), "pack-deluxe")).thenReturn(Optional.empty());

        PackService.PackPurchase result = service.buyPack(anna.getId(), "pack-deluxe");

        ArgumentCaptor<UserPackCredit> saved = ArgumentCaptor.forClass(UserPackCredit.class);
        verify(credits).save(saved.capture());
        assertEquals(1, saved.getValue().getQuantity());
        assertEquals("pack-deluxe", saved.getValue().getPackCode());
        assertEquals(1, result.owned());
        assertEquals(300, result.gold());
    }

    @Test
    @DisplayName("Gli acquisti successivi si sommano ai pacchetti gia' nella borsa")
    void addsToExisting() {
        when(credits.findByUserIdAndPackCode(anna.getId(), "pack-deluxe"))
                .thenReturn(Optional.of(new UserPackCredit(anna, "pack-deluxe", 2)));

        assertEquals(3, service.buyPack(anna.getId(), "pack-deluxe").owned());
    }

    @Test
    @DisplayName("Senza gold abbastanza non si compra nulla")
    void notEnoughGold() {
        when(wallet.adjustGold(eq(anna.getId()), anyInt(), any(), anyString(), anyString()))
                .thenThrow(ApiException.insufficientGold());

        assertThrows(ApiException.class, () -> service.buyPack(anna.getId(), "pack-deluxe"));
        verify(credits, never()).save(any());
    }
}
