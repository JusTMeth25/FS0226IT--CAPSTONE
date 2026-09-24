package com.capstone.vinyldex.importer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CardStatCalculatorTest {

    private final CardStatCalculator calculator = new CardStatCalculator(new PriceRarityMapper());

    private CardStatCalculator.Stats stats(String source, String name, String rarity, Double price, Map<String, Object> meta) {
        return calculator.calculate(new CardStatCalculator.Input(source, source + "-" + name, name, "Set", rarity, price, meta));
    }

    private static void assertAllAbove(CardStatCalculator.Stats strong, CardStatCalculator.Stats weak) {
        assertTrue(strong.fans() > weak.fans(), "fans");
        assertTrue(strong.style() > weak.style(), "style");
        assertTrue(strong.influence() > weak.influence(), "influence");
        assertTrue(strong.energy() > weak.energy(), "energy");
    }

    @Test
    @DisplayName("Un Charizard ex da collezione ha statistiche da leggendaria")
    void charizardExIsLegendaryTier() {
        CardStatCalculator.Stats charizard = stats("pokemon", "Charizard ex", "legendary", 180.0, Map.of(
                "hp", "330", "maxDamage", 330, "subtypes", List.of("Stage 2", "ex", "Tera"),
                "tcgRarity", "Special Illustration Rare"));

        assertTrue(charizard.total() >= 360, "totale " + charizard.total());
        assertTrue(charizard.fans() >= 88 && charizard.style() >= 85
                && charizard.influence() >= 88 && charizard.energy() >= 88, charizard.toString());
    }

    @Test
    @DisplayName("Un Magikarp comune resta nella fascia delle comuni e perde su ogni statistica")
    void magikarpIsWeak() {
        CardStatCalculator.Stats magikarp = stats("pokemon", "Magikarp", "common", 0.3, Map.of("hp", "30"));
        CardStatCalculator.Stats charizard = stats("pokemon", "Charizard ex", "legendary", 180.0, Map.of(
                "hp", "330", "subtypes", List.of("ex")));

        assertTrue(magikarp.total() < 260, "totale " + magikarp.total());
        assertAllAbove(charizard, magikarp);
    }

    @Test
    @DisplayName("I Pokemon con regola si riconoscono dal nome in tutte le grafie")
    void ruleBoxFromName() {
        assertEquals(1.0, CardStatCalculator.pokemonRuleBox("charizard ex", ""));
        assertEquals(1.0, CardStatCalculator.pokemonRuleBox("m venusaur-ex", ""));
        assertEquals(1.0, CardStatCalculator.pokemonRuleBox("pikachu vmax", ""));
        assertEquals(0.85, CardStatCalculator.pokemonRuleBox("tapu koko-gx", ""));
        assertEquals(0.85, CardStatCalculator.pokemonRuleBox("incineroar v", ""));
        assertEquals(0.0, CardStatCalculator.pokemonRuleBox("vespiquen", ""));
    }

    @Test
    @DisplayName("Yu-Gi-Oh!: un mostro da 3000 ATK ha piu' energia di una magia")
    void yugiohAttackDrivesEnergy() {
        CardStatCalculator.Stats blueEyes = stats("yugioh", "Blue-Eyes White Dragon", "rare", 2.0, Map.of(
                "type", "Normal Monster", "atk", 3000.0, "def", 2500.0));
        CardStatCalculator.Stats spell = stats("yugioh", "Photon Veil", "rare", 2.0, Map.of("type", "Spell Card"));

        assertTrue(blueEyes.energy() > spell.energy() + 10, blueEyes + " vs " + spell);
    }

    @Test
    @DisplayName("Magic: un planeswalker pesa piu' di una terra base")
    void magicInfluenceByType() {
        CardStatCalculator.Stats walker = stats("scryfall", "Jace, the Mind Sculptor", "rare", 5.0, Map.of(
                "typeLine", "Legendary Planeswalker — Jace", "manaCost", "{2}{U}{U}"));
        CardStatCalculator.Stats land = stats("scryfall", "Island", "rare", 5.0, Map.of("typeLine", "Basic Land — Island"));

        assertTrue(walker.influence() > land.influence() + 20);
    }

    @Test
    @DisplayName("Le fonti senza prezzo usano la rarita': Gundam con AP/HP alti batte un token")
    void unpricedSourceUsesRarityAndPower() {
        CardStatCalculator.Stats wing = stats("gundam", "Wing Gundam", "legendary", null, Map.of(
                "cardType", "UNIT", "ap", "4", "hp", "5"));
        CardStatCalculator.Stats token = stats("gundam", "Guntank", "common", null, Map.of(
                "cardType", "UNIT TOKEN", "ap", "1", "hp", "1"));

        assertAllAbove(wing, token);
    }

    @Test
    @DisplayName("Statistiche sempre fra 40 e 100 e stabili fra un calcolo e l'altro")
    void boundedAndDeterministic() {
        Map<String, Object> meta = Map.of("hp", "999", "maxDamage", 9999, "subtypes", List.of("VMAX"));
        CardStatCalculator.Stats first = stats("pokemon", "Eternatus VMAX", "legendary", 99999.0, meta);
        CardStatCalculator.Stats second = stats("pokemon", "Eternatus VMAX", "legendary", 99999.0, meta);

        assertEquals(first, second);
        for (int value : new int[]{first.fans(), first.style(), first.influence(), first.energy()}) {
            assertTrue(value >= 40 && value <= 100, first.toString());
        }
    }

    @Test
    @DisplayName("Una fonte sconosciuta o senza metadati non fa crashare il calcolo")
    void unknownSourceStillWorks() {
        CardStatCalculator.Stats unknown = calculator.calculate(
                new CardStatCalculator.Input("altro", "x", null, null, null, null, null));

        assertTrue(unknown.total() > 0);
    }
}
