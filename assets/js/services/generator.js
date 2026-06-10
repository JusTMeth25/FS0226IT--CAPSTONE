/**
 * VinylDex - Card Generator Service
 *
 * Centralizza la logica di:
 * - selezione rarità basata su drop rates
 * - scelta carta casuale per rarità
 * - generazione istanza Card con timestamp obtainedAt
 * - funzioni di utilità per normalizzare e simulare distribuzioni (debug)
 *
 * Questo modulo è pensato per essere utilizzato da Pack.open, UI di apertura pacchetti
 * e da eventuali servizi di testing/simulazione.
 *
 * Dipendenze globali attese:
 * - window.VinylDexRandom
 * - window.VinylDexArtists
 * - window.VinylDexCard
 */
(function () {
  'use strict';

  const VinylDexGenerator = {
    /**
     * Normalizza un oggetto dropRates (somma a 1).
     * @param {Object} dropRates - { common: 0.5, uncommon: 0.3, ... }
     * @returns {Object} normalized dropRates
     */
    normalizeDropRates(dropRates) {
      const entries = Object.entries(dropRates || {});
      const sum = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
      if (sum <= 0) {
        // fallback alle drop rate di default dal Pack
        return { ...window.VinylDexPack.DEFAULT_DROP_RATES };
      }
      const normalized = {};
      entries.forEach(([k, v]) => {
        normalized[k] = (Number(v) || 0) / sum;
      });
      return normalized;
    },

    /**
     * Seleziona una rarità usando VinylDexRandom.weightedRandom.
     * Accetta dropRates non normalizzati.
     *
     * @param {Object} dropRates
     * @returns {string} rarityKey
     */
    pickRarity(dropRates) {
      const normalized = this.normalizeDropRates(dropRates);
      const choices = Object.entries(normalized).map(([rarity, weight]) => ({
        item: rarity,
        weight
      }));
      return window.VinylDexRandom.weightedRandom(choices);
    },

    /**
     * Seleziona una carta casuale dal pool (globale o passato) per la rarità richiesta.
     * Opzione excludeIds per evitare duplicati nello stesso pacchetto.
     *
     * @param {string} rarity
     * @param {Array<string>} excludeIds
     * @param {Array<Object>|null} pool - optional source pool (stateless)
     * @returns {Card|null}
     */
    pickCardByRarity(rarity, excludeIds = [], pool = null) {
      const source = Array.isArray(pool) ? pool : (window.VinylDexArtists || []);
      const filtered = (source || []).filter(c => c.rarity === rarity && !excludeIds.includes(c.id));
      if (!filtered || filtered.length === 0) return null;
      const chosen = window.VinylDexRandom.randomItem(filtered);
      // Restituisce istanza Card (non marcata obtainedAt)
      return new window.VinylDexCard({ ...chosen });
    },

    /**
     * Genera una singola carta per una data rarità e la marca come ottenuta (timestamp).
     * Se non trova carte della rarità, ritorna null.
     *
     * @param {string} rarity
     * @param {Array<string>} excludeIds
     * @param {Array<Object>|null} pool - optional source pool (stateless)
     * @returns {Card|null}
     */
    generateCardForRarity(rarity, excludeIds = [], pool = null) {
      const card = this.pickCardByRarity(rarity, excludeIds, pool);
      if (!card) return null;
      card.obtainedAt = Date.now();
      return card;
    },

    /**
     * Genera N carte partendo da un dropRates specificato e garanzie opzionali.
     * Questo è un helper alternativo a Pack.open, utile per testing o UI che voglia
     * simulare aperture senza mutare Pack.
     *
     * NOTA: Non rimuove carte dal pool globale (stateless) a meno che non venga passato pool.
     *
     * @param {number} count
     * @param {Object} dropRates
     * @param {Object} guarantees - { rare: 1, epic: 0, legendary: 0 }
     * @param {Array<Object>|null} pool - optional source pool
     * @returns {Array<Card>}
     */
    generatePackSimulated(count = 5, dropRates = window.VinylDexPack.DEFAULT_DROP_RATES, guarantees = {}, pool = null) {
      const normalized = this.normalizeDropRates(dropRates);
      const result = [];
      const exclude = [];
      const sourcePool = Array.isArray(pool) ? pool : (window.VinylDexArtists || []);

      // 1) Applica garanzie (legendary, epic, rare) in ordine
      const guaranteeOrder = ['legendary', 'epic', 'rare'];
      for (const key of guaranteeOrder) {
        const guaranteeCount = Math.max(0, parseInt(guarantees[key] || 0, 10));
        for (let i = 0; i < guaranteeCount && result.length < count; i++) {
          const c = this.generateCardForRarity(key, exclude, sourcePool);
          if (c) {
            result.push(c);
            exclude.push(c.id);
          }
        }
      }

      // 2) Riempie i rimanenti con weighted rarity selection
      while (result.length < count) {
        const selectedRarity = this.pickRarity(normalized);
        const c = this.generateCardForRarity(selectedRarity, exclude, sourcePool);
        if (c) {
          result.push(c);
          exclude.push(c.id);
          continue;
        }
        // Se non ci sono carte di quella rarità rimaste (stateless), proviamo un'altra rarità:
        // Per evitare loop infiniti, cerchiamo qualsiasi carta disponibile
        const anyCard = window.VinylDexRandom.randomItem(sourcePool.filter(a => !exclude.includes(a.id)));
        if (!anyCard) break; // pool esaurito
        const inst = new window.VinylDexCard({ ...anyCard, obtainedAt: Date.now() });
        result.push(inst);
        exclude.push(inst.id);
      }

      return result;
    },

    /**
     * Simula estrazioni di rarità per verificare l'osservata distribuzione rispetto ai dropRates.
     * Restituisce mappa rarity -> count.
     *
     * @param {Object} dropRates
     * @param {number} trials
     * @returns {Object}
     */
    simulateRarityDistribution(dropRates, trials = 10000) {
      const normalized = this.normalizeDropRates(dropRates);
      const choices = Object.entries(normalized).map(([rarity, weight]) => ({ item: rarity, weight }));
      const counts = {};
      for (let i = 0; i < trials; i++) {
        const r = window.VinylDexRandom.weightedRandom(choices);
        counts[r] = (counts[r] || 0) + 1;
      }
      return counts;
    },

    /**
     * Helper: converte counts in percentuale.
     * @param {Object} counts
     * @param {number} trials
     * @returns {Object} rarity -> percentage
     */
    toPercentage(counts, trials) {
      const res = {};
      Object.entries(counts).forEach(([k, v]) => {
        res[k] = (v / trials) * 100;
      });
      return res;
    }
  };

  // Export globale
  window.VinylDexGenerator = VinylDexGenerator;
})();