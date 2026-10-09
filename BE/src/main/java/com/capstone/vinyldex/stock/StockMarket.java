package com.capstone.vinyldex.stock;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

/**
 * Motore della borsa, senza Spring: quotazioni in memoria che si muovono a ogni tick.
 *
 * Ogni titolo ha un "fondamentale" (il valore medio delle carte piu' preziose del suo gioco, dai
 * prezzi veri) e una quotazione che ci gira intorno: a ogni tick un passo casuale (volatilita'),
 * una spinta verso il fondamentale (ritorno alla media) e l'effetto degli ordini (chi compra fa
 * salire, chi vende fa scendere). Cosi' i grafici si muovono di continuo ma nel lungo periodo
 * seguono il mercato delle carte.
 */
public class StockMarket {

    /** Titolo quotato: simbolo, nome, giochi di carte (source) di cui segue i prezzi, volatilita'. */
    public record Listing(String symbol, String name, List<String> sources, double volatility) {
    }

    /** Listino: un titolo per ogni grande gioco di carte e l'indice di tutto il mercato. */
    public static final List<Listing> LISTINGS = List.of(
            new Listing("VDX", "Indice VinylDex", List.of(), 0.0015),
            new Listing("PKMN", "Pokémon Holdings", List.of("pokemon", "pokemonjp", "pokemonpromo"), 0.0025),
            new Listing("MTG", "Magic Wizards Corp.", List.of("scryfall"), 0.0025),
            new Listing("YGO", "Yu-Gi-Oh! Duel Inc.", List.of("yugioh"), 0.003),
            new Listing("OP", "One Piece Treasure", List.of("onepiece"), 0.0035),
            new Listing("DBS", "Dragon Ball Capsule", List.of("dragonball"), 0.0035),
            new Listing("LOR", "Lorcana Ink & Co.", List.of("lorcana"), 0.003),
            new Listing("DGM", "Digimon Digital", List.of("digimon"), 0.003),
            new Listing("NBA", "NBA Hoops Trading", List.of("nba"), 0.004),
            new Listing("FC27", "EA FC Ultimate", List.of("fc27"), 0.004),
            new Listing("NIKK", "NIKKE Goddess Fund", List.of("nikke"), 0.0045),
            new Listing("VNYL", "VinylDex Originals", List.of("original"), 0.003));

    static final double PULL = 0.004;
    static final double IMPACT = 0.0004;

    /** Stato di un titolo: quotazione, fondamentale, apertura del giorno, ultimi prezzi. */
    public static final class Stock {
        public final Listing listing;
        double k;
        double fundamental;
        double price;
        double open;
        double flow;
        final Deque<double[]> recent = new ArrayDeque<>();

        Stock(Listing listing, double k, double price, double fundamental) {
            this.listing = listing;
            this.k = k;
            this.price = price;
            this.open = price;
            this.fundamental = fundamental;
        }

        public double price() {
            return price;
        }

        public double target() {
            return k * fundamental;
        }
    }

    private final RandomGenerator random;
    private final Map<String, Stock> stocks = new LinkedHashMap<>();

    public StockMarket(RandomGenerator random) {
        this.random = random;
    }

    /**
     * Prezzo di quotazione all'ingresso in borsa da un fondamentale (prezzo medio in dollari delle
     * carte migliori): scala logaritmica, cosi' i titoli vanno da qualche decina a qualche centinaio di gold.
     */
    public static double listingPrice(double fundamental) {
        return Math.round((40 + 45 * Math.log10(1 + Math.max(0, fundamental))) * 100) / 100.0;
    }

    public synchronized void list(Listing listing, double k, double price, double fundamental) {
        stocks.put(listing.symbol(), new Stock(listing, k, price, fundamental));
    }

    public synchronized void setFundamental(String symbol, double fundamental) {
        Stock s = stocks.get(symbol);
        if (s != null && fundamental > 0) s.fundamental = fundamental;
    }

    public synchronized Stock stock(String symbol) {
        return stocks.get(symbol);
    }

    public synchronized List<Stock> all() {
        return new ArrayList<>(stocks.values());
    }

    /** Un passo del mercato per tutti i titoli. */
    public synchronized void tick(long now) {
        for (Stock s : stocks.values()) {
            double z = random.nextGaussian();
            double pull = s.target() > 0 ? PULL * Math.log(s.target() / s.price) : 0;
            double impact = Math.max(-0.03, Math.min(0.03, s.flow * IMPACT));
            s.flow *= 0.5;
            double next = s.price * Math.exp(s.listing.volatility() * z + pull + impact);
            s.price = Math.max(1, Math.round(next * 100) / 100.0);
            s.recent.addLast(new double[]{now, s.price});
            while (s.recent.size() > 120) s.recent.removeFirst();
        }
    }

    /** Ordine eseguito: chi compra spinge in su, chi vende in giu' (in proporzione alla quotazione). */
    public synchronized void order(String symbol, int shares) {
        Stock s = stocks.get(symbol);
        if (s == null) return;
        s.flow += shares * Math.max(0.2, 100 / Math.max(1, s.price)) / 10.0;
    }

    /** Nuovo giorno di borsa: la variazione percentuale si conta da qui. */
    public synchronized void openDay() {
        stocks.values().forEach(s -> s.open = s.price);
    }
}
