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

/** Pity counter dei pacchetti e carte in vetrina del pacchetto del weekend. */
class PackPityWeekendTest {

    private static Card card(String rarity, String source) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode(UUID.randomUUID().toString());
        card.setRarity(rarity);
        card.setSource(source);
        return card;
    }

    private static Pack commonPack(int count) {
        Pack pack = new Pack();
        pack.setCardCount(count);
        PackDropRate common = new PackDropRate();
        common.setRarity("common");
        common.setWeight(1.0);
        PackDropRate legendary = new PackDropRate();
        legendary.setRarity("legendary");
        legendary.setWeight(0.0);
        pack.getDropRates().add(common);
        pack.getDropRates().add(legendary);
        return pack;
    }

    @Test
    @DisplayName("Pity: nessun aiuto fino alla soglia, poi il peso della leggendaria cresce")
    void pityBoost() {
        assertEquals(1.0, PackGenerator.pityBoost(0));
        assertEquals(1.0, PackGenerator.pityBoost(PackGenerator.PITY_SOFT - 1));
        assertTrue(PackGenerator.pityBoost(PackGenerator.PITY_SOFT) > 1.0);
        assertTrue(PackGenerator.pityBoost(35) > PackGenerator.pityBoost(25));
    }

    @Test
    @DisplayName("Al pacchetto numero PITY_HARD senza leggendaria, una esce di sicuro")
    void hardPity() {
        CardRepository repository = mock(CardRepository.class);
        List<Card> all = new ArrayList<>();
        for (int i = 0; i < 10; i++) all.add(card("common", "pokemon"));
        all.add(card("legendary", "pokemon"));
        when(repository.findAllActiveWithArtistClass()).thenReturn(all);
        PackGenerator generator = new PackGenerator(repository);

        assertTrue(generator.generate(commonPack(5), 0, List.of()).stream().noneMatch(c -> "legendary".equals(c.getRarity())));
        assertTrue(generator.generate(commonPack(5), PackGenerator.PITY_HARD - 1, List.of()).stream()
                .anyMatch(c -> "legendary".equals(c.getRarity())));
    }

    @Test
    @DisplayName("Weekend: due carte del set in vetrina, le altre dello stesso gioco")
    void featuredCards() {
        CardRepository repository = mock(CardRepository.class);
        List<Card> all = new ArrayList<>();
        List<Card> featured = List.of(card("common", "onepiece"), card("common", "onepiece"), card("common", "onepiece"));
        all.addAll(featured);
        for (int i = 0; i < 10; i++) all.add(card("common", "onepiece"));
        for (int i = 0; i < 30; i++) all.add(card("common", "pokemon"));
        when(repository.findAllActiveWithArtistClass()).thenReturn(all);

        List<Card> cards = new PackGenerator(repository).generate(commonPack(5), 0, featured);
        assertEquals(5, cards.size());
        // Almeno due del set: il resto si pesca dal gioco, che puo' ridare anche la terza carta del set.
        assertTrue(cards.stream().filter(featured::contains).count() >= PackGenerator.FEATURED_COUNT);
        assertTrue(cards.stream().allMatch(c -> "onepiece".equals(c.getSource())));
    }
}
