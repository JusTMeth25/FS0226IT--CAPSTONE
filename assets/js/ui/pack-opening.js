/**
 * VinylDex - Pack Opening UI (Feature 3)
 * 
 * Gestisce:
 * - Schermata selezione pacchetto (3 tipi)
 * - Logica costo/consumo gold + cooldown free pack
 * - Animazione apertura pacchetto con flip/rivelazione
 * - Rivelazione carte una alla volta con effetto glow
 * - Aggiunta automatica alla collezione
 * - Schermata riepilogo con "Apri un altro"
 */
const VinylDexPackOpening = {
  /** Stato corrente: 'select' | 'opening' | 'reveal' | 'summary' */
  _state: 'select',
  
  /** Carte ottenute nell'ultima apertura */
  _lastCards: [],

  /** Timer per la rivelazione progressiva */
  _revealTimers: [],

  /** Pacchetto selezionato */
  _selectedPack: null,

  /**
   * Renderizza la schermata di selezione pacchetti.
   * @param {HTMLElement} container
   * @param {Object} params
   */
  render(container, params) {
    const storage = new window.VinylDexStorage();
    const gold = storage.getGold();

    // Verifica stato pacchetto gratuito
    const basePackConfig = window.VinylDexPacks[0];
    const basePack = new window.VinylDexPack(basePackConfig);
    const isFreeAvailable = basePack.isFreeAvailable(storage);

    container.innerHTML = `
      <section class="packs-page">
        <h2 class="section-title text-gradient">🎁 Apri un Pacchetto</h2>
        <p class="text-center packs-subtitle">Scegli il pacchetto che vuoi aprire</p>

        <!-- Gold Display -->
        <div class="gold-display glass-panel">
          <span class="gold-icon">🪙</span>
          <span class="gold-amount">${gold}</span>
          <span class="gold-label">Gold disponibili</span>
        </div>

        <!-- Packs Grid -->
        <div class="packs-grid">
          ${window.VinylDexPacks.map(packConfig => this._renderPackCard(packConfig, storage, isFreeAvailable)).join('')}
        </div>
      </section>
    `;
  },

  /**
   * Renderizza una card di selezione pacchetto.
   * @param {Object} packConfig
   * @param {StorageService} storage
   * @param {boolean} isFreeAvailable
   * @returns {string} HTML
   */
  _renderPackCard(packConfig, storage, isFreeAvailable) {
    const pack = new window.VinylDexPack(packConfig);
    const gold = storage.getGold();
    const canAfford = packConfig.price <= gold || packConfig.isFree;
    const isAvailable = packConfig.isFree ? isFreeAvailable : canAfford;

    // Calcola cooldown rimanente per free pack
    let cooldownHTML = '';
    if (packConfig.isFree && !isFreeAvailable) {
      const remaining = pack.getFreeCooldownRemaining(storage);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      cooldownHTML = `<span class="pack-cooldown">⏳ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}</span>`;
    }

    // Simbolo basato sul tipo
    let icon = '🎁';
    if (packConfig.id === 'pack-deluxe') icon = '💎';
    if (packConfig.id === 'pack-premium') icon = '👑';

    // Gradiente colore basato sul tipo
    let gradient = 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))';
    if (packConfig.id === 'pack-deluxe') gradient = 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))';
    if (packConfig.id === 'pack-premium') gradient = 'linear-gradient(135deg, #FFD700, #FFA500)';

    // Bottone
    let buttonText = 'Apri Gratis';
    if (!packConfig.isFree) buttonText = `Apri (${packConfig.price} 🪙)`;
    if (packConfig.isFree && !isFreeAvailable) buttonText = 'Non disponibile';

    return `
      <div class="pack-card glass-panel ${!isAvailable ? 'pack-disabled' : ''}" 
           data-pack-id="${packConfig.id}"
           onclick="${isAvailable ? `VinylDexPackOpening.openPack('${packConfig.id}')` : ''}">
        <div class="pack-card-header" style="background: ${gradient}">
          <span class="pack-icon">${icon}</span>
          <span class="pack-card-count">${packConfig.cardCount} carte</span>
        </div>
        <div class="pack-card-body">
          <h3 class="pack-card-name">${packConfig.name}</h3>
          <p class="pack-card-desc">${packConfig.description}</p>
          <div class="pack-card-details">
            <div class="pack-detail">
              <span class="pack-detail-label">Garanzie</span>
              <span class="pack-detail-value">
                ${packConfig.guarantees.legendary > 0 ? '🏆 Leggendaria' : ''}
                ${packConfig.guarantees.epic > 0 ? '💜 Epica' : ''}
                ${packConfig.guarantees.rare > 0 ? '🔮 1+ Rara' : ''}
                ${packConfig.guarantees.legendary === 0 && packConfig.guarantees.epic === 0 && packConfig.guarantees.rare === 0 ? 'Nessuna' : ''}
              </span>
            </div>
            <div class="pack-detail">
              <span class="pack-detail-label">Drop Leggendaria</span>
              <span class="pack-detail-value" style="color: var(--rarity-legendary);">
                ${(packConfig.dropRates.legendary * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          ${cooldownHTML}
          <button class="btn ${isAvailable ? (packConfig.id === 'pack-premium' ? 'btn-gold' : 'btn-primary') : 'btn-secondary'}" 
                  ${isAvailable ? '' : 'disabled'}>
            ${buttonText}
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Avvia l'apertura del pacchetto selezionato.
   * @param {string} packId
   */
  openPack(packId) {
    const packConfig = window.VinylDexPacks.find(p => p.id === packId);
    if (!packConfig) return;

    const pack = new window.VinylDexPack(packConfig);
    const storage = new window.VinylDexStorage();
    const gold = storage.getGold();

    // Verifica se può permetterselo
    if (!packConfig.isFree && gold < packConfig.price) {
      this._showNotEnoughGold();
      return;
    }

    // Verifica cooldown free pack
    if (packConfig.isFree && !pack.isFreeAvailable(storage)) {
      return; // Il pulsante è già disabilitato
    }

    // Consuma gold o aggiorna cooldown
    if (!packConfig.isFree) {
      storage.addGold(-packConfig.price);
    } else {
      storage.setLastFreePackTime(Date.now());
    }

    // Apri il pacchetto
    const cards = pack.open(window.VinylDexArtists);
    this._lastCards = [];

    // Salva le carte nella collezione
    const cardDataArray = cards.map(c => c.toJSON());
    storage.addCardsToCollection(cardDataArray);

    // Aggiorna stats
    const stats = storage.getStats();
    stats.totalPacksOpened = (stats.totalPacksOpened || 0) + 1;
    stats.totalCardsObtained = (stats.totalCardsObtained || 0) + cards.length;
    cards.forEach(c => {
      const r = c.rarity;
      if (r === 'legendary') stats.legendaryCount = (stats.legendaryCount || 0) + 1;
      else if (r === 'epic') stats.epicCount = (stats.epicCount || 0) + 1;
      else if (r === 'rare') stats.rareCount = (stats.rareCount || 0) + 1;
      else if (r === 'uncommon') stats.uncommonCount = (stats.uncommonCount || 0) + 1;
      else if (r === 'common') stats.commonCount = (stats.commonCount || 0) + 1;
    });
    storage.updateStats(stats);

    // Mostra animazione apertura
    this._selectedPack = packConfig;
    this._showOpeningAnimation(cards);
  },

  /**
   * Mostra schermata "non abbastanza gold".
   */
  _showNotEnoughGold() {
    const container = document.getElementById('app-view');
    const overlay = document.createElement('div');
    overlay.className = 'pack-overlay';
    overlay.innerHTML = `
      <div class="pack-modal glass-panel">
        <div class="pack-modal-icon">😅</div>
        <h3>Gold insufficienti!</h3>
        <p>Non hai abbastanza gold per questo pacchetto.</p>
        <p class="text-muted">Completa missioni e battaglie per guadagnare gold!</p>
        <button class="btn btn-primary" onclick="this.closest('.pack-overlay').remove()">Chiudi</button>
      </div>
    `;
    container.appendChild(overlay);
    // Auto-rimuovi dopo 3 secondi
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 3000);
  },

  /**
   * Mostra l'animazione di apertura del pacchetto.
   * @param {Array<Card>} cards
   */
  _showOpeningAnimation(cards) {
    this._state = 'opening';
    const container = document.getElementById('app-view');

    // Prendi un'icona per il pacchetto
    let icon = '🎁';
    if (this._selectedPack.id === 'pack-deluxe') icon = '💎';
    if (this._selectedPack.id === 'pack-premium') icon = '👑';

    container.innerHTML = `
      <section class="pack-opening-page">
        <h2 class="section-title text-gradient">Apertura Pacchetto</h2>
        <div class="pack-opening-animation">
          <div class="pack-box" id="pack-box">
            <div class="pack-box-inner">
              <div class="pack-box-front">
                <span class="pack-box-icon">${icon}</span>
                <span class="pack-box-label">${this._selectedPack.name}</span>
              </div>
              <div class="pack-box-back">
                <span class="pack-box-sparkle">✨</span>
              </div>
            </div>
          </div>
          <p class="pack-opening-text" id="pack-opening-text">Apertura in corso...</p>
        </div>

        <!-- Card Reveal Grid (hidden until after animation) -->
        <div class="pack-reveal-grid" id="pack-reveal-grid" style="display:none;">
          ${cards.map((_, i) => `
            <div class="pack-reveal-slot" id="pack-slot-${i}">
              <div class="pack-reveal-card pack-reveal-placeholder">
                <div class="pack-reveal-card-inner">
                  <div class="pack-reveal-front">❓</div>
                  <div class="pack-reveal-back"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Summary Button (hidden until all revealed) -->
        <div class="pack-summary-actions" id="pack-summary-actions" style="display:none;">
          <button class="btn btn-primary" onclick="window.location.hash='#packs'">
            🎁 Apri un Altro
          </button>
          <button class="btn btn-secondary" onclick="window.location.hash='#collection'">
            🃏 Vai alla Collezione
          </button>
        </div>
      </section>
    `;

    // Step 1: Animazione apertura scatola (1.5s)
    const packBox = document.getElementById('pack-box');
    const openingText = document.getElementById('pack-opening-text');

    setTimeout(() => {
      packBox.classList.add('pack-box-open');
      openingText.textContent = '✨ Le carte stanno per essere rivelate...';
    }, 300);

    // Step 2: Mostra griglia carte (dopo animazione scatola)
    setTimeout(() => {
      const revealGrid = document.getElementById('pack-reveal-grid');
      revealGrid.style.display = 'grid';
      openingText.textContent = '🎵 Ecco le tue nuove carte!';
      
      // Step 3: Rivela carte una alla volta con ritardo
      this._revealCardsOneByOne(cards);
    }, 1800);
  },

  /**
   * Rivela le carte una alla volta con effetto flip.
   * @param {Array<Card>} cards
   */
  _revealCardsOneByOne(cards) {
    this._state = 'reveal';
    this._revealTimers = [];

    cards.forEach((card, index) => {
      const timer = setTimeout(() => {
        const slot = document.getElementById(`pack-slot-${index}`);
        if (!slot) return;

        const cardObj = card instanceof window.VinylDexCard ? card : new window.VinylDexCard(card);
        const rarityClass = cardObj.getRarityCSSClass();
        const color = cardObj.getRarityColor();
        const stars = cardObj.getStars();

        // Sostituisci placeholder con carta reale
        slot.innerHTML = `
          <div class="pack-reveal-card ${rarityClass} pack-reveal-flip">
            <div class="pack-reveal-card-inner">
              <div class="pack-reveal-art">
                <img src="${cardObj.img}" alt="${cardObj.name}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
              </div>
              <div class="pack-reveal-info">
                <span class="pack-reveal-badge" style="background:${color};">${cardObj.getRarityName()}</span>
                <span class="pack-reveal-name">${cardObj.name}</span>
                <span class="pack-reveal-class">${cardObj.artistClass}</span>
                <span class="pack-reveal-stars" style="color:${color};">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>
              </div>
            </div>
          </div>
        `;

        // Aggiungi effetto sparkle per leggendarie
        if (cardObj.rarity === 'legendary') {
          this._addSparkleEffect(slot);
        }

        this._lastCards.push(cardObj);

        // Se è l'ultima carta, mostra i pulsanti summary
        if (index === cards.length - 1) {
          setTimeout(() => {
            this._state = 'summary';
            const summaryActions = document.getElementById('pack-summary-actions');
            if (summaryActions) {
              summaryActions.style.display = 'flex';
              // Scroll nella view
              summaryActions.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 600);
        }
      }, index * 500 + 200); // 500ms tra ogni carta

      this._revealTimers.push(timer);
    });
  },

  /**
   * Aggiunge effetto sparkle a un elemento carta.
   * @param {HTMLElement} slot
   */
  _addSparkleEffect(slot) {
    const sparkles = ['✨', '⭐', '🌟', '💫'];
    for (let i = 0; i < 6; i++) {
      const spark = document.createElement('span');
      spark.className = 'pack-sparkle';
      spark.textContent = sparkles[i % sparkles.length];
      spark.style.left = `${10 + Math.random() * 80}%`;
      spark.style.top = `${10 + Math.random() * 60}%`;
      spark.style.animationDelay = `${Math.random() * 1}s`;
      spark.style.fontSize = `${0.6 + Math.random() * 0.6}rem`;
      slot.appendChild(spark);
    }
  },

  /**
   * Pulisce timer (chiamato dal router quando si cambia pagina).
   */
  destroy() {
    this._revealTimers.forEach(t => clearTimeout(t));
    this._revealTimers = [];
    this._lastCards = [];
    this._state = 'select';
    this._selectedPack = null;
  }
};

// Export globale
window.VinylDexPackOpening = VinylDexPackOpening;