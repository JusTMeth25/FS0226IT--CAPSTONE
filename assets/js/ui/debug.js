/**
 * VinylDex - Debug Mode & Bilanciamento (Feature 6)
 * 
 * Attivabile con tasto `D`.
 * Fornisce:
 * - Pannello debug UI
 * - Reset collezione/gold/XP/livello/stats
 * - Aggiungi 9999 gold
 * - Pacchetti infiniti (senza consumare gold/cooldown)
 * - Simulazione drop rate (1000 aperture con grafico)
 * - Test bilanciamento (carte ottenute per rarità)
 * - Esporta/Importa dati LocalStorage (JSON)
 */
const VinylDexDebug = {
  /** Debug mode attivo */
  _active: false,

  /** Panel element */
  _panel: null,

  /** Key handler reference */
  _keyHandler: null,

  /**
   * Attiva il debug mode.
   */
  enable() {
    if (this._active) return;
    this._active = true;
    this._keyHandler = (e) => {
      if (e.key === 'd' || e.key === 'D') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          this.toggle();
        }
      }
    };
    document.addEventListener('keydown', this._keyHandler);
    console.log('[VinylDexDebug] 🐛 Debug mode attivato. Premi D per aprire/chiudere il pannello.');
  },

  /**
   * Disattiva il debug mode.
   */
  disable() {
    this._active = false;
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    this._removePanel();
  },

  /**
   * Apre/chiude il pannello debug.
   */
  toggle() {
    if (this._panel && this._panel.parentNode) {
      this._removePanel();
    } else {
      this._showPanel();
    }
  },

  /**
   * Mostra il pannello debug.
   */
  _showPanel() {
    // Rimuovi eventuale pannello esistente
    this._removePanel();

    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const gold = storage.getGold();
    const xp = storage.getXP();
    const level = storage.getLevel();
    const stats = storage.getStats();
    const storageStats = storage.getStats();

    this._panel = document.createElement('div');
    this._panel.className = 'debug-panel';
    this._panel.innerHTML = `
      <div class="debug-panel-header">
        <span class="debug-panel-title">🐛 Debug Panel</span>
        <button class="debug-panel-close" onclick="VinylDexDebug.toggle()">✕</button>
      </div>
      <div class="debug-panel-body">
        <!-- Info Section -->
        <div class="debug-section">
          <h4>📊 Stato Corrente</h4>
          <div class="debug-info-grid">
            <div class="debug-info-item"><span class="debug-label">Carte in collezione</span><span class="debug-value">${collection.length}</span></div>
            <div class="debug-info-item"><span class="debug-label">Carte uniche</span><span class="debug-value">${new Set(collection.map(c => c.id)).size}</span></div>
            <div class="debug-info-item"><span class="debug-label">Gold</span><span class="debug-value">${gold}</span></div>
            <div class="debug-info-item"><span class="debug-label">XP</span><span class="debug-value">${xp}</span></div>
            <div class="debug-info-item"><span class="debug-label">Livello</span><span class="debug-value">${level}</span></div>
            <div class="debug-info-item"><span class="debug-label">Storage usato</span><span class="debug-value">${(storageStats.usedBytes / 1024).toFixed(1)} KB</span></div>
          </div>
        </div>

        <!-- Stats -->
        <div class="debug-section">
          <h4>📈 Statistiche</h4>
          <div class="debug-info-grid">
            <div class="debug-info-item"><span class="debug-label">Pacchetti aperti</span><span class="debug-value">${stats.totalPacksOpened || 0}</span></div>
            <div class="debug-info-item"><span class="debug-label">Carte ottenute</span><span class="debug-value">${stats.totalCardsObtained || 0}</span></div>
            <div class="debug-info-item"><span class="debug-label">Leggendarie</span><span class="debug-value" style="color:var(--rarity-legendary)">${stats.legendaryCount || 0}</span></div>
            <div class="debug-info-item"><span class="debug-label">Epiche</span><span class="debug-value" style="color:var(--rarity-epic)">${stats.epicCount || 0}</span></div>
            <div class="debug-info-item"><span class="debug-label">Rare</span><span class="debug-value" style="color:var(--rarity-rare)">${stats.rareCount || 0}</span></div>
            <div class="debug-info-item"><span class="debug-label">Non Comuni</span><span class="debug-value" style="color:var(--rarity-uncommon)">${stats.uncommonCount || 0}</span></div>
            <div class="debug-info-item"><span class="debug-label">Comuni</span><span class="debug-value" style="color:var(--rarity-common)">${stats.commonCount || 0}</span></div>
          </div>
        </div>

        <!-- Actions -->
        <div class="debug-section">
          <h4>⚡ Azioni Rapide</h4>
          <div class="debug-actions">
            <button class="debug-btn debug-btn-gold" onclick="VinylDexDebug.addGold(9999)">+9999 Gold</button>
            <button class="debug-btn debug-btn-gold" onclick="VinylDexDebug.addGold(1000)">+1000 Gold</button>
            <button class="debug-btn debug-btn-xp" onclick="VinylDexDebug.addXP(5000)">+5000 XP</button>
            <button class="debug-btn debug-btn-danger" onclick="VinylDexDebug.resetCollection()">🗑 Reset Collezione</button>
            <button class="debug-btn debug-btn-danger" onclick="VinylDexDebug.resetAll()">⚠ Reset Completo</button>
            <button class="debug-btn debug-btn-pack" onclick="VinylDexDebug.openFreePack()">🎁 Pacchetto Gratis</button>
            <button class="debug-btn debug-btn-pack" onclick="VinylDexDebug.openDeluxePack()">💎 Pacchetto Deluxe</button>
            <button class="debug-btn debug-btn-pack" onclick="VinylDexDebug.openPremiumPack()">👑 Pacchetto Premium</button>
            <button class="debug-btn debug-btn-primary" onclick="VinylDexDebug.addSantanaCard()" style="background:linear-gradient(135deg,#FFD700,#FF8C00);color:#000;">🎸 Aggiungi Carlos Santana</button>
            <button class="debug-btn debug-btn-primary" onclick="VinylDexDebug.addJacksonCard()" style="background:linear-gradient(135deg,#FFD700,#FF8C00);color:#000;">👑 Aggiungi Michael Jackson</button>
          </div>
        </div>

        <!-- Drop Rate Simulation -->
        <div class="debug-section">
          <h4>🎲 Simulazione Drop Rate</h4>
          <div class="debug-sim-controls">
            <label>Pacchetto:
              <select id="debug-sim-pack" class="debug-select">
                <option value="0">Base</option>
                <option value="1">Deluxe</option>
                <option value="2">Premium</option>
              </select>
            </label>
            <label>Estrazioni:
              <select id="debug-sim-count" class="debug-select">
                <option value="100">100</option>
                <option value="1000" selected>1.000</option>
                <option value="10000">10.000</option>
              </select>
            </label>
            <button class="debug-btn debug-btn-primary" onclick="VinylDexDebug.runSimulation()">▶ Esegui Simulazione</button>
          </div>
          <div id="debug-sim-results" class="debug-sim-results"></div>
        </div>

        <!-- Export/Import -->
        <div class="debug-section">
          <h4>💾 Backup Dati</h4>
          <div class="debug-actions">
            <button class="debug-btn debug-btn-primary" onclick="VinylDexDebug.exportData()">📤 Esporta JSON</button>
            <button class="debug-btn debug-btn-secondary" onclick="VinylDexDebug.importData()">📥 Importa JSON</button>
            <input type="file" id="debug-import-input" accept=".json" style="display:none" onchange="VinylDexDebug.handleImport(event)">
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this._panel);

    // Animazione entrata
    requestAnimationFrame(() => {
      this._panel.classList.add('debug-panel-visible');
    });
  },

  /**
   * Rimuove il pannello debug.
   */
  _removePanel() {
    if (this._panel && this._panel.parentNode) {
      this._panel.classList.remove('debug-panel-visible');
      setTimeout(() => {
        if (this._panel && this._panel.parentNode) {
          this._panel.parentNode.removeChild(this._panel);
          this._panel = null;
        }
      }, 200);
    }
  },

  // ===== AZIONI RAPIDE =====

  /**
   * Aggiunge gold.
   */
  addGold(amount) {
    const storage = new window.VinylDexStorage();
    storage.addGold(amount);
    this._refresh();
  },

  /**
   * Aggiunge XP.
   */
  addXP(amount) {
    const storage = new window.VinylDexStorage();
    storage.addXP(amount);
    // Calcola livello (formula: lv * 100 + (lv-1) * 50)
    let totalXP = storage.getXP();
    let level = 1;
    while (true) {
      const needed = level * 100 + (level - 1) * 50;
      if (totalXP >= needed) {
        totalXP -= needed;
        level++;
      } else break;
    }
    storage.setLevel(level);
    this._refresh();
  },

  /**
   * Resetta solo la collezione.
   */
  resetCollection() {
    if (!confirm('Resettare la collezione? Le carte andranno perse!')) return;
    const storage = new window.VinylDexStorage();
    storage.setCollection([]);
    storage.updateStats({
      totalPacksOpened: 0,
      totalCardsObtained: 0,
      legendaryCount: 0,
      epicCount: 0,
      rareCount: 0,
      uncommonCount: 0,
      commonCount: 0
    });
    this._refresh();
  },

  /**
   * Reset completo di TUTTI i dati.
   */
  resetAll() {
    if (!confirm('⚠️ RESET COMPLETO?\nTutti i dati (collezione, gold, XP, livello, stats) verranno cancellati!')) return;
    if (!confirm('Sei sicuro? Questa azione è IRREVERSIBILE!')) return;
    const storage = new window.VinylDexStorage();
    storage.clearAll();
    this._refresh();
  },

  /**
   * Apre un pacchetto gratis senza consumare gold/cooldown.
   */
  openFreePack() {
    this._debugOpenPack(0);
  },

  /**
   * Apre pacchetto deluxe gratis.
   */
  openDeluxePack() {
    this._debugOpenPack(1);
  },

  /**
   * Apre pacchetto premium gratis.
   */
  openPremiumPack() {
    this._debugOpenPack(2);
  },

  /**
   * Aggiunge la carta Carlos Santana alla collezione (debug).
   */
  addSantanaCard() {
    const artistData = window.VinylDexArtists.find(a => a.id === 'virtuoso-000');
    if (!artistData) {
      alert('Carta Carlos Santana non trovata nel database!');
      return;
    }

    const storage = new window.VinylDexStorage();
    storage.addCardToCollection({
      ...artistData,
      img: 'assets/img/Carlos_Santana_VynilLegends.webp'
    });

    // Aggiorna stats
    const stats = storage.getStats();
    stats.legendaryCount = (stats.legendaryCount || 0) + 1;
    stats.totalCardsObtained = (stats.totalCardsObtained || 0) + 1;
    storage.updateStats(stats);

    alert('✅ Carlos Santana aggiunto alla collezione!');
    this._refresh();
  },

  /**
   * Aggiunge la carta Michael Jackson alla collezione (debug).
   */
  addJacksonCard() {
    const artistData = window.VinylDexArtists.find(a => a.name === 'Michael Jackson');
    if (!artistData) {
      alert('Carta Michael Jackson non trovata nel database!');
      return;
    }

    const storage = new window.VinylDexStorage();
    storage.addCardToCollection({
      ...artistData,
      img: 'assets/img/Michael_Jackson.webp'
    });

    // Aggiorna stats
    const stats = storage.getStats();
    stats.legendaryCount = (stats.legendaryCount || 0) + 1;
    stats.totalCardsObtained = (stats.totalCardsObtained || 0) + 1;
    storage.updateStats(stats);

    alert('✅ Michael Jackson aggiunto alla collezione!');
    this._refresh();
  },

  /**
   * Apre un pacchetto in debug mode (senza consumare risorse).
   */
  _debugOpenPack(packIndex) {
    const packConfig = window.VinylDexPacks[packIndex];
    if (!packConfig) return;

    const pack = new window.VinylDexPack(packConfig);
    const cards = pack.open(window.VinylDexArtists);

    const storage = new window.VinylDexStorage();
    storage.addCardsToCollection(cards.map(c => c.toJSON()));

    // Aggiorna stats senza contare pacchetti aperti (debug)
    const stats = storage.getStats();
    cards.forEach(c => {
      const r = c.rarity;
      if (r === 'legendary') stats.legendaryCount = (stats.legendaryCount || 0) + 1;
      else if (r === 'epic') stats.epicCount = (stats.epicCount || 0) + 1;
      else if (r === 'rare') stats.rareCount = (stats.rareCount || 0) + 1;
      else if (r === 'uncommon') stats.uncommonCount = (stats.uncommonCount || 0) + 1;
      else if (r === 'common') stats.commonCount = (stats.commonCount || 0) + 1;
    });
    stats.totalCardsObtained = (stats.totalCardsObtained || 0) + cards.length;
    stats.totalPacksOpened = (stats.totalPacksOpened || 0) + 1;
    storage.updateStats(stats);

    // Feedback
    const rarities = cards.map(c => c.rarity);
    const legendaryCount = rarities.filter(r => r === 'legendary').length;
    const epicCount = rarities.filter(r => r === 'epic').length;
    console.log(`[VinylDexDebug] Pacchetto aperto: ${cards.length} carte (${legendaryCount}L, ${epicCount}E)`);

    this._refresh();
  },

  // ===== SIMULAZIONE DROP RATE =====

  /**
   * Esegue simulazione drop rate.
   */
  runSimulation() {
    const packIndex = parseInt(document.getElementById('debug-sim-pack').value);
    const trials = parseInt(document.getElementById('debug-sim-count').value);
    const packConfig = window.VinylDexPacks[packIndex];
    if (!packConfig) return;

    const resultsContainer = document.getElementById('debug-sim-results');
    resultsContainer.innerHTML = '<p class="debug-sim-running">⏳ Simulazione in corso...</p>';

    // Usa setTimeout per non bloccare la UI
    setTimeout(() => {
      const pack = new window.VinylDexPack(packConfig);
      const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
      const totalCardsSim = trials * packConfig.cardCount;

      for (let i = 0; i < trials; i++) {
        const cards = pack.open(window.VinylDexArtists);
        cards.forEach(c => {
          counts[c.rarity]++;
        });
      }

      const rarityNames = {
        common: 'Comune',
        uncommon: 'Non Comune',
        rare: 'Rara',
        epic: 'Epica',
        legendary: 'Leggendaria'
      };

      const rarityColors = {
        common: 'var(--rarity-common)',
        uncommon: 'var(--rarity-uncommon)',
        rare: 'var(--rarity-rare)',
        epic: 'var(--rarity-epic)',
        legendary: 'var(--rarity-legendary)'
      };

      const dropRates = packConfig.dropRates;

      let html = `
        <div class="debug-sim-summary">
          <span>📦 ${packConfig.name}</span>
          <span>🎲 ${trials.toLocaleString()} aperture</span>
          <span>🃏 ${totalCardsSim.toLocaleString()} carte totali</span>
        </div>
        <div class="debug-sim-chart">
      `;

      Object.entries(counts).forEach(([rarity, count]) => {
        const actualRate = (count / totalCardsSim) * 100;
        const expectedRate = (dropRates[rarity] || 0) * 100;
        const diff = (actualRate - expectedRate).toFixed(2);
        const diffClass = Math.abs(parseFloat(diff)) > 1 ? (parseFloat(diff) > 0 ? 'debug-diff-pos' : 'debug-diff-neg') : 'debug-diff-ok';
        const barPercent = Math.min((count / totalCardsSim) * 200, 100); // Scala per visibilità

        html += `
          <div class="debug-sim-row">
            <span class="debug-sim-label" style="color:${rarityColors[rarity]}">${rarityNames[rarity]}</span>
            <div class="debug-sim-bar-track">
              <div class="debug-sim-bar-fill" style="width:${barPercent}%;background:${rarityColors[rarity]};"></div>
            </div>
            <span class="debug-sim-count">${count}</span>
            <span class="debug-sim-rate">${actualRate.toFixed(2)}%</span>
            <span class="debug-sim-expected">(atteso ${expectedRate.toFixed(0)}%)</span>
            <span class="debug-sim-diff ${diffClass}">${diff > 0 ? '+' : ''}${diff}%</span>
          </div>
        `;
      });

      html += '</div>';
      resultsContainer.innerHTML = html;
    }, 50);
  },

  // ===== EXPORT/IMPORT =====

  /**
   * Esporta tutti i dati VinylDex in JSON.
   */
  exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vinylDex_')) {
        data[key] = JSON.parse(localStorage.getItem(key));
      }
    }

    const json = JSON.stringify({ vinylDexData: data, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinylvdex-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Importa dati da file JSON.
   */
  importData() {
    document.getElementById('debug-import-input').click();
  },

  /**
   * Gestisce l'import del file selezionato.
   */
  handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.vinylDexData) {
          alert('Formato file non valido!');
          return;
        }

        if (!confirm('Importare i dati? I dati correnti verranno SOVRASCRITTI!')) return;

        // Pulisci dati esistenti
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('vinylDex_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Importa nuovi dati
        Object.entries(data.vinylDexData).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });

        alert(`✅ Import completato! ${Object.keys(data.vinylDexData).length} chiavi importate.`);
        this._refresh();
      } catch (err) {
        alert('Errore durante l\'import: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  },

  /**
   * Aggiorna il pannello.
   */
  _refresh() {
    // Ricarica la pagina corrente per aggiornare i dati
    if (this._panel) {
      this._showPanel();
    }
    // Ricarica la view corrente per riflettere i cambiamenti
    const hash = window.location.hash.slice(1) || 'home';
    window.location.hash = '#';
    setTimeout(() => {
      window.location.hash = `#${hash}`;
    }, 50);
  }
};

// Export globale
window.VinylDexDebug = VinylDexDebug;