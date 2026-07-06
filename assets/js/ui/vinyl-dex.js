/**
 * VinylDex - VinylDex Catalog UI (Feature 5)
 * 
 * Gestisce:
 * - Griglia completa tutte le 40 carte (scoperte/non scoperte)
 * - Filtri per classe artista e rarità
 * - Dettaglio carta al click (scoperte e non scoperte)
 * - Ricompense progresso (25%, 50%, 75%, 100%)
 * - Effetto festa al 100% con confetti
 */
const VinylDexPage = {
  /** Filtro classe attivo */
  _classFilter: null,

  /** Filtro rarità attivo */
  _rarityFilter: null,

  /** Flag ricompense già reclamate */
  _claimedRewards: [],

  /**
   * Renderizza la pagina VinylDex.
   * @param {HTMLElement} container
   * @param {Object} params
   */
  render(container, params) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const ownedIds = new Set(collection.map(c => c.id));
    const totalCards = window.VinylDexArtists.length;
    const ownedCount = ownedIds.size;
    const progressPercent = Math.round((ownedCount / totalCards) * 100);

    // Ricompense caricate
    this._claimedRewards = storage.get('vinylDexRewards', []);

    container.innerHTML = `
      <section class="vinyl-dex-page">
        <h2 class="section-title text-gradient"><i class="ph-fill ph-book-open"></i> VinylDex</h2>
        <p class="text-center vinyl-dex-subtitle">Catalogo completo degli artisti dell'universo VinylDex</p>

        <!-- Progress Card -->
        <div class="glass-panel vinyl-dex-progress-card">
          <div class="vinyl-dex-progress-top">
            <div class="vinyl-dex-progress-info">
              <span class="vinyl-dex-progress-title">Progresso Catalogo</span>
              <span class="vinyl-dex-progress-count">${ownedCount} / ${totalCards}</span>
            </div>
            <span class="vinyl-dex-progress-percent">${progressPercent}%</span>
          </div>
          <div class="progress-bar vinyl-dex-progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          
          <!-- Rewards -->
          <div class="vinyl-dex-rewards">
            ${this._renderRewards(ownedCount, totalCards)}
          </div>
        </div>

        <!-- Filters -->
        <div class="collection-filters glass-panel">
          <div class="filter-row">
            <div class="filter-group">
              <label class="filter-label">Classe</label>
              <select class="filter-select" onchange="VinylDexPage.setClassFilter(this.value)">
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
              <select class="filter-select" onchange="VinylDexPage.setRarityFilter(this.value)">
                <option value="">Tutte le Rarità</option>
                ${Object.entries(window.VinylDexCard.RARITIES).map(([key, r]) => `
                  <option value="${key}" ${this._rarityFilter === key ? 'selected' : ''}>${r.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Filtro rapido</label>
              <div class="filter-buttons">
                <button class="btn btn-secondary btn-small" onclick="VinylDexPage.setRarityFilter('')">Tutte</button>
                <button class="btn btn-secondary btn-small" onclick="VinylDexPage.showOnlyMissing()">Mancanti</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Cards Grid -->
        <div class="grid vinyl-dex-grid">
          ${this._renderFilteredCards(collection, ownedIds)}
        </div>
      </section>
    `;

    // Se 100%, avvia confetti
    if (progressPercent >= 100) {
      setTimeout(() => this._startConfetti(), 500);
    }
  },

  /**
   * Renderizza le ricompense di progresso.
   */
  _renderRewards(ownedCount, totalCards) {
    const milestones = [
      { percent: 25, count: Math.ceil(totalCards * 0.25), reward: '100 Gold', icon: '<i class="ph-fill ph-coin"></i>', gold: 100 },
      { percent: 50, count: Math.ceil(totalCards * 0.50), reward: 'Pacchetto Deluxe', icon: '<i class="ph-fill ph-diamond"></i>', pack: 'pack-deluxe' },
      { percent: 75, count: Math.ceil(totalCards * 0.75), reward: '200 Gold', icon: '<i class="ph-fill ph-coin"></i>', gold: 200 },
      { percent: 100, count: totalCards, reward: 'Trofeo Collezionista', icon: '<i class="ph-fill ph-trophy"></i>', title: 'Collezionista Assoluto' }
    ];

    return milestones.map(m => {
      const reached = ownedCount >= m.count;
      const claimed = this._claimedRewards.includes(m.percent);

      return `
        <div class="vinyl-dex-reward ${reached ? 'reward-reached' : ''} ${claimed ? 'reward-claimed' : ''}"
             onclick="${reached && !claimed ? `VinylDexPage.claimReward(${m.percent}, this)` : ''}">
          <span class="reward-icon">${claimed ? '<i class="ph-fill ph-check-circle"></i>' : reached ? m.icon : '<i class="ph-fill ph-lock"></i>'}</span>
          <div class="reward-info">
            <span class="reward-label">${m.percent}% — ${m.reward}</span>
            <span class="reward-status">
              ${claimed ? 'Reclamato!' : reached ? 'Clicca per reclamare!' : `${m.count} carte necessarie`}
            </span>
          </div>
          ${!reached ? `<div class="reward-progress-mini"><div class="reward-progress-fill" style="width:${Math.min((ownedCount/m.count)*100,100)}%"></div></div>` : ''}
        </div>
      `;
    }).join('');
  },

  /**
   * Reclama una ricompensa.
   */
  claimReward(percent, element) {
    const storage = new window.VinylDexStorage();
    
    const milestones = [
      { percent: 25, gold: 100 },
      { percent: 50, pack: 'pack-deluxe' },
      { percent: 75, gold: 200 },
      { percent: 100, title: 'Collezionista Assoluto' }
    ];

    const milestone = milestones.find(m => m.percent === percent);
    if (!milestone) return;

    // Applica ricompensa
    if (milestone.gold) {
      storage.addGold(milestone.gold);
    }
    if (milestone.pack) {
      storage.addFreePack(milestone.pack);
    }
    if (milestone.title) {
      storage.update({ title: milestone.title });
    }

    // Segna come reclamato
    this._claimedRewards.push(percent);
    storage.set('vinylDexRewards', this._claimedRewards);

    // Feedback visivo
    if (element) {
      element.classList.add('reward-claimed');
      const status = element.querySelector('.reward-status');
      if (status) status.innerHTML = '<i class="ph-fill ph-check-circle"></i> Reclamato!';
    }

    // Se 100%, bonus confetti + fanfara da trofeo finale, altrimenti chime ricompensa standard
    if (percent === 100) {
      window.VinylDexSound.levelUp();
      this._startConfetti();
    } else {
      window.VinylDexSound.reward();
    }
  },

  /**
   * Renderizza le carte filtrate.
   */
  _renderFilteredCards(collection, ownedIds) {
    let cards = [...window.VinylDexArtists];

    // Filtri
    if (this._classFilter) {
      cards = cards.filter(c => c.artistClass === this._classFilter);
    }
    if (this._rarityFilter) {
      cards = cards.filter(c => c.rarity === this._rarityFilter);
    }

    return cards.map(artistData => {
      const isOwned = ownedIds.has(artistData.id);
      const card = new window.VinylDexCard(artistData);

      if (isOwned) {
        const cardObj = card;

        if (cardObj.fullImage) {
          return `
            <div class="card ${cardObj.getRarityCSSClass()} card-full-image"
                 onclick="VinylDexPage.showCardDetail('${cardObj.id}')">
              <img src="${cardObj.img}" alt="${cardObj.name}" 
                   onerror="this.style.display='none'" 
                   style="width:100%;height:100%;object-fit:cover;border-radius:12px;">
              <span class="card-rarity-badge" style="position:absolute;top:8px;left:8px;z-index:2;">${cardObj.getRarityName()}</span>
            </div>
          `;
        }

        // Carta scoperta (layout normale)
        return `
          <div class="card ${cardObj.getRarityCSSClass()}"
               onclick="VinylDexPage.showCardDetail('${cardObj.id}')">
            <span class="card-rarity-badge">${cardObj.getRarityName()}</span>
            <div class="card-artwork">
              <img src="${cardObj.img}" alt="${cardObj.name}" 
                   onerror="this.style.display='none'" 
                   style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="card-info">
              <div class="card-name">${cardObj.name}</div>
              <div class="card-class">${cardObj.artistClass}</div>
              <div class="card-stars">${cardObj.getStarsHTML()}</div>
            </div>
          </div>
        `;
      } else {
        // Carta non scoperta — mostra indizi
        const rarityHint = card.getRarityName();
        const rarityColor = card.getRarityColor();
        const classHint = card.artistClass;

        return `
          <div class="card card-unknown" 
               onclick="VinylDexPage.showUnknownDetail('${card.id}')"
               style="opacity:0.6; filter: grayscale(0.7);">
            <span class="card-rarity-badge" style="background:${rarityColor}44;color:${rarityColor};">
              ${rarityHint}
            </span>
            <div class="card-artwork">
              <div style="font-size:2.5rem;opacity:0.3;filter:blur(1px);"><i class="ph ph-question"></i></div>
            </div>
            <div class="card-info">
              <div class="card-name" style="color:${rarityColor};">???</div>
              <div class="card-class" style="color:#666;">${classHint}</div>
              <div class="card-stars" style="color:#333;">
                ${'<i class="ph-fill ph-star"></i>'.repeat(card.getStars())}${'<i class="ph ph-star"></i>'.repeat(5 - card.getStars())}
              </div>
            </div>
          </div>
        `;
      }
    }).join('');
  },

  /**
   * Mostra dettaglio carta scoperta (riusa logica collezione).
   */
  showCardDetail(cardId) {
    // Usa la stessa funzione della collezione
    if (window.VinylDexCollection && typeof window.VinylDexCollection.showCardDetail === 'function') {
      window.VinylDexCollection.showCardDetail(cardId);
    }
  },

  /**
   * Mostra dettaglio carta non scoperta con suggerimenti.
   */
  showUnknownDetail(cardId) {
    const artistData = window.VinylDexArtists.find(a => a.id === cardId);
    if (!artistData) return;

    const card = new window.VinylDexCard(artistData);
    const color = card.getRarityColor();

    // Suggerisci quale pacchetto ha più probabilità
    let bestPack = 'Pacchetto Base (gratuito)';
    let bestRate = (window.VinylDexPacks[0].dropRates[card.rarity] * 100).toFixed(0);
    
    window.VinylDexPacks.forEach(p => {
      const rate = p.dropRates[card.rarity] * 100;
      if (rate > parseFloat(bestRate)) {
        bestRate = rate.toFixed(0);
        bestPack = p.name;
      }
    });

    // Garanzia
    let guaranteeText = '';
    if (card.rarity === 'legendary') guaranteeText = 'Garantita nei Pacchetti Premium!';
    else if (card.rarity === 'epic') guaranteeText = 'Garantita nei Pacchetti Deluxe!';
    else if (card.rarity === 'rare') guaranteeText = 'Garantita in tutti i pacchetti!';

    const overlay = document.createElement('div');
    overlay.className = 'pack-overlay';
    overlay.innerHTML = `
      <div class="card-detail-modal glass-panel" style="max-width:500px;">
        <button class="card-detail-close" onclick="this.closest('.pack-overlay').remove()"><i class="ph ph-x"></i></button>

        <div class="card-detail-layout" style="flex-direction:column;align-items:center;">
          <!-- Unknown placeholder -->
          <div style="font-size:4rem;opacity:0.3;margin:var(--space-lg) 0;"><i class="ph ph-question"></i></div>

          <div class="card-detail-info" style="text-align:center;">
            <h2 class="card-detail-title" style="color:${color};">???</h2>
            <span class="card-detail-class">${card.artistClass} — ${card.getRarityName()}</span>
            
            <div class="glass-panel" style="margin-top:var(--space-md);background:rgba(0,0,0,0.3);">
              <p style="font-style:italic;color:var(--text-secondary);margin-bottom:var(--space-md);">
                Questa carta non è ancora stata scoperta!
              </p>

              <div style="display:flex;flex-direction:column;gap:var(--space-sm);text-align:left;">
                <div class="card-detail-meta-item">
                  <span class="meta-label">Classe</span>
                  <span class="meta-value">${card.artistClass}</span>
                </div>
                <div class="card-detail-meta-item">
                  <span class="meta-label">Rarità</span>
                  <span class="meta-value" style="color:${color};">${card.getRarityName()}</span>
                </div>
                <div class="card-detail-meta-item">
                  <span class="meta-label">Stelle rarità</span>
                  <span class="meta-value">${card.getStarsHTML()}</span>
                </div>
                ${guaranteeText ? `
                <div class="card-detail-meta-item">
                  <span class="meta-label">Garanzia</span>
                  <span class="meta-value" style="color:var(--neon-gold);">${guaranteeText}</span>
                </div>
                ` : ''}
              </div>
            </div>

            <div class="glass-panel" style="margin-top:var(--space-md);background:rgba(0,0,0,0.3);">
              <p style="margin-bottom:var(--space-sm);">
                <i class="ph-fill ph-lightbulb"></i> <strong>Suggerimento:</strong> Prova ad aprire
              </p>
              <p style="color:var(--neon-cyan);font-weight:700;">${bestPack}</p>
              <p style="font-size:0.8rem;color:var(--text-muted);">
                Drop rate: <span style="color:${color};">${bestRate}%</span>
              </p>
              <button class="btn btn-primary" style="margin-top:var(--space-md);"
                      onclick="this.closest('.pack-overlay').remove();window.location.hash='#packs'">
                <i class="ph-fill ph-gift"></i> Apri Pacchetti
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app-view').appendChild(overlay);

    const closeHandler = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', closeHandler); }
    };
    document.addEventListener('keydown', closeHandler);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  },

  /**
   * Mostra solo carte mancanti.
   */
  showOnlyMissing() {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const ownedIds = new Set(collection.map(c => c.id));

    // Trova la prima classe con carte mancanti e imposta filtro
    // Oppure applica un filtro speciale "mancanti"
    // Per semplicità: resetta rarità e mostra messaggio
    this._rarityFilter = null;
    this._classFilter = null;
    this._reRender();

    // Scroll alle carte non scoperte
    setTimeout(() => {
      const unknowns = document.querySelectorAll('.card-unknown');
      if (unknowns.length > 0) {
        unknowns[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  },

  /**
   * Imposta filtro classe.
   */
  setClassFilter(cls) {
    this._classFilter = cls || null;
    this._reRender();
  },

  /**
   * Imposta filtro rarità.
   */
  setRarityFilter(rarity) {
    this._rarityFilter = rarity || null;
    this._reRender();
  },

  /**
   * Ri-renderizza.
   */
  _reRender() {
    const container = document.getElementById('app-view');
    if (container) this.render(container, {});
  },

  /**
   * Avvia effetto confetti per completamento 100%.
   */
  _startConfetti() {
    const container = document.getElementById('app-view');
    if (!container) return;

    const colors = ['#FFD700', '#8B5CF6', '#EC4899', '#22D3EE', '#FF6B6B', '#4CAF50', '#FF9800'];
    
    for (let i = 0; i < 60; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'vinyl-dex-confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.width = `${6 + Math.random() * 8}px`;
      confetti.style.height = `${6 + Math.random() * 8}px`;
      confetti.style.animationDuration = `${2 + Math.random() * 3}s`;
      confetti.style.animationDelay = `${Math.random() * 2}s`;
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      container.appendChild(confetti);

      // Rimuovi dopo animazione
      setTimeout(() => confetti.remove(), 5000);
    }
  },

  /**
   * Cleanup.
   */
  destroy() {
    // Rimuovi eventuali confetti rimasti
    document.querySelectorAll('.vinyl-dex-confetti').forEach(el => el.remove());
  }
};

// Export globale
window.VinylDexPage = VinylDexPage;