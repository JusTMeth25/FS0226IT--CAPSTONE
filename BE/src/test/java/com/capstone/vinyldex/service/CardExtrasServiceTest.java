package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Carta del giorno, rarita' della fusione, probabilita' delle olografiche. */
class CardExtrasServiceTest {

    private static Card card(String code, String rarity, String img) {
        Card card = new Card();
        card.setCode(code);
        card.setName(code);
        card.setRarity(rarity);
        card.setImgUrl(img);
        return card;
    }

    @Test
    @DisplayName("Carta del giorno: la stessa per tutto il giorno, mai comune o senza immagine, cambia nei giorni")
    void daily() {
        List<Card> cards = new ArrayList<>();
        for (int i = 0; i < 30; i++) cards.add(card("c" + i, i % 3 == 0 ? "common" : "rare", i % 5 == 0 ? null : "/img/" + i));
        LocalDate day = LocalDate.of(2026, 9, 26);
        Card today = CardExtrasService.pickDaily(cards, day);
        assertEquals(today, CardExtrasService.pickDaily(new ArrayList<>(cards.reversed()), day), "non dipende dall'ordine");
        Set<String> seen = new HashSet<>();
        for (int d = 0; d < 20; d++) {
            Card c = CardExtrasService.pickDaily(cards, day.plusDays(d));
            assertNotEquals("common", c.getRarity());
            assertTrue(c.getImgUrl() != null);
            seen.add(c.getCode());
        }
        assertTrue(seen.size() > 5, "cambia da un giorno all'altro");
        assertNull(CardExtrasService.pickDaily(List.of(card("x", "common", "/a")), day));
    }

    @Test
    @DisplayName("Fusione: comune -> non comune -> rara -> epica -> leggendaria, poi basta")
    void nextRarity() {
        assertEquals("uncommon", CardExtrasService.nextRarity("common"));
        assertEquals("legendary", CardExtrasService.nextRarity("epic"));
        assertNull(CardExtrasService.nextRarity("legendary"));
        assertNull(CardExtrasService.nextRarity("boh"));
    }

    @Test
    @DisplayName("Olografiche: piu' probabili fra le leggendarie")
    void foil() {
        assertTrue(PackService.foilChance("legendary") > PackService.foilChance("epic"));
        assertTrue(PackService.foilChance("epic") > PackService.foilChance("common"));
    }
}
