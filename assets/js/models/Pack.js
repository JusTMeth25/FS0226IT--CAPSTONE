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
    const cards = [];
    const guaranteedCards = [];
    const remainingCards = [...allCards];

    // 1. Assicura le garanzie
    if (this.guarantees.legendary > 0) {
      const legendaryCards = remainingCards.filter(c => c.rarity === 'legendary');
      for (let i = 0; i < this.guarantees.legendary && legendaryCards.length > 0; i++) {
        const idx = Math.floor(Math.random() * legendaryCards.length);
        guaranteedCards.push(legendaryCards.splice(idx, 1)[0]);
        // Rimuovi anche da remainingCards
        const remIdx = remainingCards.findIndex(c => c.id === guaranteedCards[guaranteedCards.length - 1].id);
        if (remIdx >= 0) remainingCards.splice(remIdx, 1);
      }
    }

    if (this.guarantees.epic > 0) {
      const epicCards = remainingCards.filter(c => c.rarity === 'epic');
      for (let i = 0; i < this.guarantees.epic && epicCards.length > 0; i++) {
        const idx = Math.floor(Math.random() * epicCards.length);
        guaranteedCards.push(epicCards.splice(idx, 1)[0]);
        const remIdx = remainingCards.findIndex(c => c.id === guaranteedCards[guaranteedCards.length - 1].id);
        if (remIdx >= 0) remainingCards.splice(remIdx, 1);
      }
    }

    if (this.guarantees.rare > 0) {
      const rareCards = remainingCards.filter(c => c.rarity === 'rare');
      for (let i = 0; i < this.guarantees.rare && rareCards.length > 0; i++) {
        const idx = Math.floor(Math.random() * rareCards.length);
        guaranteedCards.push(rareCards.splice(idx, 1)[0]);
        const remIdx = remainingCards.findIndex(c => c.id === guaranteedCards[guaranteedCards.length - 1].id);
        if (remIdx >= 0) remainingCards.splice(remIdx, 1);
      }
    }

    // Aggiungi le carte garantite al risultato
    guaranteedCards.forEach(c => cards.push(new Card(c)));

    // 2. Riempie il resto con weighted random
    const remainingSlots = this.cardCount - cards.length;
    for (let i = 0; i < remainingSlots && remainingCards.length > 0; i++) {
      // Prepara weighted choices per rarità
      const rarityChoices = Object.entries(this.dropRates).map(([rarity, weight]) => ({
        item: rarity,
        weight: weight
      }));

      // Seleziona una rarità
      const selectedRarity = window.VinylDexRandom.weightedRandom(rarityChoices);

      // Filtra carte della rarità selezionata ancora disponibili
      const availableCards = remainingCards.filter(c => c.rarity === selectedRarity);

      if (availableCards.length > 0) {
        const idx = Math.floor(Math.random() * availableCards.length);
        const selectedCard = availableCards[idx];
        cards.push(new Card(selectedCard));
        // Rimuovi la carta selezionata dal pool
        const remIdx = remainingCards.findIndex(c => c.id === selectedCard.id);
        if (remIdx >= 0) remainingCards.splice(remIdx, 1);
      } else {
        // Se nessuna carta della rarità selezionata è disponibile, riprova
        i--;
        continue;
      }
    }

    return cards;
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