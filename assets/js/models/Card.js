/**
 * VinylDex - Card Model
 * 
 * Rappresenta una carta collezionabile nell'universo VinylDex.
 * Contiene dati, metodi di utilità e factory per creare carte dal database.
 */
class Card {
  /**
   * @param {Object} data - Dati della carta
   * @param {string} data.id - Identificativo univoco (es. 'showman-001')
   * @param {string} data.name - Nome della carta (es. 'Royal Echo')
   * @param {string} data.artistClass - Classe artista (es. 'The Showman')
   * @param {string} data.variant - Variante
   * @param {string} data.rarity - Rarity key (es. 'legendary')
   * @param {string} data.img - Nome file immagine (es. 'showman-royal-echo.png')
   * @param {Object} data.stats - Statistiche { fans, style, influence, energy }
   * @param {string} data.description - Descrizione del personaggio
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.artistClass = data.artistClass;
    this.variant = data.variant;
    this.rarity = data.rarity;
    this.img = data.img || this._generatePlaceholderImg();
    this.stats = data.stats || { fans: 0, style: 0, influence: 0, energy: 0 };
    this.description = data.description || '';
    this.obtainedAt = data.obtainedAt || null;
    this.fullImage = data.fullImage === true;
  }

  /**
   * Restituisce l'oggetto rarità completo.
   * @returns {Object}
   */
  getRarityData() {
    return Card.RARITIES[this.rarity] || Card.RARITIES.common;
  }

  /**
   * Restituisce il nome localizzato della rarità.
   * @returns {string}
   */
  getRarityName() {
    return this.getRarityData().name;
  }

  /**
   * Restituisce il colore della rarità.
   * @returns {string}
   */
  getRarityColor() {
    return this.getRarityData().color;
  }

  /**
   * Restituisce il numero di stelle per la rarità.
   * @returns {number}
   */
  getStars() {
    return this.getRarityData().stars;
  }

  /**
   * Genera stringa HTML con le stelle piene/vuote.
   * @returns {string}
   */
  getStarsHTML() {
    const stars = this.getStars();
    const maxStars = 5;
    let html = '';
    for (let i = 0; i < maxStars; i++) {
      if (i < stars) {
        html += '<span class="star-filled" style="color: ' + this.getRarityColor() + ';"><i class="ph-fill ph-star"></i></span>';
      } else {
        html += '<span class="star-empty" style="color: #333;"><i class="ph ph-star"></i></span>';
      }
    }
    return html;
  }

  /**
   * Restituisce la classe CSS per il bordo glow della rarità.
   * @returns {string}
   */
  getRarityCSSClass() {
    return 'card-rarity-' + this.rarity;
  }

  /**
   * Calcola il punteggio totale (somma stats).
   * @returns {number}
   */
  getTotalScore() {
    return this.stats.fans + this.stats.style + this.stats.influence + this.stats.energy;
  }

  /**
   * Verifica se la carta è nella collezione dell'utente.
   * @returns {boolean}
   */
  isOwned() {
    return this.obtainedAt !== null;
  }

  /**
   * Genera un placeholder immagine basato su classe e colore rarità.
   * @returns {string}
   */
  _generatePlaceholderImg() {
    // Restituisce un placeholder SVG inline
    const color = this.getRarityColor().replace('#', '');
    const initial = this.name.charAt(0).toUpperCase();
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect width='200' height='280' fill='%23111B3D'/%3E%3Ccircle cx='100' cy='100' r='60' fill='%23${color}' opacity='0.3'/%3E%3Ctext x='100' y='115' text-anchor='middle' fill='%23${color}' font-size='48' font-weight='bold' font-family='sans-serif'%3E${initial}%3C/text%3E%3C/svg%3E`;
  }

  /**
   * Restituisce il nome della classe artista formattata per URL/CSS.
   * @returns {string}
   */
  getClassSlug() {
    return this.artistClass.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Converte la carta in un oggetto plain (per salvataggio).
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      artistClass: this.artistClass,
      variant: this.variant,
      rarity: this.rarity,
      img: this.img,
      stats: { ...this.stats },
      description: this.description,
      obtainedAt: this.obtainedAt,
      fullImage: this.fullImage
    };
  }

  /**
   * Crea un'istanza Card da dati plain (usato dopo deserializzazione).
   * @param {Object} data
   * @returns {Card}
   */
  static fromJSON(data) {
    return new Card(data);
  }

  /**
   * Crea una carta placeholder "non scoperta" per la VinylDex.
   * @param {string} id
   * @returns {Card}
   */
  static createUnknown(id) {
    return new Card({
      id: id,
      name: '???',
      artistClass: 'Sconosciuto',
      variant: '???',
      rarity: 'common',
      img: 'unknown',
      stats: { fans: 0, style: 0, influence: 0, energy: 0 },
      description: 'Carta non ancora scoperta. Apri pacchetti per trovarla!'
    });
  }

  // ===== DEFINIZIONE RARITÀ =====
  static get RARITIES() {
    return {
      common:    { id: 1, name: 'Comune',     stars: 1, color: '#4CAF50' },
      uncommon:  { id: 2, name: 'Non Comune', stars: 2, color: '#2196F3' },
      rare:      { id: 3, name: 'Rara',       stars: 3, color: '#8B5CF6' },
      epic:      { id: 4, name: 'Epica',      stars: 4, color: '#FF9800' },
      legendary: { id: 5, name: 'Leggendaria', stars: 5, color: '#FFD700' }
    };
  }
}

// Export globale
window.VinylDexCard = Card;