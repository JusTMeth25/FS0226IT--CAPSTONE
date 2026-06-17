/**
 * VinylDex - PvP Battle System (Feature 7)
 *
 * Modalità locale vs AI.
 *
 * Flusso (battaglia singola):
 * 1. Selezione squadra (3 carte dalla collezione)
 * 2. VS screen — la squadra IA resta nascosta ("???") fino a quando ogni carta non viene giocata
 * 3. 3 round: a turni alterni scegli tu la categoria (round 1 e 3) o la scegli l'IA (round 2)
 * 4. Ogni carta (tua e dell'IA) si può giocare una sola volta nei 3 round
 * 5. Abilità speciale (bonus 25% su 1 round)
 * 6. Risultato finale con ricompense + riepilogo round-per-round
 *
 * Modalità Torneo: 3 avversari consecutivi a difficoltà crescente (Facile/Normale/Difficile),
 * stessa squadra per tutto il torneo. Le ricompense si accumulano e vengono assegnate in un'unica
 * soluzione all'eliminazione o al completamento (con bonus finale se si vincono tutti e 3).
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

  /** Indici delle carte del player già giocate (non più selezionabili) */
  _usedPlayerIndices: [],

  /** Indici delle carte dell'IA già giocate (non più selezionabili) */
  _usedAiIndices: [],

  /** Cronologia dei round della battaglia/manche corrente, per il riepilogo finale */
  _roundHistory: [],

  /** Difficoltà della manche corrente */
  _difficulty: 'normal',

  /** Se true, siamo in modalità Torneo */
  _tournamentMode: false,

  /** Indice (0-2) dell'avversario corrente nel torneo */
  _tournamentStage: 0,

  /** Gold/XP accumulati nel torneo, assegnati a fine torneo */
  _tournamentGold: 0,
  _tournamentXP: 0,

  /** Timer animazioni */
  _timers: [],

  /** Categorie disponibili */
  CATEGORIES: ['fans', 'style', 'influence', 'energy'],

  /** Nomi categorie */
  CATEGORY_NAMES: {
    fans: '<i class="ph-fill ph-microphone-stage"></i> Fans',
    style: '<i class="ph-fill ph-palette"></i> Style',
    influence: '<i class="ph-fill ph-megaphone"></i> Influence',
    energy: '<i class="ph-fill ph-lightning"></i> Energy'
  },

  /** Configurazione difficoltà IA: smart = sceglie la carta migliore per la categoria, boost = moltiplicatore stats */
  DIFFICULTY_CONFIG: {
    easy: { label: 'Facile', smart: false, boost: 1, gold: 30, xp: 60 },
    normal: { label: 'Normale', smart: true, boost: 1, gold: 60, xp: 120 },
    hard: { label: 'Difficile', smart: true, boost: 1.15, gold: 100, xp: 200 }
  },

  /** Ordine avversari nel torneo */
  TOURNAMENT_ORDER: ['easy', 'normal', 'hard'],

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
          <h2 class="section-title text-gradient"><i class="ph-fill ph-sword"></i> Battaglia PvP</h2>
          <div class="empty-state glass-panel text-center">
            <div class="empty-state-icon"><i class="ph-fill ph-sword"></i></div>
            <div class="empty-state-title">Non abbastanza carte!</div>
            <p>Ti servono almeno <strong>3 carte uniche</strong> per formare una squadra.<br>
            Al momento ne hai ${uniqueCards.length}.</p>
            <button class="btn btn-primary" onclick="window.location.hash='#packs'">
              <i class="ph-fill ph-gift"></i> Apri Pacchetti
            </button>
          </div>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section class="battle-page">
        <h2 class="section-title text-gradient"><i class="ph-fill ph-sword"></i> Seleziona la tua Squadra</h2>
        <p class="text-center battle-subtitle">Scegli 3 carte per la battaglia</p>

        ${this._renderBattleStats(storage)}

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
                  ${inTeam ? '<div class="battle-check-mark"><i class="ph-fill ph-check"></i></div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Battle Mode Actions -->
        <div class="battle-mode-actions">
          <button class="btn btn-primary btn-large"
                  onclick="VinylDexBattle.startBattle()"
                  ${this._team.filter(t => t).length < 3 ? 'disabled' : ''}>
            <i class="ph-fill ph-sword"></i> Inizia Battaglia
          </button>
          <button class="btn btn-gold btn-large"
                  onclick="VinylDexBattle.startTournament()"
                  ${this._team.filter(t => t).length < 3 ? 'disabled' : ''}>
            <i class="ph-fill ph-trophy"></i> Modalità Torneo
          </button>
        </div>
      </section>
    `;
  },

  /**
   * Pannello statistiche battaglie (vittorie/sconfitte/pareggi/serie attuale).
   */
  _renderBattleStats(storage) {
    const stats = storage.getStats();
    return `
      <div class="collection-stats glass-panel">
        <div class="collection-stat"><span class="collection-stat-value">${stats.totalBattlesWon || 0}</span><span class="collection-stat-label">Vittorie</span></div>
        <div class="collection-stat"><span class="collection-stat-value">${stats.totalBattlesLost || 0}</span><span class="collection-stat-label">Sconfitte</span></div>
        <div class="collection-stat"><span class="collection-stat-value">${stats.totalBattlesDrawn || 0}</span><span class="collection-stat-label">Pareggi</span></div>
        <div class="collection-stat"><span class="collection-stat-value">${stats.battleWinStreak || 0}</span><span class="collection-stat-label">Serie Attuale</span></div>
      </div>
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
          <span class="battle-slot-total"><i class="ph-fill ph-lightning"></i>${total}</span>
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
          <span class="battle-preview-label"><i class="ph-fill ph-microphone-stage"></i> Fans</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.fans/3}%;background:var(--rarity-legendary);"></div></div>
          <span class="battle-preview-val">${totals.fans}</span>
        </div>
        <div class="battle-preview-row">
          <span class="battle-preview-label"><i class="ph-fill ph-palette"></i> Style</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.style/3}%;background:var(--neon-magenta);"></div></div>
          <span class="battle-preview-val">${totals.style}</span>
        </div>
        <div class="battle-preview-row">
          <span class="battle-preview-label"><i class="ph-fill ph-megaphone"></i> Influence</span>
          <div class="battle-preview-track"><div class="battle-preview-fill" style="width:${totals.influence/3}%;background:var(--neon-blue);"></div></div>
          <span class="battle-preview-val">${totals.influence}</span>
        </div>
        <div class="battle-preview-row">
          <span class="battle-preview-label"><i class="ph-fill ph-lightning"></i> Energy</span>
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
   * Avvia una battaglia singola (difficoltà Normale, nessun torneo).
   */
  startBattle() {
    if (this._team.filter(t => t).length < 3) return;
    this._tournamentMode = false;
    this._tournamentStage = 0;
    this._tournamentGold = 0;
    this._tournamentXP = 0;
    this._startMatch('normal');
  },

  /**
   * Avvia la Modalità Torneo: 3 avversari consecutivi a difficoltà crescente.
   */
  startTournament() {
    if (this._team.filter(t => t).length < 3) return;
    this._tournamentMode = true;
    this._tournamentStage = 0;
    this._tournamentGold = 0;
    this._tournamentXP = 0;
    this._startMatch(this.TOURNAMENT_ORDER[0]);
  },

  /**
   * Prepara e avvia una manche (singola battaglia da 3 round) contro un avversario
   * della difficoltà indicata. Usato sia dalla battaglia singola che da ogni tappa del torneo.
   * @param {string} difficulty - 'easy' | 'normal' | 'hard'
   */
  _startMatch(difficulty) {
    this._difficulty = difficulty;
    this._aiTeam = this._generateAITeam(difficulty);

    this._state = 'vs';
    this._currentRound = 1;
    this._roundScores = { player: 0, ai: 0 };
    this._specialUsed = false;
    this._usedPlayerIndices = [];
    this._usedAiIndices = [];
    this._roundHistory = [];

    this._showVSScreen();
  },

  /**
   * Genera una squadra AI con carte casuali, applicando il moltiplicatore di difficoltà alle stats.
   * @param {string} difficulty
   */
  _generateAITeam(difficulty) {
    const config = this.DIFFICULTY_CONFIG[difficulty] || this.DIFFICULTY_CONFIG.normal;
    const allCards = [...window.VinylDexArtists];
    const team = [];
    const used = new Set();

    for (let i = 0; i < 3; i++) {
      let cardData;
      do {
        cardData = allCards[Math.floor(Math.random() * allCards.length)];
      } while (used.has(cardData.id));
      used.add(cardData.id);

      const card = new window.VinylDexCard(cardData);
      if (config.boost !== 1) {
        this.CATEGORIES.forEach(stat => {
          card.stats[stat] = Math.round((card.stats[stat] || 0) * config.boost);
        });
      }
      team.push(card);
    }

    return team;
  },

  /**
   * Badge mostrato durante un torneo per indicare avversario corrente e difficoltà.
   */
  _renderTournamentBadge() {
    const config = this.DIFFICULTY_CONFIG[this._difficulty];
    return `
      <div class="battle-tournament-badge glass-panel">
        <i class="ph-fill ph-trophy"></i> Torneo — Avversario ${this._tournamentStage + 1}/3 · ${config.label}
      </div>
    `;
  },

  /**
   * Mostra schermata VS. La squadra IA resta nascosta.
   */
  _showVSScreen() {
    const container = document.getElementById('app-view');

    const playerCards = this._team.map(c => new window.VinylDexCard(c));
    const playerTotal = playerCards.reduce((sum, c) => sum + c.getTotalScore(), 0);

    container.innerHTML = `
      <section class="battle-vs-page">
        <div class="battle-vs-wrapper">
          ${this._tournamentMode ? this._renderTournamentBadge() : ''}
          <div class="battle-vs-content">
            <div class="battle-vs-player">
              <div class="battle-vs-avatar"><i class="ph-fill ph-vinyl-record"></i></div>
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
              <span class="battle-vs-power"><i class="ph-fill ph-lightning"></i> ${playerTotal}</span>
            </div>

            <div class="battle-vs-center">
              <span class="battle-vs-label">VS</span>
              <span class="battle-vs-round">Round 1 di 3</span>
              <button class="btn btn-primary" onclick="VinylDexBattle.startRound()">
                <i class="ph-fill ph-sword"></i> Round 1
              </button>
            </div>

            <div class="battle-vs-player battle-vs-ai">
              <div class="battle-vs-avatar"><i class="ph-fill ph-robot"></i></div>
              <h3>AI Opponent</h3>
              <div class="battle-vs-cards">
                ${this._aiTeam.map(() => `
                  <div class="battle-vs-mini battle-vs-mystery">
                    <div class="battle-vs-mystery-icon">
                      <i class="ph ph-question"></i>
                    </div>
                    <span style="font-size:0.55rem;">???</span>
                  </div>
                `).join('')}
              </div>
              <span class="battle-vs-power battle-vs-power-hidden">Squadra nascosta</span>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Avvia un round: a turni alterni scegli tu la categoria (round dispari) o la scegli l'IA (round pari).
   */
  startRound() {
    this._state = 'round';
    this._currentCategory = null;
    this._playerCard = null;
    this._aiCard = null;

    const playerPicksCategory = (this._currentRound % 2 === 1);
    if (playerPicksCategory) {
      this._showCategoryPicker();
    } else {
      this._currentCategory = this.CATEGORIES[Math.floor(Math.random() * this.CATEGORIES.length)];
      this._showCardSelect();
    }
  },

  /**
   * Schermata di scelta categoria (quando è il player a scegliere).
   */
  _showCategoryPicker() {
    const container = document.getElementById('app-view');

    container.innerHTML = `
      <section class="battle-round-page">
        ${this._tournamentMode ? this._renderTournamentBadge() : ''}
        <div class="battle-round-header">
          <span class="battle-round-number">Round ${this._currentRound} / 3</span>
          <span class="battle-round-score">${this._roundScores.player} - ${this._roundScores.ai}</span>
        </div>

        <div class="glass-panel text-center">
          <h3>Scegli tu la categoria di questo round!</h3>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:4px;">Punta sul punto forte di una delle carte che ti restano.</p>
        </div>

        <div class="battle-category-pick-grid">
          ${this.CATEGORIES.map(cat => `
            <div class="battle-category-pick-card" onclick="VinylDexBattle.chooseCategory('${cat}')">
              <span class="battle-category-pick-name">${this.CATEGORY_NAMES[cat]}</span>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  },

  /**
   * Conferma la categoria scelta dal player e passa alla selezione carta.
   * @param {string} category
   */
  chooseCategory(category) {
    this._currentCategory = category;
    this._showCardSelect();
  },

  /**
   * Schermata di scelta carta per la categoria già determinata (da player o IA).
   */
  _showCardSelect() {
    const container = document.getElementById('app-view');
    const category = this._currentCategory;
    const playerCards = this._team.map(c => new window.VinylDexCard(c));
    const availableIndices = [0, 1, 2].filter(i => !this._usedPlayerIndices.includes(i));

    container.innerHTML = `
      <section class="battle-round-page">
        ${this._tournamentMode ? this._renderTournamentBadge() : ''}
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
            ${availableIndices.map(i => {
              const card = playerCards[i];
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
                  ${!this._specialUsed ? `<button class="battle-special-btn" onclick="event.stopPropagation();VinylDexBattle.useSpecial(${i})"><i class="ph-fill ph-sparkle"></i> Abilità</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Sceglie una carta IA non ancora giocata e la segna come usata.
   * In difficoltà 'smart' (normal/hard) sceglie la carta con il valore più alto nella categoria corrente,
   * altrimenti (easy) pesca a caso. In ogni caso avviene solo DOPO la scelta del player (alla cieca).
   * @returns {Card}
   */
  _pickAiCard() {
    const config = this.DIFFICULTY_CONFIG[this._difficulty] || this.DIFFICULTY_CONFIG.normal;
    const availableIndices = this._aiTeam.map((_, i) => i).filter(i => !this._usedAiIndices.includes(i));

    let chosenIdx;
    if (config.smart) {
      chosenIdx = availableIndices.reduce((best, i) => {
        const val = this._aiTeam[i].stats[this._currentCategory] || 0;
        const bestVal = this._aiTeam[best].stats[this._currentCategory] || 0;
        return val > bestVal ? i : best;
      }, availableIndices[0]);
    } else {
      chosenIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }

    this._usedAiIndices.push(chosenIdx);
    return this._aiTeam[chosenIdx];
  },

  /**
   * Gioca una carta.
   */
  playCard(index) {
    if (this._usedPlayerIndices.includes(index)) return;
    const cardData = this._team[index];
    if (!cardData) return;

    this._playerCard = new window.VinylDexCard(cardData);
    this._usedPlayerIndices.push(index);

    // L'AI sceglie una carta tra quelle non ancora giocate (alla cieca, dopo la tua scelta)
    this._aiCard = this._pickAiCard();

    this._showRoundResult();
  },

  /**
   * Usa abilità speciale (bonus 25% per 1 round).
   */
  useSpecial(index) {
    if (this._specialUsed) return;
    if (this._usedPlayerIndices.includes(index)) return;
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
    this._usedPlayerIndices.push(index);

    // AI sceglie tra le carte non ancora giocate
    this._aiCard = this._pickAiCard();

    this._showRoundResult(bonus);
  },

  /**
   * Mostra risultato del round e lo registra nella cronologia della manche.
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

    this._roundHistory.push({
      round: this._currentRound,
      category,
      playerName, playerStat,
      aiName, aiStat,
      result: playerWon ? 'win' : (aiWon ? 'loss' : 'draw')
    });

    container.innerHTML = `
      <section class="battle-round-result">
        ${this._tournamentMode ? this._renderTournamentBadge() : ''}
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
              ${bonus > 0 ? `<span class="battle-bonus">+${bonus} <i class="ph-fill ph-sparkle"></i></span>` : ''}
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
                 ${playerWon ? '<i class="ph-fill ph-check-circle"></i> Vittoria! Round Successivo' : '<i class="ph-fill ph-x-circle"></i> Round Successivo'}
               </button>`
            : `<button class="btn btn-gold" onclick="VinylDexBattle.showFinalResult()">
                 <i class="ph-fill ph-trophy"></i> Vedi Risultato Finale
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
   * Riepilogo testuale dei round giocati nella manche corrente.
   */
  _renderRoundHistory() {
    if (!this._roundHistory.length) return '';
    return `
      <div class="battle-history glass-panel">
        <h3>Riepilogo Round</h3>
        <div class="battle-history-list">
          ${this._roundHistory.map(h => `
            <div class="battle-history-item">
              <span class="battle-history-round">R${h.round}</span>
              <span class="battle-history-cat">${this.CATEGORY_NAMES[h.category]}</span>
              <span class="battle-history-detail">${h.playerName} (${h.playerStat}) vs ${h.aiName} (${h.aiStat})</span>
              <span class="battle-history-result battle-history-${h.result}">${h.result === 'win' ? 'Vinto' : h.result === 'loss' ? 'Perso' : 'Pareggio'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Registra l'esito della manche nelle statistiche persistenti (vittorie/sconfitte/serie).
   * Ogni manche (anche quelle di un torneo) conta come una battaglia.
   */
  _recordBattleStats(playerWon, draw) {
    const storage = new window.VinylDexStorage();
    const stats = storage.getStats();

    const battleWinStreak = playerWon ? (stats.battleWinStreak || 0) + 1 : 0;

    storage.updateStats({
      totalBattlesPlayed: (stats.totalBattlesPlayed || 0) + 1,
      totalBattlesWon: (stats.totalBattlesWon || 0) + (playerWon ? 1 : 0),
      totalBattlesLost: (stats.totalBattlesLost || 0) + (!playerWon && !draw ? 1 : 0),
      totalBattlesDrawn: (stats.totalBattlesDrawn || 0) + (draw ? 1 : 0),
      battleWinStreak,
      bestBattleWinStreak: Math.max(stats.bestBattleWinStreak || 0, battleWinStreak)
    });
  },

  /**
   * Assegna gold/XP e ricalcola il livello.
   */
  _grantRewards(gold, xp) {
    const storage = new window.VinylDexStorage();
    storage.addGold(gold);
    storage.addXP(xp);

    let totalXP = storage.getXP();
    let level = 1;
    while (true) {
      const needed = level * 100 + (level - 1) * 50;
      if (totalXP >= needed) { totalXP -= needed; level++; }
      else break;
    }
    storage.setLevel(level);
  },

  /**
   * Mostra risultato finale. Se siamo in torneo, delega a _showTournamentMatchResult.
   */
  showFinalResult() {
    this._state = 'final';
    const playerWon = this._roundScores.player > this._roundScores.ai;
    const draw = this._roundScores.player === this._roundScores.ai;

    if (this._tournamentMode) {
      this._showTournamentMatchResult(playerWon, draw);
      return;
    }

    const goldReward = playerWon ? 50 : (draw ? 20 : 10);
    const xpReward = playerWon ? 100 : (draw ? 40 : 20);

    this._recordBattleStats(playerWon, draw);
    this._grantRewards(goldReward, xpReward);

    const container = document.getElementById('app-view');

    container.innerHTML = `
      <section class="battle-final-page">
        <div class="battle-final-content glass-panel">
          <div class="battle-final-icon">${playerWon ? '<i class="ph-fill ph-trophy"></i>' : (draw ? '<i class="ph-fill ph-handshake"></i>' : '<i class="ph-fill ph-heart-break"></i>')}</div>
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
              <span><i class="ph-fill ph-coin"></i></span>
              <span>+${goldReward} Gold</span>
            </div>
            <div class="battle-reward-item">
              <span><i class="ph-fill ph-lightning"></i></span>
              <span>+${xpReward} XP</span>
            </div>
          </div>

          ${this._renderRoundHistory()}

          <div class="battle-final-actions">
            <button class="btn btn-primary" onclick="window.VinylDexBattle.render(document.getElementById('app-view'), {})">
              <i class="ph-fill ph-sword"></i> Nuova Battaglia
            </button>
            <button class="btn btn-secondary" onclick="window.location.hash='#home'">
              <i class="ph-fill ph-house"></i> Torna alla Home
            </button>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Esito di una manche all'interno di un torneo: prosegue al prossimo avversario,
   * oppure chiude il torneo (eliminazione o vittoria completa con bonus).
   */
  _showTournamentMatchResult(playerWon, draw) {
    this._recordBattleStats(playerWon, draw);

    const config = this.DIFFICULTY_CONFIG[this._difficulty];
    if (playerWon) {
      this._tournamentGold += config.gold;
      this._tournamentXP += config.xp;
    }

    const wonAllStages = playerWon && this._tournamentStage === this.TOURNAMENT_ORDER.length - 1;
    const eliminated = !playerWon;
    const container = document.getElementById('app-view');

    if (eliminated || wonAllStages) {
      const bonusGold = wonAllStages ? 100 : 0;
      const bonusXP = wonAllStages ? 150 : 0;
      const finalGold = this._tournamentGold + bonusGold;
      const finalXP = this._tournamentXP + bonusXP;
      if (finalGold > 0 || finalXP > 0) this._grantRewards(finalGold, finalXP);

      container.innerHTML = `
        <section class="battle-final-page">
          <div class="battle-final-content glass-panel">
            <div class="battle-final-icon">${wonAllStages ? '<i class="ph-fill ph-trophy"></i>' : '<i class="ph-fill ph-heart-break"></i>'}</div>
            <h2 class="battle-final-title" style="color:${wonAllStages ? 'var(--neon-gold)' : 'var(--text-secondary)'}">
              ${wonAllStages ? 'CAMPIONE DEL TORNEO!' : `ELIMINATO — AVVERSARIO ${this._tournamentStage + 1}/3`}
            </h2>
            <p style="color:var(--text-secondary);">
              ${wonAllStages ? 'Hai sconfitto tutti e 3 gli avversari!' : `Hai superato ${this._tournamentStage} avversari su 3.`}
            </p>

            <div class="battle-final-rewards">
              <h3>Ricompense Totali</h3>
              <div class="battle-reward-item">
                <span><i class="ph-fill ph-coin"></i></span>
                <span>+${finalGold} Gold</span>
              </div>
              <div class="battle-reward-item">
                <span><i class="ph-fill ph-lightning"></i></span>
                <span>+${finalXP} XP</span>
              </div>
            </div>

            ${this._renderRoundHistory()}

            <div class="battle-final-actions">
              <button class="btn btn-primary" onclick="window.VinylDexBattle.render(document.getElementById('app-view'), {})">
                <i class="ph-fill ph-sword"></i> Nuova Battaglia
              </button>
              <button class="btn btn-secondary" onclick="window.location.hash='#home'">
                <i class="ph-fill ph-house"></i> Torna alla Home
              </button>
            </div>
          </div>
        </section>
      `;
      return;
    }

    // Vittoria su questo avversario: il torneo prosegue
    container.innerHTML = `
      <section class="battle-final-page">
        <div class="battle-final-content glass-panel">
          <div class="battle-final-icon"><i class="ph-fill ph-trophy"></i></div>
          <h2 class="battle-final-title" style="color:var(--neon-gold);">AVVERSARIO ${this._tournamentStage + 1}/3 SCONFITTO!</h2>
          <p style="color:var(--text-secondary);">Punteggio: ${this._roundScores.player} - ${this._roundScores.ai}</p>

          ${this._renderRoundHistory()}

          <button class="btn btn-gold btn-large" onclick="VinylDexBattle.nextTournamentMatch()" style="margin-top:var(--space-md);">
            <i class="ph-fill ph-sword"></i> Prossimo Avversario
          </button>
        </div>
      </section>
    `;
  },

  /**
   * Passa all'avversario successivo nel torneo.
   */
  nextTournamentMatch() {
    this._tournamentStage++;
    this._startMatch(this.TOURNAMENT_ORDER[this._tournamentStage]);
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
    this._usedPlayerIndices = [];
    this._usedAiIndices = [];
    this._roundHistory = [];
    this._tournamentMode = false;
    this._tournamentStage = 0;
    this._tournamentGold = 0;
    this._tournamentXP = 0;
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
