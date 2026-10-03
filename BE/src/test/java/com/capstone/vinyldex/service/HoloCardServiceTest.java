package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.repository.CardRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** L'olografica e' una carta a se': codice suo, stessa carta, prezzo triplo. */
class HoloCardServiceTest {

    private final CardRepository cards = mock(CardRepository.class);
    private final EntityManager em = mock(EntityManager.class);
    private final HoloCardService service = new HoloCardService(cards, em);

    private static Card base() {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setCode("pokemon-base1-4");
        card.setName("Charizard");
        card.setRarity("legendary");
        card.setSource("pokemon");
        card.setFans(90);
        Map<String, Object> meta = new HashMap<>();
        meta.put("marketPrice", 100.0);
        card.setMetadata(meta);
        return card;
    }

    @Test
    @DisplayName("La prima olografica di una carta crea la sua versione, con prezzo triplo")
    void createsHolo() {
        when(cards.findByCode("pokemon-base1-4-holo")).thenReturn(Optional.empty());
        Card holo = service.holoOf(base());
        assertEquals("pokemon-base1-4-holo", holo.getCode());
        assertEquals("Charizard (Olografica)", holo.getName());
        assertTrue(holo.isHolo());
        assertEquals(300.0, holo.getMarketPrice());
        assertEquals(90, holo.getFans());
        assertEquals("pokemon-base1-4", holo.baseCode());
        verify(em).persist(holo);
    }

    @Test
    @DisplayName("Le volte dopo si riusa la stessa carta olografica")
    void reusesHolo() {
        Card existing = new Card();
        existing.setCode("pokemon-base1-4-holo");
        existing.setHolo(true);
        when(cards.findByCode("pokemon-base1-4-holo")).thenReturn(Optional.of(existing));
        assertSame(existing, service.holoOf(base()));
        verify(em, never()).persist(any());
    }

    @Test
    @DisplayName("Un'olografica vale piu' della carta normale anche al negozio")
    void holoSellsForMore() {
        when(cards.findByCode("pokemon-base1-4-holo")).thenReturn(Optional.empty());
        Card base = base();
        base.setRarity("rare");
        Card holo = service.holoOf(base);
        assertTrue(CardBuybackService.quote(holo) > CardBuybackService.quote(base));
    }
}
