package com.capstone.vinyldex.dto;

import com.capstone.vinyldex.dto.response.CardFinish;
import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Finiture olografiche: come le carte Pokemon da collezione. */
class CardFinishTest {

    private static Card card(String source, String name, String rarity, String tcgRarity) {
        Card card = new Card();
        card.setSource(source);
        card.setName(name);
        card.setRarity(rarity);
        Map<String, Object> meta = new HashMap<>();
        if (tcgRarity != null) meta.put("tcgRarity", tcgRarity);
        card.setMetadata(meta);
        return card;
    }

    @Test
    @DisplayName("Pokemon: Secret, Illustration, ex e Holo hanno la loro finitura; le comuni nessuna")
    void pokemon() {
        assertEquals("secret", CardFinish.of(card("pokemon", "Charizard", "legendary", "Rare Secret")));
        assertEquals("rainbow", CardFinish.of(card("pokemon", "Charizard VMAX", "legendary", "Rare Rainbow")));
        assertEquals("illustration", CardFinish.of(card("pokemon", "Mew", "epic", "Special Illustration Rare")));
        assertEquals("ultra", CardFinish.of(card("pokemon", "Charizard ex", "rare", "Double Rare")));
        assertEquals("ultra", CardFinish.of(card("pokemon", "Primal Groudon-EX", "rare", "Rare Holo EX")));
        assertEquals("ultra", CardFinish.of(card("pokemon", "Pikachu V", "rare", null)));
        assertNull(CardFinish.of(card("pokemonjp", "Zapdos", "legendary", "Holo Rare")), "giapponesi: riflesso generico");
        assertNull(CardFinish.of(card("pokemon", "Zapdos", "legendary", "Common")), "rarita' semplice: niente oro anche se costa");
        assertEquals("vmax", CardFinish.of(card("pokemon", "Rayquaza VMAX", "epic", "Rare Holo VMAX")));
        assertEquals("vstar", CardFinish.of(card("pokemon", "Arceus VSTAR", "epic", "Rare Holo VSTAR")));
        assertEquals("vfull", CardFinish.of(card("pokemon", "Marnie", "epic", "Rare Ultra")));
        assertEquals("shiny", CardFinish.of(card("pokemon", "Shiny Charizard", "epic", "Rare Shiny")));
        assertEquals("radiant", CardFinish.of(card("pokemon", "Radiant Greninja", "rare", "Radiant Rare")));
        assertEquals("amazing", CardFinish.of(card("pokemon", "Rayquaza", "epic", "Amazing Rare")));
        assertEquals("gallery", CardFinish.of(card("pokemon", "Pikachu", "rare", "Trainer Gallery Rare Holo")));
        assertEquals("cosmos", CardFinish.of(card("pokemon", "Pikachu", "uncommon", "Promo")));
        assertEquals("holo", CardFinish.of(card("pokemon", "Lotad", "rare", "Rare Holo")));
        assertNull(CardFinish.of(card("pokemon", "Lotad", "common", "Common")));
        Card reverse = card("pokemon", "Lotad (Olografica)", "common", "Common");
        reverse.setHolo(true);
        assertEquals("reverse", CardFinish.of(reverse));
    }

    @Test
    @DisplayName("VinylDex e gli altri giochi: decide la rarita'; l'olografica brilla sempre")
    void others() {
        assertEquals("illustration", CardFinish.of(card("original", "Sky Breaker", "legendary", null)));
        assertEquals("ultra", CardFinish.of(card("original", "Golden Voice", "epic", null)));
        assertEquals("secret", CardFinish.of(card("yugioh", "Blue-Eyes", "legendary", null)));
        Card holo = card("original", "Baseline Kid (Olografica)", "common", null);
        holo.setHolo(true);
        assertEquals("holo", CardFinish.of(holo));
        assertNull(CardFinish.of(card("original", "Baseline Kid", "common", null)));
    }
}
