/**
 * VinylDex - Pack Model
 * 
 * Rappresenta un pacchetto di carte apribile.
 * Gestisce la logica di apertura con weighted random basato sui drop rate.
 */
class Pack {
  /**
   * @param {Object} config - Configurazione del pacchetto
   * @param {string} config.id - Identificativo
   * @param {string} config.name - Nome visualizzato
   * @param {string} config.description - Descrizione
   * @param {number} config.price - Prezzo in gold (0 = gratuito)
   * @param {number} config.cardCount - Numero di carte per pacchetto
   * @param {Object} config.dropRates - Drop rate { common: 0.5, uncommon: 0.3, rare: 0.12, epic: 0.06, legendary: 0.02 }
   * @param {Object} config.guarantees - Garanzie minime { rare: 1, epic: 0, legendary: 0 }
   * @param {string} config.img - Nome file immagine pacchetto
   * @param {boolean} config.isFree - Se è un pacchetto gratuito (cooldown 4h)
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.price = config.price || 0;
    this.cardCount = config.cardCount || 5;
    this.dropRates = config.dropRates || Pack.DEFAULT_DROP_RATES;
    this.guarantees = config.guarantees || { rare: 0, epic: 0, legendary: 0 };
    this.img = config.img || '';
    this.isFree = config.isFree || false;
  }

  /**
   * Apre il pacchetto e restituisce un array di carte.
   * Applica le garanzie minime e poi riempie con carte random.
   * 
   * @param {Array} allCards - Array di tutte le carte disponibili nel database
   * @returns {Array<Card>} Carte ottenute
   */
  open(allCards) {
    // Refactor: delega la logica di selezione/garanzie al VinylDexGenerator.
    // Se viene passato un pool custom (allCards) lo usiamo temporaneamente per la generazione.
    const originalPool = window.VinylDexArtists;
    try {
      if (Array.isArray(allCards) && allCards.length > 0) {
        window.VinylDexArtists = allCards;
      }
      // generatePackSimulated restituisce istanze di Card già marcate obtainedAt
      const generated = window.VinylDexGenerator.generatePackSimulated(this.cardCount, this.dropRates, this.guarantees);
      return generated;
    } finally {
      // Ripristina il pool globale
      window.VinylDexArtists = originalPool;
    }
  }

  /**
   * Verifica se il pacchetto gratuito è disponibile (cooldown 4 ore).
   * @param {StorageService} storage - Istanza di StorageService
   * @returns {boolean}
   */
  isFreeAvailable(storage) {
    if (!this.isFree) return false;
    const lastTime = storage.getLastFreePackTime();
    if (lastTime === 0) return true;
    const cooldownMs = 4 * 60 * 60 * 1000; // 4 ore
    return (Date.now() - lastTime) >= cooldownMs;
  }

  /**
   * Calcola il tempo rimanente per il prossimo pacchetto gratuito.
   * @param {StorageService} storage
   * @returns {number} Millisecondi rimanenti (0 se disponibile)
   */
  getFreeCooldownRemaining(storage) {
    if (!this.isFree) return 0;
    const lastTime = storage.getLastFreePackTime();
    if (lastTime === 0) return 0;
    const cooldownMs = 4 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastTime;
    return Math.max(0, cooldownMs - elapsed);
  }

  // ===== DROP RATE DI DEFAULT =====
  static get DEFAULT_DROP_RATES() {
    return {
      common: 0.50,
      uncommon: 0.30,
      rare: 0.12,
      epic: 0.06,
      legendary: 0.02
    };
  }
}

// Export globale
window.VinylDexPack = Pack;