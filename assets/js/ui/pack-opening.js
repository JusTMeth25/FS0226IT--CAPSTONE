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
        <h2 class="section-title text-gradient"><i class="ph-fill ph-gift"></i> Apri un Pacchetto</h2>
        <p class="text-center packs-subtitle">Scegli il pacchetto che vuoi aprire</p>

        <!-- Gold Display -->
        <div class="gold-display glass-panel">
          <span class="gold-icon"><i class="ph-fill ph-coin"></i></span>
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
    const canAffordPaid = gold >= packConfig.price;

    // Calcola cooldown rimanente per il pacchetto gratuito (invariato)
    let cooldownText = '';
    if (packConfig.isFree && !isFreeAvailable) {
      const remaining = pack.getFreeCooldownRemaining(storage);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      cooldownText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Simbolo basato sul tipo
    let icon = '<i class="ph-fill ph-gift"></i>';
    if (packConfig.id === 'pack-deluxe') icon = '<i class="ph-fill ph-diamond"></i>';
    if (packConfig.id === 'pack-premium') icon = '<i class="ph-fill ph-crown"></i>';

    // Gradiente colore basato sul tipo
    let gradient = 'linear-gradient(135deg, var(--neon-purple), var(--neon-magenta))';
    if (packConfig.id === 'pack-deluxe') gradient = 'linear-gradient(135deg, var(--neon-blue), var(--neon-cyan))';
    if (packConfig.id === 'pack-premium') gradient = 'linear-gradient(135deg, #FFD700, #FFA500)';

    // Badge sopra l'artwork: per i pacchetti con opzione gratuita mostra lo stato del timer
    // (invariato — gratis disponibile o countdown), per gli altri il prezzo in gold.
    let priceBadgeHTML;
    if (packConfig.isFree) {
      priceBadgeHTML = isFreeAvailable
        ? `<span class="pack-card-price-badge pack-card-price-free"><i class="ph-fill ph-sparkle"></i> Gratis</span>`
        : `<span class="pack-card-price-badge"><i class="ph-fill ph-hourglass"></i> ${cooldownText}</span>`;
    } else {
      priceBadgeHTML = `<span class="pack-card-price-badge"><i class="ph-fill ph-coin"></i> ${packConfig.price}</span>`;
    }

    // Bottoni azione: i pacchetti con opzione gratuita (solo Base) mostrano DUE bottoni
    // (apri gratis, se disponibile + compra sempre con gold); gli altri solo l'acquisto.
    // Il bottone d'acquisto non è mai "disabled": se i gold non bastano resta cliccabile
    // per mostrare il messaggio di credito insufficiente.
    let actionsHTML;
    if (packConfig.isFree) {
      const freeBtnHTML = isFreeAvailable
        ? `<button class="btn btn-primary" onclick="event.stopPropagation();VinylDexPackOpening.openPack('${packConfig.id}','free')">
             <i class="ph-fill ph-sparkle"></i> Apri Gratis
           </button>`
        : `<button class="btn btn-secondary" disabled>
             <i class="ph-fill ph-hourglass"></i> Gratis tra ${cooldownText}
           </button>`;
      // Se il gratis è disponibile il "compra" resta secondario (il gratis è la scelta ovvia);
      // se il gratis è in cooldown, diventa l'azione primaria (se i gold bastano).
      const buyBtnClass = (!isFreeAvailable && canAffordPaid) ? 'btn-primary' : 'btn-secondary';
      const buyBtnHTML = `
        <button class="btn ${buyBtnClass}" onclick="event.stopPropagation();VinylDexPackOpening.openPack('${packConfig.id}','paid')">
          <i class="ph-fill ph-coin"></i> Compra (${packConfig.price})
        </button>`;
      actionsHTML = `<div class="pack-card-actions">${freeBtnHTML}${buyBtnHTML}</div>`;
    } else {
      actionsHTML = `
        <button class="btn ${canAffordPaid ? (packConfig.id === 'pack-premium' ? 'btn-gold' : 'btn-primary') : 'btn-secondary'}"
                onclick="event.stopPropagation();VinylDexPackOpening.openPack('${packConfig.id}','paid')">
          <i class="ph-fill ph-coin"></i> Apri Pacchetto (${packConfig.price})
        </button>`;
    }

    return `
      <div class="pack-card glass-panel" data-pack-id="${packConfig.id}">
        <div class="pack-card-header" style="background: ${gradient}">
          <span class="pack-card-zigzag"></span>
          <span class="pack-card-brand"><i class="ph-fill ph-lightning"></i> VinylLegends</span>
          <span class="pack-card-count">${packConfig.cardCount} carte</span>
          <span class="pack-icon">${icon}</span>
          <h3 class="pack-card-name">${packConfig.name}</h3>
          ${priceBadgeHTML}
        </div>
        <div class="pack-card-body">
          <p class="pack-card-desc">${packConfig.description}</p>
          ${this._renderRarityLadder()}
          ${actionsHTML}
          <div class="pack-card-barcode"></div>
          <span class="pack-card-barcode-text">VDX-${packConfig.id.replace('pack-', '').toUpperCase().padEnd(3, 'X')}-${packConfig.cardCount}${packConfig.price.toString().padStart(3, '0')}</span>
        </div>
      </div>
    `;
  },

  /**
   * Renderizza la lista delle rarità ottenibili (stile "retro bustina"),
   * ciascuna colorata con il colore di rarità già usato in tutta l'app.
   * @returns {string} HTML
   */
  _renderRarityLadder() {
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    return `
      <div class="pack-card-rarity-list">
        ${rarities.map(key => {
          const data = window.VinylDexCard.RARITIES[key];
          return `<span style="color:${data.color}">${data.name.toUpperCase()}</span>`;
        }).join('')}
      </div>
    `;
  },

  /**
   * Avvia l'apertura del pacchetto selezionato.
   * @param {string} packId
   * @param {string} mode - 'free' (solo per pacchetti con isFree, se il cooldown lo consente) o 'paid'
   *                         (sempre disponibile, consuma gold). Default 'paid'.
   */
  async openPack(packId, mode = 'paid') {
    const packConfig = window.VinylDexPacks.find(p => p.id === packId);
    if (!packConfig) return;

    const pack = new window.VinylDexPack(packConfig);
    const storage = new window.VinylDexStorage();
    const gold = storage.getGold();

    const useFree = packConfig.isFree && mode === 'free';

    if (useFree) {
      // Cooldown non ancora scaduto: il bottone gratis è già disabilitato in questo caso
      if (!pack.isFreeAvailable(storage)) return;
    } else if (gold < packConfig.price) {
      // Percorso a pagamento (sempre disponibile, anche per il pacchetto Base) ma gold insufficienti
      this._showNotEnoughGold();
      return;
    }

    // Consuma gold o aggiorna il cooldown del gratuito
    if (useFree) {
      storage.setLastFreePackTime(Date.now());
    } else {
      storage.addGold(-packConfig.price);
    }

    // Prova prima l'apertura tramite API (se disponibile), altrimenti fallback locale
    let cards;
    const api = window.VinylDexApiService || null;
    if (api && navigator.onLine) {
      try {
        const res = await api.openPack(packId);
        // Il backend dovrebbe restituire { cards: [...] } con DTO compatibili
        if (res && Array.isArray(res.cards) && res.cards.length) {
          cards = res.cards.map(c => new window.VinylDexCard(c));
        } else {
          cards = pack.open(window.VinylDexArtists);
        }
      } catch (err) {
        console.warn('API openPack failed, fallback to local pack.open()', err);
        cards = pack.open(window.VinylDexArtists);
      }
    } else {
      cards = pack.open(window.VinylDexArtists);
    }
    
    this._lastCards = [];


    // Salva le carte nella collezione (salva DTO) — usiamo oggetti aggiornati (con eventuale img AI)
    const cardDataArray = cards.map(c => (c instanceof window.VinylDexCard ? c.toJSON() : c));
    storage.addCardsToCollection(cardDataArray);

    // Tentativo best-effort di sincronizzazione col server (non bloccante)
    if (api && navigator.onLine) {
      try {
        // Endpoint di sincronizzazione lato server (best-effort). Ignora errori.
        api.post('/sync/cards', { cards: cardDataArray }).catch(() => {});
      } catch (e) {
        // Ignora
      }
    }

    // Aggiorna stats
    const stats = storage.getStats();
    stats.totalPacksOpened = (stats.totalPacksOpened || 0) + 1;
    stats.totalCardsObtained = (stats.totalCardsObtained || 0) + cards.length;
    cards.forEach(c => {
      const r = c.rarity || (c instanceof window.VinylDexCard ? c.rarity : c.rarity);
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
        <div class="pack-modal-icon"><i class="ph-fill ph-warning-circle"></i></div>
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
    let icon = '<i class="ph-fill ph-gift"></i>';
    if (this._selectedPack.id === 'pack-deluxe') icon = '<i class="ph-fill ph-diamond"></i>';
    if (this._selectedPack.id === 'pack-premium') icon = '<i class="ph-fill ph-crown"></i>';

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
                <span class="pack-box-sparkle"><i class="ph-fill ph-sparkle"></i></span>
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
                  <div class="pack-reveal-front"><i class="ph ph-question"></i></div>
                  <div class="pack-reveal-back"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Summary Button (hidden until all revealed) -->
        <div class="pack-summary-actions" id="pack-summary-actions" style="display:none;">
          <button class="btn btn-primary" onclick="window.VinylDexPackOpening.render(document.getElementById('app-view'), {})">
            <i class="ph-fill ph-gift"></i> Apri un Altro
          </button>
          <button class="btn btn-secondary" onclick="window.location.hash='#collection'">
            <i class="ph-fill ph-cards"></i> Vai alla Collezione
          </button>
        </div>
      </section>
    `;

    // Step 1: Animazione apertura scatola (1.5s)
    const packBox = document.getElementById('pack-box');
    const openingText = document.getElementById('pack-opening-text');

    setTimeout(() => {
      packBox.classList.add('pack-box-open');
      openingText.innerHTML = '<i class="ph-fill ph-sparkle"></i> Le carte stanno per essere rivelate...';
    }, 300);

    // Step 2: Mostra griglia carte (dopo animazione scatola)
    setTimeout(() => {
      const revealGrid = document.getElementById('pack-reveal-grid');
      revealGrid.style.display = 'grid';
      openingText.innerHTML = '<i class="ph-fill ph-vinyl-record"></i> Ecco le tue nuove carte!';
      
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

        let cardHTML;
        if (cardObj.fullImage) {
          cardHTML = `
            <div class="pack-reveal-card ${rarityClass} pack-reveal-flip"
                 style="overflow:hidden;border-radius:12px;position:relative;">
              <img src="${cardObj.img}" alt="${cardObj.name}" 
                   onerror="this.style.display='none'" 
                   style="width:100%;height:100%;object-fit:cover;border-radius:12px;">
              <span class="pack-reveal-badge" style="background:${color};position:absolute;top:8px;left:8px;z-index:2;font-size:0.7rem;padding:2px 6px;border-radius:4px;">${cardObj.getRarityName()}</span>
            </div>
          `;
        } else {
          cardHTML = `
            <div class="pack-reveal-card ${rarityClass} pack-reveal-flip">
              <div class="pack-reveal-card-inner">
                <div class="pack-reveal-art">
                  <img src="${cardObj.img}" alt="${cardObj.name}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div class="pack-reveal-info">
                  <span class="pack-reveal-badge" style="background:${color};">${cardObj.getRarityName()}</span>
                  <span class="pack-reveal-name">${cardObj.name}</span>
                  <span class="pack-reveal-class">${cardObj.artistClass}</span>
                  <span class="pack-reveal-stars">${cardObj.getStarsHTML()}</span>
                </div>
              </div>
            </div>
          `;
        }
        slot.innerHTML = cardHTML;

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
    const sparkles = ['ph-sparkle', 'ph-star', 'ph-confetti'];
    for (let i = 0; i < 6; i++) {
      const spark = document.createElement('span');
      spark.className = 'pack-sparkle';
      spark.innerHTML = `<i class="ph-fill ${sparkles[i % sparkles.length]}"></i>`;
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