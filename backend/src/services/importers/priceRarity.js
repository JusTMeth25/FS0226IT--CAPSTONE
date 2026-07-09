// Soglie di prezzo (USD, mercato TCGPlayer/Cardmarket) calibrate campionando la distribuzione
// reale di prezzi di ciascun gioco (luglio 2026, migliaia di carte per fonte, vedi percentili
// sotto). Non esiste una soglia universale: ogni gioco ha una scala di prezzi propria (mediana
// Pokemon $2.94 contro Yu-Gi-Oh $0.21), quindi le soglie sono calibrate per allinearsi agli stessi
// percentili-target in ciascuna distribuzione: common ~p0-50, uncommon ~p50-75, rare ~p75-90,
// epic ~p90-97, legendary ~p97-100 (piramide di rarità tipica dei TCG reali).
//
// Percentili campionati (min/p25/p50/p75/p90/p95/p99/max):
//   pokemon:    n=3701  0.04 / 0.45 / 2.94 / 18.98 / 74.87 / 147.74 / 379.99 / 3998.99
//   scryfall:   n=2460  0.02 / 0.25 / 0.38 / 1.59  / 7.74  / 15.43  / 54.04  / 203.30
//   yugioh:     n=2931  0.02 / 0.14 / 0.21 / 0.40  / 1.28  / 3.15   / 15.64  / 454.44
//   onepiece:   n=3485  0.02 / 0.08 / 0.20 / 4.45  / 40.33 / 124.38 / 1095.24/ 8489.98
//   dragonball: n=1902  0.01 / 0.13 / 0.29 / 0.74  / 4.34  / 12.98  / 149.08 / 2475.01
//   digimon:    n=539   0.05 / 0.15 / 0.41 / 1.98  / 6.62  / 14.78  / 139.95 / 2399.50
const THRESHOLDS = {
  pokemon: { uncommon: 3, rare: 19, epic: 75, legendary: 250 },
  scryfall: { uncommon: 0.4, rare: 1.6, epic: 8, legendary: 35 },
  yugioh: { uncommon: 0.21, rare: 0.4, epic: 1.3, legendary: 9 },
  onepiece: { uncommon: 0.2, rare: 4.5, epic: 40, legendary: 600 },
  dragonball: { uncommon: 0.3, rare: 0.75, epic: 4.5, legendary: 80 },
  digimon: { uncommon: 0.4, rare: 2, epic: 6.5, legendary: 75 }
};

/**
 * Converte un prezzo di mercato reale in una rarità VinylDex per una data fonte.
 * Ritorna null quando manca un prezzo affidabile: il chiamante deve ricadere sulla
 * rarità nativa dichiarata dalla fonte (mapRarity dell'importer specifico).
 */
function rarityFromPrice(source, price) {
  const t = THRESHOLDS[source];
  if (!t || !(price > 0)) return null;
  if (price >= t.legendary) return 'legendary';
  if (price >= t.epic) return 'epic';
  if (price >= t.rare) return 'rare';
  if (price >= t.uncommon) return 'uncommon';
  return 'common';
}

module.exports = { rarityFromPrice, THRESHOLDS };
