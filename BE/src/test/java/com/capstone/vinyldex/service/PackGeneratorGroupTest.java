package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.PackDropRate;
import com.capstone.vinyldex.repository.CardRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Pacchetti di un gruppo di carte: "original/Court Legends" pesca solo le carte VinylDex di basket. */
class PackGeneratorGroupTest {

    private static Card card(int i, String source, String group) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode("c" + i);
        card.setRarity("common");
        card.setSource(source);
        card.setGroup(group);
        return card;
    }

    private static Pack pack(String source) {
        Pack pack = new Pack();
        pack.setCardCount(5);
        pack.setSource(source);
        PackDropRate rate = new PackDropRate();
        rate.setRarity("common");
        rate.setWeight(1.0);
        pack.getDropRates().add(rate);
        return pack;
    }

    private final CardRepository repository = mock(CardRepository.class);

    private List<Card> catalog() {
        List<Card> all = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            all.add(i < 10 ? card(i, "original", "Court Legends") : i < 20 ? card(i, "original", null) : card(i, "pokemon", null));
        }
        return all;
    }

    @Test
    @DisplayName("Il Pacchetto Court Legends pesca solo le carte del gruppo")
    void onlyGroup() {
        when(repository.findAllActiveWithArtistClass()).thenReturn(catalog());
        for (int round = 0; round < 20; round++) {
            List<Card> cards = new PackGenerator(repository).generate(pack("original/Court Legends"));
            assertEquals(5, cards.size());
            assertTrue(cards.stream().allMatch(c -> "Court Legends".equals(c.getGroup())));
        }
    }

    @Test
    @DisplayName("Il pacchetto VinylDex Originali resta di tutte le carte originali, basket comprese")
    void originalStillAll() {
        when(repository.findAllActiveWithArtistClass()).thenReturn(catalog());
        List<Card> cards = new PackGenerator(repository).generate(pack("original"));
        assertTrue(cards.stream().allMatch(c -> "original".equals(c.getSource())));
    }
}
