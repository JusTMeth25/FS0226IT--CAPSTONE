package com.capstone.vinyldex.importer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PriceRarityMapperTest {

    private final PriceRarityMapper mapper = new PriceRarityMapper();

    @Test
    @DisplayName("Senza prezzo non si decide nulla: decide il chiamante")
    void noPriceMeansNoRarity() {
        assertNull(mapper.rarityFromPrice("pokemon", null));
        assertNull(mapper.rarityFromPrice("pokemon", 0.0));
        assertNull(mapper.rarityFromPrice("pokemon", -1.0));
    }

    @Test
    @DisplayName("Una fonte senza soglie non produce rarita'")
    void unknownSourceMeansNoRarity() {
        assertNull(mapper.rarityFromPrice("lorcana", 50.0));
    }

    @Test
    @DisplayName("Le soglie Pokemon coprono tutta la scala")
    void pokemonThresholds() {
        assertEquals("common", mapper.rarityFromPrice("pokemon", 1.0));
        assertEquals("uncommon", mapper.rarityFromPrice("pokemon", 3.0));
        assertEquals("rare", mapper.rarityFromPrice("pokemon", 19.0));
        assertEquals("epic", mapper.rarityFromPrice("pokemon", 75.0));
        assertEquals("legendary", mapper.rarityFromPrice("pokemon", 250.0));
    }

    @Test
    @DisplayName("Ogni gioco ha la sua scala: lo stesso prezzo vale rarita' diverse")
    void scalesDifferPerSource() {
        // Un dollaro e' poco per Pokemon ma gia' molto per Yu-Gi-Oh.
        assertEquals("common", mapper.rarityFromPrice("pokemon", 1.0));
        assertEquals("rare", mapper.rarityFromPrice("yugioh", 1.0));
    }
}
