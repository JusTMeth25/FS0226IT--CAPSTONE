/**
 * VinylDex - Random / Weighted Random Utility
 * 
 * Fornisce funzioni per:
 * - Weighted random selection (drop rate)
 * - Fisher-Yates shuffle
 * - Seeded random (opzionale, per debug)
 */

const VinylDexRandom = {
  /**
   * Seleziona un elemento da un array basato su pesi (weighted random).
   * 
   * @param {Array<{item: *, weight: number}>} choices - Array di oggetti con item e weight
   * @returns {*} L'item selezionato
   * 
   * @example
   * const cards = [
   *   { item: card1, weight: 0.50 },
   *   { item: card2, weight: 0.30 },
   *   { item: card3, weight: 0.20 }
   * ];
   * const selected = weightedRandom(cards);
   */
  weightedRandom(choices) {
    if (!choices || choices.length === 0) {
      return null;
    }

    // Calcola somma totale dei pesi
    const totalWeight = choices.reduce((sum, c) => sum + c.weight, 0);

    if (totalWeight <= 0) {
      // Fallback: random uniforme se i pesi non sono validi
      return choices[Math.floor(Math.random() * choices.length)].item;
    }

    // Random 0 - totalWeight
    let random = Math.random() * totalWeight;

    // Trova in che intervallo cade
    for (const choice of choices) {
      random -= choice.weight;
      if (random <= 0) {
        return choice.item;
      }
    }

    // Fallback (sicurezza)
    return choices[choices.length - 1].item;
  },

  /**
   * Mescola un array usando Fisher-Yates shuffle.
   * @param {Array} array - Array da mescolare
   * @returns {Array} Nuovo array mescolato (non modifica l'originale)
   */
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Genera un numero casuale in un range.
   * @param {number} min - Valore minimo (inclusivo)
   * @param {number} max - Valore massimo (inclusivo)
   * @returns {number}
   */
  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Sceglie un elemento casuale da un array (uniforme).
   * @param {Array} array
   * @returns {*}
   */
  randomItem(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  },

  /**
   * Simula N estrazioni e ritorna la distribuzione osservata.
   * Utile per test e debug del drop rate.
   * 
   * @param {Array<{item: *, weight: number}>} choices
   * @param {number} trials - Numero di estrazioni
   * @returns {Object} Mappa item -> conteggio
   */
  simulateDistribuzione(choices, trials = 10000) {
    const counts = {};
    for (let i = 0; i < trials; i++) {
      const selected = this.weightedRandom(choices);
      const key = selected.name || selected.id || String(selected);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
};

// Export globale
window.VinylDexRandom = VinylDexRandom;