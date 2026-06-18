/**
 * VinylDex - LocalStorage Service
 * 
 * Wrapper per gestire il salvataggio/caricamento dei dati utente
 * su LocalStorage. Fornisce metodi CRUD tipati con fallback safe.
 */
class StorageService {
  constructor() {
    this.prefix = 'vinylDex_';
  }

  /**
   * Salva un valore in LocalStorage.
   * @param {string} key - Chiave (senza prefisso)
   * @param {*} value - Valore (verrà serializzato in JSON)
   * @returns {boolean} true se salvato con successo
   */
  set(key, value) {
    try {
      const data = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, data);
      return true;
    } catch (error) {
      console.error(`[StorageService] Errore salvataggio "${key}":`, error);
      return false;
    }
  }

  /**
   * Carica un valore da LocalStorage.
   * @param {string} key - Chiave (senza prefisso)
   * @param {*} defaultValue - Valore di default se la chiave non esiste
   * @returns {*} Valore deserializzato o defaultValue
   */
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(this.prefix + key);
      if (data === null) return defaultValue;
      return JSON.parse(data);
    } catch (error) {
      console.error(`[StorageService] Errore caricamento "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Rimuove un valore da LocalStorage.
   * @param {string} key - Chiave (senza prefisso)
   * @returns {boolean} true se rimosso con successo
   */
  remove(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error(`[StorageService] Errore rimozione "${key}":`, error);
      return false;
    }
  }

  /**
   * Verifica se una chiave esiste.
   * @param {string} key - Chiave (senza prefisso)
   * @returns {boolean}
   */
  has(key) {
    return localStorage.getItem(this.prefix + key) !== null;
  }

  /**
   * Aggiorna parzialmente un oggetto salvato (merge).
   * @param {string} key - Chiave (senza prefisso)
   * @param {Object} updates - Proprietà da aggiornare
   * @returns {boolean} true se aggiornato con successo
   */
  update(key, updates) {
    const current = this.get(key, {});
    return this.set(key, { ...current, ...updates });
  }

  /**
   * Aggiunge un elemento a un array salvato.
   * @param {string} key - Chiave (senza prefisso)
   * @param {*} item - Elemento da aggiungere
   * @returns {boolean} true se aggiunto con successo
   */
  pushToArray(key, item) {
    const arr = this.get(key, []);
    arr.push(item);
    return this.set(key, arr);
  }

  /**
   * Rimuove un elemento da un array salvato (filtra per callback).
   * @param {string} key - Chiave (senza prefisso)
   * @param {Function} predicate - Funzione che ritorna true per gli elementi da rimuovere
   * @returns {boolean} true se rimosso con successo
   */
  removeFromArray(key, predicate) {
    const arr = this.get(key, []);
    const filtered = arr.filter(item => !predicate(item));
    return this.set(key, filtered);
  }

  /**
   * Pulisce TUTTI i dati VinylDex da LocalStorage.
   * @returns {boolean} true se pulito con successo
   */
  clearAll() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('[StorageService] Errore clearAll:', error);
      return false;
    }
  }

  /**
   * Ottiene le statistiche di utilizzo dello storage.
   * @returns {Object} Statistiche { usedBytes, keysCount }
   */
  getStats() {
    let totalBytes = 0;
    let keysCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key);
        totalBytes += (key.length + (value ? value.length : 0)) * 2; // UTF-16
        keysCount++;
      }
    }
    return { usedBytes: totalBytes, keysCount };
  }

  // ===== CHIAVI SPECIFICHE VINYLDEX =====

  /** Chiave per la collezione dell'utente */
  static get COLLECTION_KEY() { return 'collection'; }
  
  /** Chiave per il numero di monete/gold */
  static get GOLD_KEY() { return 'gold'; }
  
  /** Chiave per l'esperienza/XP */
  static get XP_KEY() { return 'xp'; }
  
  /** Chiave per il livello */
  static get LEVEL_KEY() { return 'level'; }
  
  /** Chiave per il timestamp ultimo pacchetto gratuito */
  static get LAST_FREE_PACK_KEY() { return 'lastFreePack'; }
  
  /** Chiave per le missioni completate */
  static get MISSIONS_KEY() { return 'missions'; }
  
  /** Chiave per le statistiche utente */
  static get STATS_KEY() { return 'stats'; }

  // ===== METODI CONVENIENZA =====

  getCollection() {
    const stored = this.get(StorageService.COLLECTION_KEY, []);

    // "Ibrida" ogni carta posseduta con la versione più recente del database (assets/js/data/artists.js),
    // mantenendo solo il dato di possesso (obtainedAt). Senza questo, una carta ottenuta PRIMA di un
    // aggiornamento ai dati (es. nuova artwork, stats corrette) resterebbe per sempre con i dati vecchi,
    // anche se la stessa carta ottenuta oggi avrebbe quelli nuovi.
    if (!window.VinylDexArtists) return stored;
    return stored.map(entry => {
      const canonical = window.VinylDexArtists.find(a => a.id === entry.id);
      return canonical ? { ...canonical, obtainedAt: entry.obtainedAt } : entry;
    });
  }

  setCollection(cards) {
    return this.set(StorageService.COLLECTION_KEY, cards);
  }

  addCardToCollection(cardData) {
    const collection = this.getCollection();
    collection.push({
      ...cardData,
      obtainedAt: Date.now()
    });
    return this.setCollection(collection);
  }

  addCardsToCollection(cards) {
    const collection = this.getCollection();
    cards.forEach(card => {
      collection.push({
        ...card,
        obtainedAt: Date.now()
      });
    });
    return this.setCollection(collection);
  }

  getGold() {
    return this.get(StorageService.GOLD_KEY, 0);
  }

  setGold(amount) {
    return this.set(StorageService.GOLD_KEY, amount);
  }

  addGold(amount) {
    return this.setGold(this.getGold() + amount);
  }

  getXP() {
    return this.get(StorageService.XP_KEY, 0);
  }

  setXP(xp) {
    return this.set(StorageService.XP_KEY, xp);
  }

  addXP(amount) {
    return this.setXP(this.getXP() + amount);
  }

  getLevel() {
    return this.get(StorageService.LEVEL_KEY, 1);
  }

  setLevel(level) {
    return this.set(StorageService.LEVEL_KEY, level);
  }

  getLastFreePackTime() {
    return this.get(StorageService.LAST_FREE_PACK_KEY, 0);
  }

  setLastFreePackTime(timestamp) {
    return this.set(StorageService.LAST_FREE_PACK_KEY, timestamp);
  }

  getStats() {
    return this.get(StorageService.STATS_KEY, {
      totalPacksOpened: 0,
      totalCardsObtained: 0,
      legendaryCount: 0,
      epicCount: 0,
      rareCount: 0,
      uncommonCount: 0,
      commonCount: 0
    });
  }

  updateStats(updates) {
    const stats = this.getStats();
    return this.set(StorageService.STATS_KEY, { ...stats, ...updates });
  }
}

// Export globale
window.VinylDexStorage = StorageService;