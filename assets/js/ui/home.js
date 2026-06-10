/**
 * VinylDex - Home Page UI (Enhanced)
 * 
 * Renderizza la home page con:
 * - Hero section con particelle musicali fluttuanti
 * - Statistiche utente (collezione, gold, livello, percentuale VinylDex)
 * - Notifica pacchetto gratuito disponibile con timer cooldown
 * - Pulsante "Apri Pacchetto"
 * - Ultime carte ottenute (carousel orizzontale scrollabile)
 * - Accesso rapido alle sezioni con animazioni
 * - Enhanced empty state per nuovi utenti
 */
const VinylDexHome = {
  /** Timer ID per il countdown del pacchetto gratuito */
  _cooldownInterval: null,

  /**
   * Renderizza la home page nel container.
   * @param {HTMLElement} container - Elemento #app-view
   * @param {Object} params - Parametri route (non usati per home)
   */
  render(container, params) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const gold = storage.getGold();
    const xp = storage.getXP();
    const level = storage.getLevel();
    const stats = storage.getStats();

    // Calcola percentuale VinylDex
    const totalCards = window.VinylDexArtists.length;
    const ownedCards = new Set(collection.map(c => c.id));
    const progressPercent = Math.round((ownedCards.size / totalCards) * 100);

    // Ultime 5 carte ottenute (più recenti)
    const recentCards = [...collection]
      .sort((a, b) => (b.obtainedAt || 0) - (a.obtainedAt || 0))
      .slice(0, 8);

    // Verifica stato pacchetto gratuito
    const basePack = new window.VinylDexPack(window.VinylDexPacks[0]);
    const isFreeAvailable = basePack.isFreeAvailable(storage);

    // Symbols per particelle musicali
    const musicSymbols = ['♪', '♫', '♩', '♬', '🎵', '🎶'];

    const getRandomParticle = () => musicSymbols[Math.floor(Math.random() * musicSymbols.length)];

    // Genera 8 particelle musicali per l'hero
    const particles = Array.from({ length: 8 }, (_, i) => ({
      symbol: getRandomParticle(),
      left: 10 + (i * 11) % 85,
      delay: i * 0.6,
      size: 0.8 + (i % 4) * 0.2
    }));

    container.innerHTML = `
      <section class="home-page">
        <!-- Hero Section with Particles -->
        <div class="home-hero glass-panel">
          <div class="hero-particles">
            ${particles.map(p => `
              <span class="hero-particle" 
                    style="left: ${p.left}%; animation-delay: ${p.delay}s; font-size: ${p.size}rem;">
                ${p.symbol}
              </span>
            `).join('')}
          </div>
          <h2 class="home-title text-gradient">Benvenuto su VinylLegends</h2>
          <p class="home-subtitle">Music card game</p>
          <button class="btn btn-primary btn-large" onclick="window.location.hash='#packs'">
            🎵 Apri un Pacchetto
          </button>
          ${this._renderFreePackNotice(isFreeAvailable, basePack, storage)}
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card glass-panel">
            <div class="stat-icon">🏆</div>
            <div class="stat-value">${level}</div>
            <div class="stat-label">Livello</div>
          </div>
          <div class="stat-card glass-panel">
            <div class="stat-icon">🪙</div>
            <div class="stat-value">${gold}</div>
            <div class="stat-label">Gold</div>
          </div>
          <div class="stat-card glass-panel">
            <div class="stat-icon">⚡</div>
            <div class="stat-value">${xp}</div>
            <div class="stat-label">XP</div>
          </div>
          <div class="stat-card glass-panel">
            <div class="stat-icon">📊</div>
            <div class="stat-value">${ownedCards.size}/${totalCards}</div>
            <div class="stat-label">VinylLegends</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress-section glass-panel">
          <div class="progress-header">
            <h3>Progresso VinylLegends</h3>
            <span class="progress-text">${progressPercent}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions glass-panel">
          <h3>Azioni Rapide</h3>
          <div class="actions-grid">
            <a href="#packs" class="action-card">
              <span class="action-icon">🎁</span>
              <span class="action-label">Pacchetti</span>
            </a>
            <a href="#collection" class="action-card">
              <span class="action-icon">🃏</span>
              <span class="action-label">Collezione</span>
            </a>
            <a href="#vinyl-dex" class="action-card">
              <span class="action-icon">📖</span>
              <span class="action-label">VinylLegends</span>
            </a>
          </div>
        </div>

        <!-- Recent Cards (Horizontal Scroll Carousel) -->
        <div class="recent-section glass-panel">
          <h3>Ultime Carte Ottenute</h3>
          ${recentCards.length > 0
            ? `
              <div class="recent-cards-scroll">
                ${recentCards.map(card => this._renderRecentCard(card)).join('')}
              </div>
              <div class="scroll-hint">
                <span>←</span>
                <span>Scorri per vedere tutte</span>
                <span>→</span>
              </div>
              `
            : `
              <div class="empty-state">
                <div class="empty-state-icon">🎤</div>
                <div class="empty-state-title">La tua avventura inizia qui!</div>
                <p>Non hai ancora nessuna carta.<br>Apri il tuo primo pacchetto per iniziare la collezione.</p>
                <button class="btn btn-primary" onclick="window.location.hash='#packs'">
                  🎵 Apri il Primo Pacchetto
                </button>
              </div>
              `
          }
        </div>
      </section>
    `;
  },

  /**
   * Renderizza la notifica del pacchetto gratuito.
   * @param {boolean} isAvailable - Se il pacchetto è disponibile
   * @param {Pack} pack - Istanza del pacchetto base
   * @param {StorageService} storage - Istanza storage
   * @returns {string} HTML
   */
  _renderFreePackNotice(isAvailable, pack, storage) {
    if (isAvailable) {
      return `
        <div class="free-pack-notice available" onclick="window.location.hash='#packs'">
          <span class="pulse-dot"></span>
          <span>Pacchetto Base Disponibile!</span>
          <span style="font-size:0.7rem;opacity:0.7;">Clicca per aprire</span>
        </div>
      `;
    } else {
      const remaining = pack.getFreeCooldownRemaining(storage);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      // Avvia countdown via setTimeout (dopo render)
      setTimeout(() => this._startCooldown(pack, storage), 100);

      return `
        <div class="free-pack-notice">
          <span>🎁</span>
          <span>Prossimo pacchetto gratuito:</span>
          <span class="cooldown-timer" id="free-pack-timer">
            ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}
          </span>
        </div>
      `;
    }
  },

  /**
   * Avvia il countdown del pacchetto gratuito.
   * @param {Pack} pack - Istanza del pacchetto base
   * @param {StorageService} storage - Istanza storage
   */
  _startCooldown(pack, storage) {
    // Pulisci eventuale interval precedente
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
    }

    this._cooldownInterval = setInterval(() => {
      const remaining = pack.getFreeCooldownRemaining(storage);
      const timerEl = document.getElementById('free-pack-timer');
      
      if (!timerEl) {
        clearInterval(this._cooldownInterval);
        return;
      }

      if (remaining <= 0) {
        // Timer scaduto → ricarica la home per mostrare "Disponibile"
        clearInterval(this._cooldownInterval);
        if (window.location.hash === '#home') {
          window.VinylDexHome.render(document.getElementById('app-view'), {});
        }
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  },

  /**
   * Renderizza una singola carta recente in formato mini-card.
   * @param {Object} cardData
   * @returns {string} HTML
   */
  _renderRecentCard(cardData) {
    const card = new window.VinylDexCard(cardData);
    const rarityClass = card.getRarityCSSClass();
    const color = card.getRarityColor();

    return `
      <div class="mini-card ${rarityClass}" title="${card.name} - ${card.getRarityName()}">
        <div class="mini-card-art">
          <img src="${card.img}" alt="${card.name}" 
               loading="lazy"
               onerror="this.style.display='none'">
        </div>
        <div class="mini-card-info">
          <div class="mini-card-name">${card.name}</div>
          <div class="mini-card-class">${card.artistClass}</div>
          <div class="mini-card-stars" style="color: ${color}">
            ${'★'.repeat(card.getStars())}${'☆'.repeat(5 - card.getStars())}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Pulisce timer (chiamato quando si lascia la home page).
   */
  destroy() {
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
      this._cooldownInterval = null;
    }
  }
};

// Export globale
window.VinylDexHome = VinylDexHome;