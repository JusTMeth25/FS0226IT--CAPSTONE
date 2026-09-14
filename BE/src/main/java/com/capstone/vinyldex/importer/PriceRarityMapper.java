package com.capstone.vinyldex.importer;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Converte un prezzo di mercato reale nella rarita' di gioco.
 *
 * Non esiste una soglia universale: ogni gioco ha una scala di prezzi propria (mediana Pokemon
 * $2.94 contro Yu-Gi-Oh $0.21). Le soglie qui sotto sono calibrate campionando la distribuzione
 * reale di ciascuna fonte (luglio 2026, migliaia di carte per fonte) in modo da centrare gli
 * stessi percentili: common ~p0-50, uncommon ~p50-75, rare ~p75-90, epic ~p90-97,
 * legendary ~p97-100, cioe' la piramide di rarita' tipica dei TCG reali.
 *
 * Percentili campionati (min / p25 / p50 / p75 / p90 / p95 / p99 / max):
 *   pokemon    n=3701  0.04 / 0.45 / 2.94 / 18.98 / 74.87 / 147.74 / 379.99 / 3998.99
 *   scryfall   n=2460  0.02 / 0.25 / 0.38 / 1.59  / 7.74  / 15.43  / 54.04  / 203.30
 *   yugioh     n=2931  0.02 / 0.14 / 0.21 / 0.40  / 1.28  / 3.15   / 15.64  / 454.44
 *   onepiece   n=3485  0.02 / 0.08 / 0.20 / 4.45  / 40.33 / 124.38 / 1095.24 / 8489.98
 *   dragonball n=1902  0.01 / 0.13 / 0.29 / 0.74  / 4.34  / 12.98  / 149.08 / 2475.01
 *   digimon    n=539   0.05 / 0.15 / 0.41 / 1.98  / 6.62  / 14.78  / 139.95 / 2399.50
 */
@Component
public class PriceRarityMapper {

    private static final Map<String, Thresholds> THRESHOLDS = Map.of(
            "pokemon", new Thresholds(3, 19, 75, 250),
            "scryfall", new Thresholds(0.4, 1.6, 8, 35),
            "yugioh", new Thresholds(0.21, 0.4, 1.3, 9),
            "onepiece", new Thresholds(0.2, 4.5, 40, 600),
            "dragonball", new Thresholds(0.3, 0.75, 4.5, 80),
            "digimon", new Thresholds(0.4, 2, 6.5, 75));

    /**
     * @return la rarita' corrispondente al prezzo, oppure null quando manca un prezzo affidabile.
     * In quel caso il chiamante deve ricadere sulla rarita' dichiarata dalla fonte.
     */
    public String rarityFromPrice(String source, Double price) {
        Thresholds t = THRESHOLDS.get(source);
        if (t == null || price == null || price <= 0) return null;
        if (price >= t.legendary()) return "legendary";
        if (price >= t.epic()) return "epic";
        if (price >= t.rare()) return "rare";
        if (price >= t.uncommon()) return "uncommon";
        return "common";
    }

    private record Thresholds(double uncommon, double rare, double epic, double legendary) {
    }
}
