package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Vetrine dell'edicola: carte che cambiano a ogni finestra di tempo, della rarita' giusta, senza doppioni. */
class NewsstandShowcaseTest {

    private static List<UUID> cards(int n) {
        return IntStream.range(0, n).mapToObj(i -> UUID.randomUUID()).toList();
    }

    private final Map<String, List<UUID>> pool = Map.of(
            "legendary", cards(30), "epic", cards(30), "rare", cards(30), "uncommon", cards(30), "common", cards(30));

    @Test
    @DisplayName("Ogni vetrina ha una carta della sua rarita', tutte diverse")
    void rarityPerSlot() {
        Map<UUID, UUID> chosen = NewsstandShowcaseService.choose(100, pool);
        assertEquals(NewsstandShowcaseService.SLOTS.size(), chosen.size());
        assertEquals(chosen.size(), new HashSet<>(chosen.values()).size());
        chosen.forEach((item, card) -> assertTrue(pool.get(NewsstandShowcaseService.SLOTS.get(item)).contains(card)));
        assertTrue(NewsstandShowcaseService.SLOTS.containsKey(UUID.fromString("00000000-0000-0000-0000-c00c0000001c")));
        assertTrue(NewsstandShowcaseService.SLOTS.containsKey(UUID.fromString("00000000-0000-0000-0000-c00c00000026")));
    }

    @Test
    @DisplayName("Stessa finestra, stesse carte (anche dopo un riavvio); finestra dopo, carte nuove")
    void changesPerWindow() {
        assertEquals(NewsstandShowcaseService.choose(100, pool), NewsstandShowcaseService.choose(100, pool));
        assertNotEquals(NewsstandShowcaseService.choose(100, pool), NewsstandShowcaseService.choose(101, pool));
    }

    @Test
    @DisplayName("Senza carte di una rarita' quella vetrina resta com'e'")
    void missingRarity() {
        Map<UUID, UUID> chosen = NewsstandShowcaseService.choose(5, Map.of("common", cards(5)));
        assertEquals(2, chosen.size());
    }
}
