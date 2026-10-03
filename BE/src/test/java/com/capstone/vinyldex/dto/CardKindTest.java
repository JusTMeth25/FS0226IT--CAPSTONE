package com.capstone.vinyldex.dto;

import com.capstone.vinyldex.dto.response.CardKind;
import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Tipologia delle carte per i bonus di squadra in battaglia. */
class CardKindTest {

    private static Card card(String source, Map<String, Object> meta) {
        Card card = new Card();
        card.setSource(source);
        card.setMetadata(new HashMap<>(meta));
        return card;
    }

    @Test
    @DisplayName("Tipo Pokemon, colore Magic, razza Yu-Gi-Oh!, squadra NBA, serie TCGplayer")
    void kinds() {
        assertEquals("Fuoco", CardKind.of(card("pokemon", Map.of("types", List.of("Fire")))));
        assertEquals("Blu", CardKind.of(card("scryfall", Map.of("colors", List.of("U")))));
        assertEquals("Multicolore", CardKind.of(card("scryfall", Map.of("colors", List.of("U", "R")))));
        assertEquals("Incolore", CardKind.of(card("scryfall", Map.of("colors", List.of()))));
        assertEquals("Dragon", CardKind.of(card("yugioh", Map.of("race", "Dragon"))));
        assertEquals("Red", CardKind.of(card("onepiece", Map.of("color", "Red/Green"))));
        assertEquals("Los Angeles Lakers", CardKind.of(card("nba", Map.of("team", "Los Angeles Lakers"))));
        assertEquals("Chainsaw Man", CardKind.of(card("unionarena", Map.of("series", "Chainsaw Man"))));
        assertNull(CardKind.of(card("original", Map.of())), "le VinylDex usano la classe");
    }
}
