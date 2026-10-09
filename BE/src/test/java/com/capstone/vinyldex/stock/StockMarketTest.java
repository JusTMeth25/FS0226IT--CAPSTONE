package com.capstone.vinyldex.stock;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StockMarketTest {

    private static final StockMarket.Listing TEST = new StockMarket.Listing("TST", "Test", List.of("x"), 0.003);

    @Test
    @DisplayName("Il prezzo oscilla ma torna verso il fondamentale e non va mai sotto 1")
    void meanReverting() {
        StockMarket market = new StockMarket(new Random(3));
        market.list(TEST, 1, 50, 100);
        for (int i = 0; i < 5_000; i++) market.tick(i * 5_000L);
        double p = market.stock("TST").price();
        assertTrue(p > 60 && p < 160, "vicino a 100: " + p);
        market.setFundamental("TST", 10);
        for (int i = 0; i < 5_000; i++) market.tick(i * 5_000L);
        assertTrue(market.stock("TST").price() < 20, "segue il fondamentale che scende");
        assertTrue(market.stock("TST").price() >= 1);
    }

    @Test
    @DisplayName("Chi compra fa salire il prezzo, chi vende lo fa scendere")
    void ordersMovePrice() {
        StockMarket a = new StockMarket(new Random(9));
        StockMarket b = new StockMarket(new Random(9));
        a.list(TEST, 1, 100, 100);
        b.list(TEST, 1, 100, 100);
        a.order("TST", 500);
        b.order("TST", -500);
        a.tick(0);
        b.tick(0);
        assertTrue(a.stock("TST").price() > b.stock("TST").price());
    }

    @Test
    @DisplayName("Prezzo di quotazione: da qualche decina a qualche centinaio di gold")
    void listingPrice() {
        assertEquals(40, StockMarket.listingPrice(0));
        assertTrue(StockMarket.listingPrice(30) > 100 && StockMarket.listingPrice(30) < 120);
        assertTrue(StockMarket.listingPrice(100_000) < 300);
    }
}
