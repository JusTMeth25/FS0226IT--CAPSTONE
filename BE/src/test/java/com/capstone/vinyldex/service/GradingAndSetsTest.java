package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.ArtistClass;
import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Voti del perito e regole dei set da completare. */
class GradingAndSetsTest {

    @Test
    @DisplayName("Perito: voti fra 1 e 10, i piu' frequenti 7-8; il valore cresce con il voto")
    void grading() {
        Random random = new Random(3);
        int[] counts = new int[11];
        for (int i = 0; i < 5000; i++) {
            int grade = GradingService.roll(random);
            assertTrue(grade >= 1 && grade <= 10);
            counts[grade]++;
        }
        assertTrue(counts[8] > counts[10] * 3, "il 10 e' raro");
        assertTrue(counts[7] + counts[8] > 2000);
        double previous = 0;
        for (int grade = 1; grade <= 10; grade++) {
            assertTrue(GradingService.multiplier(grade) >= previous);
            previous = GradingService.multiplier(grade);
        }
        assertEquals(1.0, GradingService.multiplier(null));
        assertEquals(2.0, GradingService.multiplier(10));
    }

    private static Card card(String source, String name, String rarity, Map<String, Object> metadata, String artist) {
        Card card = new Card();
        card.setSource(source);
        card.setName(name);
        card.setRarity(rarity);
        card.setMetadata(metadata == null ? new HashMap<>() : new HashMap<>(metadata));
        if (artist != null) {
            ArtistClass artistClass = new ArtistClass();
            artistClass.setName(artist);
            card.setArtistClass(artistClass);
        }
        return card;
    }

    @Test
    @DisplayName("Set: le carte rientrano per regola, e un set con meno di due carte non c'e'")
    void sets() {
        List<Card> catalog = new ArrayList<>(List.of(
                card("original", "Daydreamer", "common", null, "The Dreamer"),
                card("original", "Astral Lullaby", "legendary", null, "The Dreamer"),
                card("original", "Pixel Bass", "common", null, "The Innovator"),
                card("pokemon", "Pikachu VMAX", "epic", null, null),
                card("pokemon", "Eevee", "common", null, null),
                card("pokemon", "Bulbasaur", "common", null, null),
                card("fc27", "Pele", "legendary", Map.of("version", "icon", "nation", "Brazil"), null),
                card("fc27", "Ronaldo", "legendary", Map.of("version", "icon", "nation", "Brazil"), null),
                card("fc27", "Neymar", "epic", Map.of("version", "gold_rare", "nation", "Brazil"), null)));
        Map<String, Integer> sizes = new HashMap<>();
        CardSetService.members(catalog).forEach((set, cards) -> sizes.put(set.key(), cards.size()));
        assertEquals(2, sizes.get("artist-the-dreamer"));
        assertFalse(sizes.containsKey("artist-the-innovator"), "una carta sola: niente set");
        assertEquals(2, sizes.get("pokemon-pikachu"));
        assertEquals(2, sizes.get("fc27-icone-brasile"), "l'oro raro non e' un'icona");
    }
}
