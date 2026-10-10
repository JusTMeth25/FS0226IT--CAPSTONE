package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.PackDropRate;
import com.capstone.vinyldex.entity.PackGuarantee;
import com.capstone.vinyldex.repository.CardRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Eternal Empress: mai dal mazzo delle leggendarie, solo dal tiro a parte da una su un miliardo. */
class PackGeneratorUltimateTest {

    private static Card card(String code, String rarity, String source) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode(code);
        card.setRarity(rarity);
        card.setSource(source);
        return card;
    }

    private static Pack pack(String source) {
        Pack pack = new Pack();
        pack.setCardCount(5);
        pack.setSource(source);
        PackDropRate rate = new PackDropRate();
        rate.setRarity("legendary");
        rate.setWeight(1.0);
        pack.getDropRates().add(rate);
        PackGuarantee guarantee = new PackGuarantee();
        guarantee.setRarity("legendary");
        guarantee.setCount(5);
        pack.getGuarantees().add(guarantee);
        return pack;
    }

    private final CardRepository repository = mock(CardRepository.class);

    private List<Card> catalog() {
        List<Card> all = new ArrayList<>();
        all.add(card(Card.ULTIMATE_PREFIX + "001", "legendary", "original"));
        all.add(card(Card.ULTIMATE_PREFIX + "002", "legendary", "original"));
        for (int i = 0; i < 10; i++) all.add(card("leg" + i, "legendary", i < 5 ? "original" : "pokemon"));
        return all;
    }

    /** Generatore col tiro dell'ultimate forzato. */
    private PackGenerator generator(boolean lucky) {
        return new PackGenerator(repository) {
            @Override
            boolean rollUltimate() {
                return lucky;
            }
        };
    }

    @Test
    @DisplayName("Probabilita' dello 0,0000001%: una su un miliardo")
    void chance() {
        assertEquals(1e-9, PackGenerator.ULTIMATE_CHANCE);
    }

    @Test
    @DisplayName("Senza il tiro fortunato non esce mai, nemmeno con cinque leggendarie garantite")
    void neverFromLegendaryPool() {
        when(repository.findAllActiveWithArtistClass()).thenReturn(catalog());
        for (int round = 0; round < 200; round++) {
            List<Card> cards = generator(false).generate(pack(null));
            assertFalse(cards.stream().anyMatch(Card::isUltimate));
        }
    }

    @Test
    @DisplayName("Col tiro fortunato escono una volta sola, nei pacchetti misti e VinylDex, non in quelli di altri giochi")
    void luckyRoll() {
        when(repository.findAllActiveWithArtistClass()).thenReturn(catalog());
        List<Card> mixed = generator(true).generate(pack(null));
        assertEquals(5, mixed.size());
        assertEquals(2, mixed.stream().filter(Card::isUltimate).distinct().count());
        assertTrue(generator(true).generate(pack("original")).stream().anyMatch(Card::isUltimate));
        assertFalse(generator(true).generate(pack("pokemon")).stream().anyMatch(Card::isUltimate));
    }
}
