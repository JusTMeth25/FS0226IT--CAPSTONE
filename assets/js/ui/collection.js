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
    const color = card.getRarityColor();

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

    // Dettaglio in fullscreen: card "hero" (artwork + nome + classe/gruppo + statistiche) + meta collezione
    overlay.innerHTML = `
      <div class="card-detail-modal glass-panel" style="max-width:420px;">
        <button class="card-detail-close" onclick="document.body.style.overflow='';this.closest('.pack-overlay').remove()"><i class="ph ph-x"></i></button>
        <div class="card-detail-layout" style="flex-direction:column;align-items:center;">
          ${this.renderCardHero(card, { quantity })}
          <div class="card-detail-meta" style="width:100%;margin-top:var(--space-md);">
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
          <div class="progress-bar" style="margin-top:var(--space-md); width:100%;">
            <div class="progress-fill" style="width:${(classProgress/classTotal)*100}%;background:linear-gradient(90deg,${color},${color}88)"></div>
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
   * Renderizza la card "hero" di dettaglio: artwork a tutta larghezza, badge rarità,
   * nome + variante, citazione (descrizione), tag Classe/Gruppo e box statistiche + Totale.
   * Usata sia dal modal di dettaglio della Collezione che da quello della VinylLegends.
   * @param {Card} card - Istanza VinylDexCard
   * @param {Object} [options]
   * @param {number} [options.quantity] - Se > 1, mostra il badge quantità sull'artwork
   * @returns {string} HTML
   */
  renderCardHero(card, options = {}) {
    const quantity = options.quantity || 1;

    // Carte con artwork "già completa" (badge/nome/statistiche disegnati dentro l'immagine
    // stessa, come per Carlos Santana/Michael Jackson): mostriamo solo l'immagine, senza
    // sovrapporre di nuovo testo/box che sarebbero duplicati.
    if (card.fullImage) {
      return `
        <div class="card-hero card-hero-full ${card.getRarityCSSClass()}">
          <img class="card-hero-art" src="${card.img}" alt="${card.name}" onerror="this.style.display='none'">
          ${quantity > 1 ? `<span class="card-hero-qty-badge">×${quantity}</span>` : ''}
        </div>
      `;
    }

    const color = card.getRarityColor();
    const total = card.getTotalScore();

    const stats = [
      { key: 'fans', label: 'Fans', icon: 'ph-users-three', color: 'var(--neon-purple)' },
      { key: 'style', label: 'Style', icon: 'ph-star', color: 'var(--neon-gold)' },
      { key: 'influence', label: 'Influence', icon: 'ph-megaphone', color: 'var(--neon-magenta)' },
      { key: 'energy', label: 'Energy', icon: 'ph-lightning', color: '#FF5252' }
    ];

    return `
      <div class="card-hero ${card.getRarityCSSClass()}">
        <div class="card-hero-art-wrap">
          <img class="card-hero-art" src="${card.img}" alt="${card.name}" onerror="this.style.display='none'">
          <div class="card-hero-scrim"></div>
          <span class="card-hero-rarity-badge" style="color:${color};border-color:${color};">
            ${card.getRarityName().toUpperCase()} <i class="ph-fill ph-${card.getRarityIcon()}"></i>
          </span>
          ${quantity > 1 ? `<span class="card-hero-qty-badge">×${quantity}</span>` : ''}
          <div class="card-hero-heading">
            <h2 class="card-hero-name">${card.name}</h2>
            ${card.variant && card.variant !== card.name ? `<p class="card-hero-variant">${card.variant}</p>` : ''}
          </div>
        </div>
        <div class="card-hero-body">
          ${card.description ? `<p class="card-hero-quote">"${card.description}"</p>` : ''}
          <div class="card-hero-tags">
            <div class="card-hero-tag">
              <i class="ph-fill ph-identification-badge"></i>
              <div><span class="card-hero-tag-label">Classe</span><span class="card-hero-tag-value">${card.artistClass}</span></div>
            </div>
            ${card.group ? `
              <div class="card-hero-tag">
                <i class="ph-fill ph-users-three"></i>
                <div><span class="card-hero-tag-label">Gruppo</span><span class="card-hero-tag-value">${card.group}</span></div>
              </div>
            ` : ''}
          </div>
          <div class="card-hero-stats-grid">
            ${stats.map(s => `
              <div class="card-hero-stat" style="--stat-color:${s.color};">
                <i class="ph-fill ${s.icon}"></i>
                <span class="card-hero-stat-value">${card.stats[s.key] || 0}</span>
                <span class="card-hero-stat-label">${s.label}</span>
              </div>
            `).join('')}
            <div class="card-hero-stat card-hero-stat-total">
              <span class="card-hero-stat-value">${total}</span>
              <span class="card-hero-stat-label">Totale</span>
              <span class="card-hero-stat-sublabel">Somma Statistiche</span>
            </div>
          </div>
        </div>
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