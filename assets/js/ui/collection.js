/**
 * VinylDex - Collection UI (Feature 4)
 * 
 * Gestisce:
 * - Griglia carte possedute con conteggio duplicati
 * - Filtri per classe artista e rarità
 * - Ordinamento (nome, rarità, data, stats)
 * - Dettaglio carta al click con stats barre
 * - Conteggi per rarità
 */
const VinylDexCollection = {
  /** Filtro classe attivo (null = tutti) */
  _classFilter: null,
  
  /** Filtro rarità attivo (null = tutte) */
  _rarityFilter: null,

  /** Ordinamento attivo */
  _sortBy: 'date',

  /** Direzione ordinamento */
  _sortDir: 'desc',

  /**
   * Renderizza la pagina collezione.
   * @param {HTMLElement} container
   * @param {Object} params
   */
  render(container, params) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const totalCards = window.VinylDexArtists.length;

    // Raggruppa carte per ID e conta duplicati
    const cardCounts = new Map();
    collection.forEach(c => {
      const id = c.id;
      cardCounts.set(id, (cardCounts.get(id) || 0) + 1);
    });

    // Carte uniche nella collezione
    const uniqueCardIds = new Set(collection.map(c => c.id));

    container.innerHTML = `
      <section class="collection-page">
        <h2 class="section-title text-gradient"><i class="ph-fill ph-cards"></i> La Mia Collezione</h2>
        
        <!-- Stats Bar -->
        <div class="collection-stats glass-panel">
          <div class="collection-stat">
            <span class="collection-stat-value">${uniqueCardIds.size}</span>
            <span class="collection-stat-label">Carte Uniche</span>
          </div>
          <div class="collection-stat">
            <span class="collection-stat-value">${collection.length}</span>
            <span class="collection-stat-label">Totale</span>
          </div>
          <div class="collection-stat">
            <span class="collection-stat-value">${Math.round((uniqueCardIds.size / totalCards) * 100)}%</span>
            <span class="collection-stat-label">VinylLegends</span>
          </div>
        </div>

        <!-- Rarity Counts -->
        <div class="rarity-counts glass-panel">
          ${this._renderRarityCounts(collection, storage)}
        </div>

        <!-- Filters -->
        <div class="collection-filters glass-panel">
          <div class="filter-row">
            <div class="filter-group">
              <label class="filter-label">Classe</label>
              <select class="filter-select" id="filter-class" onchange="VinylDexCollection.setClassFilter(this.value)">
                <option value="">Tutte le Classi</option>
                ${window.VinylDexArtists.reduce((acc, c) => {
                  if (!acc.includes(c.artistClass)) acc.push(c.artistClass);
                  return acc;
                }, []).map(cls => `
                  <option value="${cls}" ${this._classFilter === cls ? 'selected' : ''}>${cls}</option>
                `).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Rarità</label>
              <select class="filter-select" id="filter-rarity" onchange="VinylDexCollection.setRarityFilter(this.value)">
                <option value="">Tutte le Rarità</option>
                ${Object.entries(window.VinylDexCard.RARITIES).map(([key, r]) => `
                  <option value="${key}" ${this._rarityFilter === key ? 'selected' : ''}>${r.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Ordina per</label>
              <select class="filter-select" id="filter-sort" onchange="VinylDexCollection.setSortBy(this.value)">
                <option value="date" ${this._sortBy === 'date' ? 'selected' : ''}>Data ottenimento</option>
                <option value="name" ${this._sortBy === 'name' ? 'selected' : ''}>Nome</option>
                <option value="rarity" ${this._sortBy === 'rarity' ? 'selected' : ''}>Rarità</option>
                <option value="stats" ${this._sortBy === 'stats' ? 'selected' : ''}>Stats totali</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Ordine</label>
              <button class="btn btn-secondary btn-small" onclick="VinylDexCollection.toggleSortDir()">
                ${this._sortDir === 'desc' ? '<i class="ph-fill ph-sort-descending"></i> Decrescente' : '<i class="ph-fill ph-sort-ascending"></i> Crescente'}
              </button>
            </div>
          </div>
        </div>

        <!-- Cards Grid -->
        ${uniqueCardIds.size > 0
          ? `<div class="collection-grid" id="collection-grid">
              ${this._renderFilteredCards(collection, cardCounts, uniqueCardIds)}
             </div>`
          : `<div class="empty-state glass-panel text-center" style="margin-top: 2rem;">
              <div class="empty-state-icon"><i class="ph-fill ph-microphone-stage"></i></div>
              <div class="empty-state-title">Collezione vuota</div>
              <p>Non hai ancora nessuna carta.</p>
              <button class="btn btn-primary" onclick="window.location.hash='#packs'">
                <i class="ph-fill ph-vinyl-record"></i> Apri il Primo Pacchetto
              </button>
             </div>`
        }
      </section>
    `;
  },

  /**
   * Renderizza i conteggi per rarità.
   */
  _renderRarityCounts(collection, storage) {
    const stats = storage.getStats();
    const rarities = [
      { key: 'legendary', name: 'Leggendarie', count: stats.legendaryCount || 0, color: 'var(--rarity-legendary)' },
      { key: 'epic', name: 'Epiche', count: stats.epicCount || 0, color: 'var(--rarity-epic)' },
      { key: 'rare', name: 'Rare', count: stats.rareCount || 0, color: 'var(--rarity-rare)' },
      { key: 'uncommon', name: 'Non Comuni', count: stats.uncommonCount || 0, color: 'var(--rarity-uncommon)' },
      { key: 'common', name: 'Comuni', count: stats.commonCount || 0, color: 'var(--rarity-common)' }
    ];

    return `
      <div class="rarity-counts-row">
        ${rarities.map(r => `
          <div class="rarity-count-item" style="--rarity-color: ${r.color}" onclick="VinylDexCollection.setRarityFilter('${r.key}')">
            <span class="rarity-count-value" style="color: ${r.color}">${r.count}</span>
            <span class="rarity-count-label">${r.name}</span>
          </div>
        `).join('')}
        <div class="rarity-count-item" onclick="VinylDexCollection.setRarityFilter('')">
          <span class="rarity-count-value">${collection.length}</span>
          <span class="rarity-count-label">Totale</span>
        </div>
      </div>
    `;
  },

  /**
   * Applica filtri e ordinamento, renderizza le carte.
   */
  _renderFilteredCards(collection, cardCounts, uniqueCardIds) {
    // Prendi una carta per ID unico (la più recente)
    const uniqueCards = [];
    const seen = new Set();
    
    // Ordina per data ottenimento (decrescente) per prendere la più recente per ogni ID
    const sorted = [...collection].sort((a, b) => (b.obtainedAt || 0) - (a.obtainedAt || 0));
    
    sorted.forEach(c => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        uniqueCards.push({
          ...c,
          quantity: cardCounts.get(c.id) || 1
        });
      }
    });

    // Applica filtri
    let filtered = uniqueCards;

    if (this._classFilter) {
      filtered = filtered.filter(c => c.artistClass === this._classFilter);
    }

    if (this._rarityFilter) {
      filtered = filtered.filter(c => c.rarity === this._rarityFilter);
    }

    // Applica ordinamento
    const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

    filtered.sort((a, b) => {
      const cardA = new window.VinylDexCard(a);
      const cardB = new window.VinylDexCard(b);
      let comparison = 0;

      switch (this._sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rarity':
          comparison = (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
          break;
        case 'stats':
          comparison = cardB.getTotalScore() - cardA.getTotalScore();
          break;
        case 'date':
        default:
          comparison = (b.obtainedAt || 0) - (a.obtainedAt || 0);
          break;
      }

      return this._sortDir === 'desc' ? comparison : -comparison;
    });

    if (filtered.length === 0) {
      return `
        <div class="empty-state glass-panel text-center" style="margin-top: 2rem; grid-column: 1/-1;">
          <div class="empty-state-icon"><i class="ph-fill ph-magnifying-glass"></i></div>
          <div class="empty-state-title">Nessun risultato</div>
          <p>Nessuna carta corrisponde ai filtri selezionati.</p>
          <button class="btn btn-secondary" onclick="VinylDexCollection.resetFilters()">
            <i class="ph-fill ph-arrows-clockwise"></i> Resetta Filtri
          </button>
        </div>
      `;
    }

    return filtered.map(cardData => {
      const card = new window.VinylDexCard(cardData);
      const rarityClass = card.getRarityCSSClass();
      const color = card.getRarityColor();
      const qty = cardData.quantity || 1;

      if (card.fullImage) {
        return `
          <div class="card ${rarityClass} collection-card card-full-image" 
               title="${card.name} - ${card.getRarityName()}"
               onclick="VinylDexCollection.showCardDetail('${card.id}')">
            <img src="${card.img}" alt="${card.name}" 
                 onerror="this.style.display='none'" 
                 style="width:100%;height:100%;object-fit:cover;border-radius:12px;">
            <span class="card-rarity-badge" style="position:absolute;top:8px;left:8px;z-index:2;">${card.getRarityName()}</span>
            ${qty > 1 ? `<span class="card-quantity-badge" style="position:absolute;bottom:8px;right:8px;z-index:2;">×${qty}</span>` : ''}
          </div>
        `;
      }

      return `
        <div class="card ${rarityClass} collection-card" 
             title="${card.name} - ${card.getRarityName()}"
             onclick="VinylDexCollection.showCardDetail('${card.id}')">
          <span class="card-rarity-badge">${card.getRarityName()}</span>
          ${qty > 1 ? `<span class="card-quantity-badge">×${qty}</span>` : ''}
          <div class="card-artwork">
            <img src="${card.img}" alt="${card.name}" 
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
    }).join('');
  },

  /**
   * Mostra dettaglio carta in modal fullscreen.
   * @param {string} cardId
   */
  showCardDetail(cardId) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    
    // Trova la carta (la più recente con questo ID)
    const cardData = [...collection].reverse().find(c => c.id === cardId);
    if (!cardData) return;

    // Conta quante volte la possiede
    const quantity = collection.filter(c => c.id === cardId).length;

    const card = new window.VinylDexCard(cardData);
    const rarityClass = card.getRarityCSSClass();
    const color = card.getRarityColor();

    // Stats per barre (max possibile è 100)
    const maxStat = 100;

    // Formatta data
    const dateStr = cardData.obtainedAt 
      ? new Date(cardData.obtainedAt).toLocaleDateString('it-IT', { 
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : 'Sconosciuta';

    // Prendi tutte le varianti della stessa classe per completamento
    const classCards = window.VinylDexArtists.filter(a => a.artistClass === card.artistClass);
    const ownedClassIds = new Set(collection.map(c => c.id));
    const classProgress = classCards.filter(c => ownedClassIds.has(c.id)).length;
    const classTotal = classCards.length;

    // Blocca scroll in background
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.className = 'pack-overlay';

    /**
     * Ripristina lo scroll del body e rimuove l'overlay.
     */
    const closeOverlay = () => {
      document.body.style.overflow = '';
      overlay.remove();
      document.removeEventListener('keydown', closeHandler);
    };

    // Dettaglio in fullscreen full-image: mostra l'immagine grande + stats sotto per TUTTE le carte
    overlay.innerHTML = `
      <div class="card-detail-modal glass-panel" style="max-width:500px;text-align:center;">
        <button class="card-detail-close" onclick="document.body.style.overflow='';this.closest('.pack-overlay').remove()"><i class="ph ph-x"></i></button>
        <div class="card-detail-layout" style="flex-direction:column;align-items:center;">
          <div class="card-detail-card" style="width:100%;max-width:400px;position:relative;">
            <img src="${card.img}" alt="${card.name}" 
                 onerror="this.style.display='none'" 
                 style="width:100%;height:auto;border-radius:12px;box-shadow:0 0 40px rgba(255,215,0,0.5);">
            <span class="card-rarity-badge" style="position:absolute;top:16px;left:16px;background:${color};color:#fff;padding:4px 12px;border-radius:6px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;z-index:2;">${card.getRarityName()}</span>
            ${quantity > 1 ? `<span class="card-quantity-badge" style="position:absolute;bottom:16px;right:16px;z-index:2;background:rgba(0,0,0,0.7);padding:4px 10px;border-radius:6px;font-size:0.85rem;font-weight:700;">×${quantity}</span>` : ''}
          </div>
          <div class="card-detail-info" style="text-align:center;margin-top:var(--space-lg);">
            <h2 class="card-detail-title" style="color:${color};">${card.name}</h2>
            <span class="card-detail-class">${card.artistClass} — ${card.getRarityName()}</span>
            <p class="card-detail-desc">${card.description}</p>
            <div class="card-detail-stats">
              <h3>Statistiche</h3>
              ${this._renderStatBar('<i class="ph-fill ph-microphone-stage"></i> Fans', card.stats.fans, maxStat, color)}
              ${this._renderStatBar('<i class="ph-fill ph-palette"></i> Style', card.stats.style, maxStat, color)}
              ${this._renderStatBar('<i class="ph-fill ph-megaphone"></i> Influence', card.stats.influence, maxStat, color)}
              ${this._renderStatBar('<i class="ph-fill ph-lightning"></i> Energy', card.stats.energy, maxStat, color)}
              <div class="stat-total">
                <span>Punteggio Totale</span>
                <span class="stat-total-value">${card.getTotalScore()}/400</span>
              </div>
            </div>
            <div class="card-detail-meta">
              <div class="card-detail-meta-item">
                <span class="meta-label">Ottenuta il</span>
                <span class="meta-value">${dateStr}</span>
              </div>
              <div class="card-detail-meta-item">
                <span class="meta-label">Quantità</span>
                <span class="meta-value">×${quantity}</span>
              </div>
              <div class="card-detail-meta-item">
                <span class="meta-label">Classe completata</span>
                <span class="meta-value">${classProgress}/${classTotal}</span>
              </div>
            </div>
            <div class="progress-bar" style="margin-top:var(--space-md)">
              <div class="progress-fill" style="width:${(classProgress/classTotal)*100}%;background:linear-gradient(90deg,${color},${color}88)"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app-view').appendChild(overlay);

    // Chiudi con Escape
    const closeHandler = (e) => {
      if (e.key === 'Escape') {
        closeOverlay();
      }
    };
    document.addEventListener('keydown', closeHandler);

    // Chiudi cliccando fuori dal modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });
  },

  /**
   * Renderizza una barra stat.
   */
  _renderStatBar(label, value, max, color) {
    const percent = Math.min((value / max) * 100, 100);
    return `
      <div class="stat-bar-row">
        <span class="stat-bar-label">${label}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:${percent}%;background:${color};"></div>
        </div>
        <span class="stat-bar-value" style="color:${color};">${value}</span>
      </div>
    `;
  },

  /**
   * Imposta filtro classe e ri-renderizza.
   */
  setClassFilter(cls) {
    this._classFilter = cls || null;
    this._reRender();
  },

  /**
   * Imposta filtro rarità e ri-renderizza.
   */
  setRarityFilter(rarity) {
    this._rarityFilter = rarity || null;
    this._reRender();
  },

  /**
   * Imposta ordinamento e ri-renderizza.
   */
  setSortBy(sort) {
    this._sortBy = sort;
    this._reRender();
  },

  /**
   * Inverte direzione ordinamento.
   */
  toggleSortDir() {
    this._sortDir = this._sortDir === 'desc' ? 'asc' : 'desc';
    this._reRender();
  },

  /**
   * Resetta tutti i filtri.
   */
  resetFilters() {
    this._classFilter = null;
    this._rarityFilter = null;
    this._sortBy = 'date';
    this._sortDir = 'desc';
    this._reRender();
  },

  /**
   * Ri-renderizza la collezione mantenendo i filtri.
   */
  _reRender() {
    const container = document.getElementById('app-view');
    if (container) {
      this.render(container, {});
    }
  },

  /**
   * Cleanup.
   */
  destroy() {
    // Nessun timer da pulire per la collezione
  }
};

// Export globale
window.VinylDexCollection = VinylDexCollection;