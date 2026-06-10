/**
 * VinylDex - PvP Battle System (Feature 7)
 * 
 * Modalità locale vs AI.
 * 
 * Flusso:
 * 1. Selezione squadra (3 carte dalla collezione)
 * 2. VS screen con avversario AI
 * 3. 3 round con categorie casuali (Fans, Style, Influence, Energy)
 * 4. Confronto carte per categoria
 * 5. Abilità speciali (bonus 25% 1 round)
 * 6. Risultato finale con ricompense
 */
const VinylDexBattle = {
  /** Stato: 'select' | 'vs' | 'round' | 'result' | 'final' */
  _state: 'select',

  /** Squadra selezionata (max 3 carte) */
  _team: [],

  /** Slot selezionato corrente per la scelta */
  _selectedSlot: 0,

  /** Squadra AI */
  _aiTeam: [],

  /** Punteggi round */
  _roundScores: { player: 0, ai: 0 },

  /** Round corrente (1-3) */
  _currentRound: 1,

  /** Categoria del round corrente */
  _currentCategory: null,

  /** Carta giocata dal player nel round */
  _playerCard: null,

  /** Carta giocata dall'AI nel round */
  _aiCard: null,

  /** Special usato */
  _specialUsed: false,

  /** Timer animazioni */
  _timers: [],

  /** Categorie disponibili */
  CATEGORIES: ['fans', 'style', 'influence', 'energy'],

  /** Nomi categorie */
  CATEGORY_NAMES: {
    fans: '🎤 Fans',
    style: '💃 Style',
    influence: '📢 Influence',
    energy: '⚡ Energy'
  },

  /**
   * Renderizza la schermata di selezione squadra.
   */
  render(container, params) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    this._state = 'select';
    // Resetta solo se non ci sono già carte nel team (per evitare di cancellare le selezioni)
    if (!this._team || this._team.every(t => t === null)) {
      this._team = [null, null, null];
      this._selectedSlot = 0;
    }

    // Prendi carte uniche dalla collezione
    const seen = new Set();
    const uniqueCards = [];
    [...collection].reverse().forEach(c => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        uniqueCards.push(c);
      }
    });

    if (uniqueCards.length < 3) {
      container.innerHTML = `
        <section class="battle-page">
          <h2 class="section-title text-gradient">⚔️ Battaglia PvP</h2>
          <div class="empty-state glass-panel text-center">
            <div class="empty-state-icon">⚔️</div>
            <div class="empty-state-title">Non abbastanza carte!</div>
            <p>Ti servono almeno <strong>3 carte uniche</strong> per formare una squadra.<br>
            Al momento ne hai ${uniqueCards.length}.</p>
            <button class="btn btn-primary" onclick="window.location.hash='#packs'">
              🎁 Apri Pacchetti
            </button>
          </div>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section class="battle-page">
        <h2 class="section-title text-gradient">⚔️ Seleziona la tua Squadra</h2>
        <p class="text-center battle-subtitle">Scegli 3 carte per la battaglia</p>

        <!-- Team Slots -->
        <div class="battle-team-slots">
          ${[0, 1, 2].map(i => `
            <div class="battle-slot ${this._team[i] ? 'battle-slot-filled' : ''} ${this._selectedSlot === i ? 'battle-slot-active' : ''}"
                 onclick="VinylDexBattle.selectSlot(${i})">
              ${this._team[i] 
                ? this._renderTeamCard(this._team[i])
                : `<div class="battle-slot-empty">
                     <span class="battle-slot-number">${i + 1}</span>
                     <span class="battle-slot-label">Seleziona carta</span>
                   </div>`
              }
            </div>
          `).join('')}
        </div>

        <!-- Selected Team Preview -->
        <div class="battle-team-preview glass-panel">
          <h3>La tua squadra</h3>
          <div class="battle-preview-stats">
            ${this._generateTeamPreview()}
          </div>
        </div>

        <!-- Available Cards -->
        <div class="battle-available glass-panel">
          <h3>Carte disponibili</h3>
          <div class="battle-available-grid">
            ${uniqueCards.map(cardData => {
              const card = new window.VinylDexCard(cardData);
              const rarityClass = card.getRarityCSSClass();
              const inTeam = this._team.some(t => t && t.id === card.id);
              return `
                <div class="battle-available-card ${rarityClass} ${inTeam ? 'battle-in-team' : ''}"
                     onclick="${inTeam ? '' : `VinylDexBattle.addToTeam('${card.id}')`}">
                  <span class="card-rarity-badge">${card.getRarityName()}</span>
                  <div class="card-artwork" style="height:60%;">
                    <img src="${card.img}" alt="${card.name}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                  <div class="card-info" style="padding:4px;">
                    <div class="card-name" style="font-size:0.7rem;">${card.name}</div>
                    <div class="card-class" style="font-size:0.6rem;">${card.artistClass}</div>
                    <div class="card-stars" style="font-size:0.6rem;">${card.getStarsHTML()}</div>
                  </div>
                  ${inTeam ? '<div class="battle-check-mark">✓</div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Battle Button -->
        <button class="btn btn-primary btn-large" 
                onclick="VinylDexBattle.startBattle()"
                ${this._team.filter(t => t).length < 3 ? 'disabled' : ''}>
          ⚔️ Inizia Battaglia!
        </button>
      </section>
    `;
  },

  /**
   * Renderizza una carta nel team slot.
   */
  _renderTeamCard(cardData) {
    const card = new window.VinylDexCard(cardData);
    const total = card.getTotalScore();
    return `
      <div class="battle-slot-card ${card.getRarityCSSClass()}" onclick="event.stopPropagation();VinylDexBattle.removeFromTeam(${this._team.indexOf(cardData)})">
        <span class="card-rarity-badge" style="font-size:0.5rem;">${card.getRarityName()}</span>
        <div class="battle-slot-art">
          <img src="${card.img}" alt="${card.name}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div class="battle-slot-info">
          <span class="battle-slot-name">${card.name}</span>
          <span class="battle-slot-total">⚡${total}</span>
        </div>
      </div>
    `;
  },

  /**
   * Genera preview stats della squadra.
   */
  _generateTeamPreview() {
    if (this._team.filter(t => t).length === 0) {
      return '<p style="color:var(--text-muted);font-size:0.85rem;">Seleziona 3 carte per vedere le statistiche della squadra.</p>';
    }

    const totals = { fans: 0, style: 0, influence: 0, energy: 0 };
    this._team.forEach(cardData => {
      if (cardData) {
        totals.fans += cardData.stats.fans || 0;
        totals.style += cardData.stats.style || 0;
        totals.influence += cardData.stats.influence || 0;
        totals.energy += cardData.stats.energy || 0;
      }
    });

    return `
      <div class="battle-preview-bars">
        <div class="battle-preview-row">
          <span class="battle-preview-label">🎤 Fans</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.fans/3}%;background:var(--rarity-legendary);"></div></div>
          <span class="battle-preview-val">${totals.fans}</span>
        </div>
        <div class="battle-preview-row">
          <span class="battle-preview-label">💃 Style</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.style/3}%;background:var(--neon-magenta);"></div></div>
          <span class="battle-preview-val">${totals.style}</span>
        </div>
        <div class="battle-preview-row">
          <span class="battle-preview-label">📢 Influence</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.influence/3}%;background:var(--neon-blue);"></div></div>
          <span class="battle-preview-val">${totals.influence}</span>
        </div>
        <div class="battle-preview-row">
          <span class="battle-preview-label">⚡ Energy</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.energy/3}%;background:var(--neon-cyan);"></div></div>
          <span class="battle-preview-val">${totals.energy}</span>
        </div>
      </div>
    `;
  },

  /**
   * Seleziona uno slot.
   */
  selectSlot(index) {
    this._selectedSlot = index;
    this._reRender();
  },

  /**
   * Aggiunge carta al team.
   */
  addToTeam(cardId) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const cardData = [...collection].reverse().find(c => c.id === cardId);
    if (!cardData) return;

    // Non può aggiungere se già in team
    if (this._team.some(t => t && t.id === cardId)) return;

    // Aggiungi allo slot selezionato
    this._team[this._selectedSlot] = { ...cardData };

    // Avanza slot automaticamente
    const nextEmpty = this._team.findIndex(t => !t);
    if (nextEmpty >= 0) this._selectedSlot = nextEmpty;

    this._reRender();
  },

  /**
   * Rimuove carta dal team.
   */
  removeFromTeam(index) {
    this._team[index] = null;
    this._selectedSlot = index;
    this._reRender();
  },

  /**
   * Avvia la battaglia.
   */
  startBattle() {
    if (this._team.filter(t => t).length < 3) return;

    // Genera squadra AI (3 carte casuali)
    this._aiTeam = this._generateAITeam();

    this._state = 'vs';
    this._currentRound = 1;
    this._roundScores = { player: 0, ai: 0 };
    this._specialUsed = false;

    this._showVSScreen();
  },

  /**
   * Genera una squadra AI con carte casuali.
   */
  _generateAITeam() {
    const allCards = [...window.VinylDexArtists];
    const team = [];
    const used = new Set();

    for (let i = 0; i < 3; i++) {
      let card;
      do {
        card = allCards[Math.floor(Math.random() * allCards.length)];
      } while (used.has(card.id));
      used.add(card.id);
      team.push(new window.VinylDexCard(card));
    }

    return team;
  },

  /**
   * Mostra schermata VS.
   */
  _showVSScreen() {
    const container = document.getElementById('app-view');

    const playerCards = this._team.map(c => new window.VinylDexCard(c));
    const playerTotal = playerCards.reduce((sum, c) => sum + c.getTotalScore(), 0);
    const aiTotal = this._aiTeam.reduce((sum, c) => sum + c.getTotalScore(), 0);

    container.innerHTML = `
      <section class="battle-vs-page">
        <div class="battle-vs-content">
          <div class="battle-vs-player">
            <div class="battle-vs-avatar">🎵</div>
            <h3>Il Tuo Team</h3>
            <div class="battle-vs-cards">
              ${playerCards.map(c => `
                <div class="battle-vs-mini ${c.getRarityCSSClass()}">
                  <div style="width:30px;height:40px;overflow:hidden;border-radius:4px;">
                    <img src="${c.img}" alt="" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                  <span style="font-size:0.55rem;">${c.name}</span>
                </div>
              `).join('')}
            </div>
            <span class="battle-vs-power">⚡ ${playerTotal}</span>
          </div>

          <div class="battle-vs-center">
            <span class="battle-vs-label">VS</span>
            <span class="battle-vs-round">Round 1 di 3</span>
            <button class="btn btn-primary" onclick="VinylDexBattle.startRound()">
              ⚔️ Round 1
            </button>
          </div>

          <div class="battle-vs-player battle-vs-ai">
            <div class="battle-vs-avatar">🤖</div>
            <h3>AI Opponent</h3>
            <div class="battle-vs-cards">
              ${this._aiTeam.map(c => `
                <div class="battle-vs-mini ${c.getRarityCSSClass()}">
                  <div style="width:30px;height:40px;overflow:hidden;border-radius:4px;">
                    <img src="${c.img}" alt="" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                  <span style="font-size:0.55rem;">${c.name}</span>
                </div>
              `).join('')}
            </div>
            <span class="battle-vs-power">⚡ ${aiTotal}</span>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Avvia un round.
   */
  startRound() {
    this._state = 'round';

    // Scegli categoria casuale
    const category = this.CATEGORIES[Math.floor(Math.random() * this.CATEGORIES.length)];
    this._currentCategory = category;
    this._playerCard = null;
    this._aiCard = null;

    const container = document.getElementById('app-view');
    const playerCards = this._team.map(c => new window.VinylDexCard(c));

    container.innerHTML = `
      <section class="battle-round-page">
        <div class="battle-round-header">
          <span class="battle-round-number">Round ${this._currentRound} / 3</span>
          <span class="battle-round-score">${this._roundScores.player} - ${this._roundScores.ai}</span>
        </div>

        <div class="battle-category-display glass-panel">
          <span class="battle-category-label">Categoria</span>
          <span class="battle-category-name">${this.CATEGORY_NAMES[category]}</span>
        </div>

        <div class="battle-card-select">
          <h3>Scegli una carta per questo round:</h3>
          <div class="battle-card-options">
            ${playerCards.map((card, i) => {
              const statValue = card.stats[category] || 0;
              return `
                <div class="battle-select-card ${card.getRarityCSSClass()}"
                     onclick="VinylDexBattle.playCard(${i})">
                  <span class="card-rarity-badge">${card.getRarityName()}</span>
                  <div class="card-artwork" style="height:55%;">
                    <img src="${card.img}" alt="${card.name}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                  <div class="card-info">
                    <div class="card-name">${card.name}</div>
                    <div class="battle-stat-highlight" style="color:var(--neon-gold);">
                      ${this.CATEGORY_NAMES[category]}: <strong>${statValue}</strong>
                    </div>
                    <div class="card-stars">${card.getStarsHTML()}</div>
                  </div>
                  ${!this._specialUsed ? `<button class="battle-special-btn" onclick="event.stopPropagation();VinylDexBattle.useSpecial(${i})">⭐ Abilità</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Gioca una carta.
   */
  playCard(index) {
    const cardData = this._team[index];
    if (!cardData) return;

    this._playerCard = new window.VinylDexCard(cardData);

    // L'AI sceglie una carta (la migliore per la categoria)
    const aiCardData = this._aiTeam[Math.floor(Math.random() * this._aiTeam.length)];
    this._aiCard = aiCardData;

    this._showRoundResult();
  },

  /**
   * Usa abilità speciale (bonus 25% per 1 round).
   */
  useSpecial(index) {
    if (this._specialUsed) return;
    this._specialUsed = true;

    const cardData = this._team[index];
    if (!cardData) return;

    const card = new window.VinylDexCard(cardData);
    const category = this._currentCategory;
    const statValue = card.stats[category] || 0;
    const bonus = Math.round(statValue * 0.25);

    // Applica bonus
    card.stats[category] = statValue + bonus;
    this._playerCard = card;

    // AI sceglie
    const aiCardData = this._aiTeam[Math.floor(Math.random() * this._aiTeam.length)];
    this._aiCard = aiCardData;

    this._showRoundResult(bonus);
  },

  /**
   * Mostra risultato del round.
   */
  _showRoundResult(bonus = 0) {
    const container = document.getElementById('app-view');
    const category = this._currentCategory;
    const playerStat = this._playerCard.stats[category] || 0;
    const aiStat = this._aiCard.stats[category] || 0;

    const playerName = this._playerCard.name;
    const aiName = this._aiCard.name;
    const playerColor = this._playerCard.getRarityColor();
    const aiColor = this._aiCard.getRarityColor();

    const playerWon = playerStat > aiStat;
    const aiWon = aiStat > playerStat;

    container.innerHTML = `
      <section class="battle-round-result">
        <div class="battle-round-header">
          <span class="battle-round-number">Round ${this._currentRound} — ${this.CATEGORY_NAMES[category]}</span>
        </div>

        <div class="battle-comparison">
          <!-- Player Card -->
          <div class="battle-comp-card ${playerWon ? 'battle-winner' : ''}">
            <div class="battle-comp-art">
              <img src="${this._playerCard.img}" alt="" onerror="this.style.display='none'" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">
            </div>
            <span class="battle-comp-name" style="color:${playerColor};">${playerName}</span>
            <div class="battle-comp-stat">
              <span class="battle-comp-value" style="color:${playerColor};">${playerStat}</span>
              ${bonus > 0 ? `<span class="battle-bonus">+${bonus} ⭐</span>` : ''}
              ${playerWon ? '<span class="battle-badge-win">WIN</span>' : ''}
            </div>
          </div>

          <!-- VS middle -->
          <div class="battle-comp-vs">
            <span class="battle-comp-vs-text">VS</span>
            <span class="battle-comp-detail">${this.CATEGORY_NAMES[category]}</span>
          </div>

          <!-- AI Card -->
          <div class="battle-comp-card ${aiWon ? 'battle-winner' : ''}">
            <div class="battle-comp-art">
              <img src="${this._aiCard.img}" alt="" onerror="this.style.display='none'" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">
            </div>
            <span class="battle-comp-name" style="color:${aiColor};">${aiName}</span>
            <div class="battle-comp-stat">
              <span class="battle-comp-value" style="color:${aiColor};">${aiStat}</span>
              ${aiWon ? '<span class="battle-badge-win">WIN</span>' : ''}
            </div>
          </div>
        </div>

        <div class="battle-next-container">
          ${this._currentRound < 3
            ? `<button class="btn btn-primary" onclick="VinylDexBattle.goToNextRound()">
                 ${playerWon ? '✅ Vittoria! Round Successivo' : '❌ Round Successivo'}
               </button>`
            : `<button class="btn btn-gold" onclick="VinylDexBattle.showFinalResult()">
                 🏆 Vedi Risultato Finale
               </button>`
          }
        </div>
      </section>
    `;

    // Aggiorna punteggio
    if (playerWon) this._roundScores.player++;
    else if (aiWon) this._roundScores.ai++;
  },

  /**
   * Va al round successivo.
   */
  goToNextRound() {
    this._currentRound++;
    this._specialUsed = false;
    this.startRound();
  },

  /**
   * Mostra risultato finale.
   */
  showFinalResult() {
    this._state = 'final';
    const playerWon = this._roundScores.player > this._roundScores.ai;
    const draw = this._roundScores.player === this._roundScores.ai;

    // Ricompense
    const goldReward = playerWon ? 50 : (draw ? 20 : 10);
    const xpReward = playerWon ? 100 : (draw ? 40 : 20);

    const storage = new window.VinylDexStorage();
    storage.addGold(goldReward);
    storage.addXP(xpReward);

    // Calcola livello
    let totalXP = storage.getXP();
    let level = 1;
    while (true) {
      const needed = level * 100 + (level - 1) * 50;
      if (totalXP >= needed) { totalXP -= needed; level++; }
      else break;
    }
    storage.setLevel(level);

    const container = document.getElementById('app-view');

    container.innerHTML = `
      <section class="battle-final-page">
        <div class="battle-final-content glass-panel">
          <div class="battle-final-icon">${playerWon ? '🏆' : (draw ? '🤝' : '💔')}</div>
          <h2 class="battle-final-title" style="color:${playerWon ? 'var(--neon-gold)' : (draw ? 'var(--neon-cyan)' : 'var(--text-secondary)')}">
            ${playerWon ? 'VITTORIA!' : (draw ? 'PAREGGIO!' : 'SCONFITTA!')}
          </h2>
          
          <div class="battle-final-score">
            <span class="battle-final-score-you">${this._roundScores.player}</span>
            <span class="battle-final-score-divider">-</span>
            <span class="battle-final-score-ai">${this._roundScores.ai}</span>
          </div>

          <div class="battle-final-rewards">
            <h3>Ricompense</h3>
            <div class="battle-reward-item">
              <span>🪙</span>
              <span>+${goldReward} Gold</span>
            </div>
            <div class="battle-reward-item">
              <span>⚡</span>
              <span>+${xpReward} XP</span>
            </div>
          </div>

          <div class="battle-final-actions">
            <button class="btn btn-primary" onclick="window.VinylDexBattle.render(document.getElementById('app-view'), {})">
              ⚔️ Nuova Battaglia
            </button>
            <button class="btn btn-secondary" onclick="window.location.hash='#home'">
              🏠 Torna alla Home
            </button>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Resetta lo stato.
   */
  _reset() {
    this._team = [null, null, null];
    this._selectedSlot = 0;
    this._aiTeam = [];
    this._roundScores = { player: 0, ai: 0 };
    this._currentRound = 1;
    this._currentCategory = null;
    this._playerCard = null;
    this._aiCard = null;
    this._specialUsed = false;
    this._timers = [];
  },

  /**
   * Ri-renderizza.
   */
  _reRender() {
    const container = document.getElementById('app-view');
    if (container && this._state === 'select') {
      this.render(container, {});
    }
  },

  /**
   * Cleanup.
   */
  destroy() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  }
};

// Export globale
window.VinylDexBattle = VinylDexBattle;