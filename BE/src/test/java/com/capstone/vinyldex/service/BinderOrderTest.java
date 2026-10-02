package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Ordine del raccoglitore a pagine: per set, poi per numero "naturale", poi per nome. */
class BinderOrderTest {

    private static Card card(String set, String number, String name) {
        Card c = new Card();
        c.setSetCode(set);
        c.setNumber(number);
        c.setName(name);
        return c;
    }

    @Test
    @DisplayName("I numeri si confrontano come numeri: 9 prima di 10, 021 dopo 009")
    void naturalNumbers() {
        assertTrue(CollectionService.naturalCompare("UE14BT/NIK-1-009", "UE14BT/NIK-1-021") < 0);
        assertTrue(CollectionService.naturalCompare("9", "10") < 0);
        assertTrue(CollectionService.naturalCompare("AP02", "AP10") < 0);
        assertEquals(0, CollectionService.naturalCompare("007", "7"));
    }

    @Test
    @DisplayName("Prima il set, poi il numero, poi il nome")
    void order() {
        List<Card> sorted = Stream.of(card("B", "2", "x"), card("A", "10", "y"), card("A", "9", "z"), card("A", "9", "a"))
                .sorted(CollectionService.BINDER_ORDER).toList();
        assertEquals(List.of("a", "z", "y", "x"), sorted.stream().map(Card::getName).toList());
    }
}
