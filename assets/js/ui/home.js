/**
 * VinylDex - Home Page UI (Dashboard a pannelli)
 *
 * Renderizza la home come dashboard con più pannelli (stile sidebar+widget):
 * - Apertura pacchetto (con notifica/cooldown pacchetto gratuito)
 * - Carta in evidenza (rarità più alta posseduta) + sue statistiche
 * - Progresso VinylDex
 * - Preview della collezione (carte più recenti)
 * - Anteprima missioni giornaliere
 *
 * Livello/XP/Gold sono mostrati nella sidebar/topbar globale (assets/js/ui/shell.js),
 * quindi qui non vengono ripetuti.
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

    // Percentuale VinylDex
    const totalCards = window.VinylDexArtists.length;
    const ownedCards = new Set(collection.map(c => c.id));
    const progressPercent = totalCards > 0 ? Math.round((ownedCards.size / totalCards) * 100) : 0;

    // Carte uniche più recenti (per preview collezione)
    const recentUniqueCards = this._getRecentUniqueCards(collection, 8);

    // Carta in evidenza: rarità più alta posseduta (poi più recente)
    const featuredCard = this._getFeaturedCard(collection);

    // Stato pacchetto gratuito
    const basePack = new window.VinylDexPack(window.VinylDexPacks[0]);
    const isFreeAvailable = basePack.isFreeAvailable(storage);

    // Missioni giornaliere (prime 3)
    const dailyMissions = window.VinylDexMissions
      ._generateMissions(storage)
      .filter(m => m.type === 'daily')
      .slice(0, 3);

    container.innerHTML = `
      <section class="home-page">
        <h2 class="section-title text-gradient"><i class="ph-fill ph-house"></i> Home</h2>

        <div class="dashboard-grid">
          ${this._renderPackPanel(isFreeAvailable, basePack, storage)}
          ${this._renderFeaturedCardPanel(featuredCard)}

          <div class="glass-panel panel-full">
            <div class="panel-header-row">
              <h3 class="panel-title"><i class="ph-fill ph-book-open"></i> Progresso VinylDex</h3>
              <span class="progress-text">${progressPercent}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          </div>

          ${this._renderCollectionPreviewPanel(recentUniqueCards, ownedCards.size, totalCards)}
          ${this._renderStatsPanel(featuredCard)}

          ${this._renderMissionsPanel(dailyMissions)}
        </div>
      </section>
    `;
  },

  /**
   * Pannello "Apertura Pacchetto": notifica/cooldown pacchetto gratuito + prezzi.
   */
  _renderPackPanel(isFreeAvailable, basePack, storage) {
    const otherPacks = window.VinylDexPacks.filter(p => !p.isFree);

    return `
      <div class="glass-panel panel-pack">
        <h3 class="panel-title"><i class="ph-fill ph-gift"></i> Apertura Pacchetto</h3>
        ${this._renderFreePackNotice(isFreeAvailable, basePack, storage)}
        <button class="btn btn-primary btn-large" onclick="window.location.hash='#packs'">
          <i class="ph-fill ph-vinyl-record"></i> Apri un Pacchetto
        </button>
        <div class="panel-pack-other-row">
          ${otherPacks.map(p => `
            <div class="pack-detail">
              <span class="pack-detail-label">${p.name}</span>
              <span class="pack-detail-value"><i class="ph-fill ph-coin"></i> ${p.price}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Pannello "Carta in Evidenza": la carta con la rarità più alta posseduta.
   */
  _renderFeaturedCardPanel(featuredCardData) {
    if (!featuredCardData) {
      return `
        <div class="glass-panel panel-featured-card">
          <h3 class="panel-title"><i class="ph-fill ph-star"></i> Carta in Evidenza</h3>
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ph-fill ph-microphone-stage"></i></div>
            <p>Apri il tuo primo pacchetto per scoprire la tua prima carta.</p>
          </div>
        </div>
      `;
    }

    const card = new window.VinylDexCard(featuredCardData);
    const rarityClass = card.getRarityCSSClass();

    return `
      <div class="glass-panel panel-featured-card">
        <h3 class="panel-title"><i class="ph-fill ph-star"></i> Carta in Evidenza</h3>
        <div class="card ${rarityClass}" title="${card.name} - ${card.getRarityName()}"
             onclick="VinylDexCollection.showCardDetail('${card.id}')">
          <span class="card-rarity-badge">${card.getRarityName()}</span>
          <div class="card-artwork">
            <img src="${card.img}" alt="${card.name}" loading="lazy"
                 onerror="this.style.display='none'"
                 style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div class="card-info">
            <div class="card-name">${card.name}</div>
            <div class="card-class">${card.artistClass}</div>
            <div class="card-stars">${card.getStarsHTML()}</div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Pannello "La tua Collezione": preview delle carte più recenti + link alla collezione completa.
   */
  _renderCollectionPreviewPanel(recentUniqueCards, ownedCount, totalCards) {
    return `
      <div class="glass-panel panel-full">
        <div class="panel-header-row">
          <h3 class="panel-title"><i class="ph-fill ph-cards"></i> La Tua Collezione</h3>
          <span class="panel-header-count">${ownedCount} / ${totalCards} carte</span>
        </div>
        ${recentUniqueCards.length > 0
          ? `<div class="collection-grid">${recentUniqueCards.map(c => this._renderPreviewCard(c)).join('')}</div>`
          : `
            <div class="empty-state">
              <div class="empty-state-icon"><i class="ph-fill ph-microphone-stage"></i></div>
              <div class="empty-state-title">La tua avventura inizia qui!</div>
              <p>Non hai ancora nessuna carta.<br>Apri il tuo primo pacchetto per iniziare la collezione.</p>
              <button class="btn btn-primary" onclick="window.location.hash='#packs'">
                <i class="ph-fill ph-vinyl-record"></i> Apri il Primo Pacchetto
              </button>
            </div>
          `
        }
        <div class="text-center" style="margin-top: var(--space-md);">
          <a href="#collection" class="btn btn-secondary btn-small">Vedi tutta la collezione</a>
        </div>
      </div>
    `;
  },

  /**
   * Pannello "Statistiche": barre stat della carta in evidenza.
   */
  _renderStatsPanel(featuredCardData) {
    if (!featuredCardData) {
      return `
        <div class="glass-panel">
          <h3 class="panel-title"><i class="ph-fill ph-chart-bar"></i> Statistiche</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Nessuna carta da mostrare.</p>
        </div>
      `;
    }

    const card = new window.VinylDexCard(featuredCardData);
    const color = card.getRarityColor();
    const maxStat = 100;

    return `
      <div class="glass-panel">
        <div class="card-detail-stats">
          <h3><i class="ph-fill ph-chart-bar"></i> Statistiche — ${card.name}</h3>
          ${window.VinylDexCollection._renderStatBar('<i class="ph-fill ph-microphone-stage"></i> Fans', card.stats.fans, maxStat, color)}
          ${window.VinylDexCollection._renderStatBar('<i class="ph-fill ph-palette"></i> Style', card.stats.style, maxStat, color)}
          ${window.VinylDexCollection._renderStatBar('<i class="ph-fill ph-megaphone"></i> Influence', card.stats.influence, maxStat, color)}
          ${window.VinylDexCollection._renderStatBar('<i class="ph-fill ph-lightning"></i> Energy', card.stats.energy, maxStat, color)}
          <div class="stat-total">
            <span>Punteggio Totale</span>
            <span class="stat-total-value">${card.getTotalScore()}/400</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Pannello "Missioni Giornaliere": prime missioni daily con barra progresso.
   */
  _renderMissionsPanel(dailyMissions) {
    return `
      <div class="glass-panel panel-full">
        <h3 class="panel-title"><i class="ph-fill ph-target"></i> Missioni Giornaliere</h3>
        ${dailyMissions.length > 0
          ? `<div class="missions-list">${dailyMissions.map(m => this._renderMissionPreview(m)).join('')}</div>`
          : `<p style="color: var(--text-secondary); font-size: 0.85rem;">Nessuna missione giornaliera attiva.</p>`
        }
        <div class="text-center" style="margin-top: var(--space-md);">
          <a href="#missions" class="btn btn-secondary btn-small">Vai alle Missioni</a>
        </div>
      </div>
    `;
  },

  /**
   * Renderizza una riga di missione (solo progresso, senza reclamo: si reclama dalla pagina Missioni).
   */
  _renderMissionPreview(mission) {
    const percent = Math.min((mission.progress / mission.target) * 100, 100);
    return `
      <div class="missions-item">
        <span class="missions-item-icon">${mission.icon}</span>
        <div class="missions-item-info">
          <span class="missions-item-title">${mission.title}</span>
          <div class="missions-item-progress">
            <div class="missions-item-bar"><div class="missions-item-fill" style="width:${percent}%"></div></div>
            <span class="missions-item-text">${mission.progress}/${mission.target}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Renderizza una carta della collezione per il pannello preview Home
   * (stesso markup usato in collection.js, per coerenza visiva e per riusare le classi CSS).
   */
  _renderPreviewCard(cardData) {
    const card = new window.VinylDexCard(cardData);
    const rarityClass = card.getRarityCSSClass();
    const qty = cardData.quantity || 1;

    return `
      <div class="card ${rarityClass}" title="${card.name} - ${card.getRarityName()}"
           onclick="VinylDexCollection.showCardDetail('${card.id}')">
        <span class="card-rarity-badge">${card.getRarityName()}</span>
        ${qty > 1 ? `<span class="card-quantity-badge">×${qty}</span>` : ''}
        <div class="card-artwork">
          <img src="${card.img}" alt="${card.name}" loading="lazy"
               onerror="this.style.display='none'"
               style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div class="card-info">
          <div class="card-name">${card.name}</div>
          <div class="card-class">${card.artistClass}</div>
          <div class="card-stars">${card.getStarsHTML()}</div>
        </div>
      </div>
    `;
  },

  /**
   * Deduplica la collezione per id (contando i duplicati) e restituisce
   * le N carte uniche più recenti, ordinate per data di ottenimento.
   * @param {Array} collection
   * @param {number} limit
   * @returns {Array} carte con campo `quantity` aggiunto
   */
  _getRecentUniqueCards(collection, limit) {
    const cardCounts = new Map();
    collection.forEach(c => cardCounts.set(c.id, (cardCounts.get(c.id) || 0) + 1));

    const seen = new Set();
    const uniqueCards = [];
    [...collection]
      .sort((a, b) => (b.obtainedAt || 0) - (a.obtainedAt || 0))
      .forEach(c => {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          uniqueCards.push({ ...c, quantity: cardCounts.get(c.id) || 1 });
        }
      });

    return uniqueCards.slice(0, limit);
  },

  /**
   * Trova la carta da mettere in evidenza: rarità più alta posseduta,
   * a parità di rarità la più recente.
   * @param {Array} collection
   * @returns {Object|null}
   */
  _getFeaturedCard(collection) {
    if (!collection || collection.length === 0) return null;

    let best = null;
    let bestWeight = -1;
    collection.forEach(c => {
      const weight = (window.VinylDexCard.RARITIES[c.rarity] || {}).id || 0;
      if (weight > bestWeight || (weight === bestWeight && (c.obtainedAt || 0) > (best.obtainedAt || 0))) {
        best = c;
        bestWeight = weight;
      }
    });
    return best;
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
          <span><i class="ph-fill ph-gift"></i></span>
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
