/**
 * VinylDex - Missioni e Livelli (Feature 8)
 * 
 * Gestisce:
 * - Sistema livelli con formula XP
 * - Barra XP e notifica level up
 * - Missioni Daily, Weekly, Progress
 * - Ricompense (gold, XP, pacchetti)
 * - Login giornaliero (ricompensa)
 */
const VinylDexMissions = {
  /** Missioni attive */
  _missions: [],

  /** Giorno login corrente (per daily reset) */
  _currentDay: null,

  /** XP Levels cache */
  LEVELS: [],

  /** Inizializza i livelli */
  _initLevels() {
    if (this.LEVELS.length > 0) return;
    for (let lv = 1; lv <= 50; lv++) {
      this.LEVELS.push({
        level: lv,
        xpNeeded: lv * 100 + (lv - 1) * 50,
        rewards: this._getLevelRewards(lv)
      });
    }
  },

  /**
   * Ricompense per livello.
   */
  _getLevelRewards(lv) {
    const rewards = { gold: 0, pack: null };
    if (lv % 5 === 0) rewards.gold = lv * 25;
    else if (lv % 2 === 0) rewards.gold = lv * 10;
    else rewards.gold = lv * 5;
    if (lv === 5) rewards.pack = 'pack-deluxe';
    if (lv === 10 || lv === 25 || lv === 50) rewards.pack = 'pack-premium';
    return rewards;
  },

  /**
   * Calcola livello da XP totale.
   */
  _calcLevel(totalXP) {
    this._initLevels();
    let xp = totalXP;
    let level = 1;
    for (const lv of this.LEVELS) {
      if (xp >= lv.xpNeeded) {
        xp -= lv.xpNeeded;
        level = lv.level + 1;
      } else break;
    }
    return { level, xpRemaining: xp, xpForNext: this.LEVELS[Math.min(level - 1, this.LEVELS.length - 1)].xpNeeded };
  },

  /**
   * Genera le missioni daily/weekly/progress in base allo stato corrente.
   */
  _generateMissions(storage) {
    const collection = storage.getCollection();
    const stats = storage.getStats();
    const ownedIds = new Set(collection.map(c => c.id));
    const today = new Date().toDateString();

    // Controlla se è un nuovo giorno (reset daily)
    const lastDaily = storage.get('lastDailyReset', '');
    const isNewDay = lastDaily !== today;
    if (isNewDay) storage.set('lastDailyReset', today);

    const missions = [];

    // === DAILY (resettano ogni giorno) ===
    missions.push({
      id: 'daily-open-pack',
      title: 'Apri un pacchetto',
      description: 'Apri 1 pacchetto oggi',
      type: 'daily',
      icon: '🎁',
      target: 1,
      progress: isNewDay ? 0 : Math.min(stats.totalPacksOpened || 0, 1),
      rewardGold: 25,
      rewardXP: 50,
      completed: false,
      claimed: false
    });

    missions.push({
      id: 'daily-collect-cards',
      title: 'Colleziona carte',
      description: 'Ottieni 3 carte oggi',
      type: 'daily',
      icon: '🃏',
      target: 3,
      progress: isNewDay ? 0 : Math.min(stats.totalCardsObtained || 0, 3),
      rewardGold: 30,
      rewardXP: 60,
      completed: false,
      claimed: false
    });

    missions.push({
      id: 'daily-fight',
      title: 'Combatti!',
      description: 'Completa 1 battaglia',
      type: 'daily',
      icon: '⚔️',
      target: 1,
      progress: 0, // Verrà tracciato da battaglia
      rewardGold: 35,
      rewardXP: 70,
      completed: false,
      claimed: false
    });

    // === WEEKLY ===
    missions.push({
      id: 'weekly-open-5',
      title: 'Apri 5 pacchetti',
      description: 'Apri 5 pacchetti questa settimana',
      type: 'weekly',
      icon: '🎁',
      target: 5,
      progress: Math.min(stats.totalPacksOpened || 0, 5),
      rewardGold: 100,
      rewardXP: 200,
      completed: false,
      claimed: false
    });

    missions.push({
      id: 'weekly-legendary',
      title: 'Caccia alla Leggendaria',
      description: 'Ottieni 1 carta Leggendaria',
      type: 'weekly',
      icon: '👑',
      target: 1,
      progress: Math.min(stats.legendaryCount || 0, 1),
      rewardGold: 150,
      rewardXP: 300,
      pack: 'pack-deluxe',
      completed: false,
      claimed: false
    });

    missions.push({
      id: 'weekly-battle-win',
      title: 'Vittorie Strepitose',
      description: 'Vinci 3 battaglie',
      type: 'weekly',
      icon: '🏆',
      target: 3,
      progress: 0, // Tracciato da battaglia
      rewardGold: 200,
      rewardXP: 400,
      pack: 'pack-premium',
      completed: false,
      claimed: false
    });

    // === PROGRESS (una tantum) ===
    const progressMissions = [
      { id: 'progress-10', target: 10, title: 'Prime 10 Carte!', rewardGold: 100, rewardXP: 150 },
      { id: 'progress-25', target: 25, title: 'Collezionista', rewardGold: 200, rewardXP: 300 },
      { id: 'progress-40', target: 40, title: 'Completista!', rewardGold: 500, rewardXP: 1000, pack: 'pack-premium' }
    ];

    progressMissions.forEach(pm => {
      const completed = ownedIds.size >= pm.target;
      missions.push({
        id: pm.id,
        title: pm.title,
        description: `Colleziona ${pm.target} carte uniche`,
        type: 'progress',
        icon: '📖',
        target: pm.target,
        progress: Math.min(ownedIds.size, pm.target),
        rewardGold: pm.rewardGold || 0,
        rewardXP: pm.rewardXP || 0,
        pack: pm.pack || null,
        completed,
        claimed: false
      });
    });

    return missions;
  },

  /**
   * Renderizza la pagina missioni.
   */
  render(container, params) {
    const storage = new window.VinylDexStorage();
    const totalXP = storage.getXP();
    const gold = storage.getGold();
    const level = storage.getLevel();
    const { level: calcLevel, xpRemaining, xpForNext } = this._calcLevel(totalXP);
    const xpPercent = xpForNext > 0 ? Math.round((xpRemaining / xpForNext) * 100) : 100;

    // Ricompense non reclamate
    const unclaimedLevels = this._getUnclaimedLevelRewards(storage);

    // Genera missioni
    this._missions = this._generateMissions(storage);

    // Login giornaliero
    const lastLogin = storage.get('lastLoginDate', '');
    const today = new Date().toDateString();
    const canClaimLogin = lastLogin !== today;
    const loginStreak = storage.get('loginStreak', 0);

    container.innerHTML = `
      <section class="missions-page">
        <h2 class="section-title text-gradient">🎯 Missioni e Livelli</h2>

        <!-- Level Card -->
        <div class="missions-level-card glass-panel">
          <div class="missions-level-top">
            <div class="missions-level-info">
              <span class="missions-level-label">LIVELLO</span>
              <span class="missions-level-number">${calcLevel}</span>
            </div>
            <div class="missions-level-stats">
              <div class="missions-level-stat">
                <span>🪙</span>
                <span>${gold}</span>
              </div>
              <div class="missions-level-stat">
                <span>⚡</span>
                <span>${totalXP} XP</span>
              </div>
            </div>
          </div>
          <div class="missions-xp-bar-container">
            <div class="missions-xp-bar">
              <div class="missions-xp-fill" style="width:${xpPercent}%"></div>
            </div>
            <span class="missions-xp-text">${xpRemaining} / ${xpForNext} XP</span>
          </div>
          
          <!-- Level Rewards non reclamate -->
          ${unclaimedLevels.length > 0 ? `
            <div class="missions-level-rewards">
              <span>🎁 Ricompense livello da reclamare:</span>
              ${unclaimedLevels.map(lv => `
                <button class="btn btn-gold btn-small" onclick="VinylDexMissions.claimLevelReward(${lv})">
                  Livello ${lv} — Reclama
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Login Giornaliero -->
        <div class="missions-login-card glass-panel ${canClaimLogin ? 'missions-login-available' : ''}"
             onclick="${canClaimLogin ? 'VinylDexMissions.claimLoginReward()' : ''}">
          <span class="missions-login-icon">${canClaimLogin ? '🎁' : '✅'}</span>
          <div class="missions-login-info">
            <span class="missions-login-title">Login Giornaliero</span>
            <span class="missions-login-desc">
              ${canClaimLogin ? 'Clicca per ritirare la tua ricompensa giornaliera!' : 'Già reclamato oggi. Torna domani!'}
            </span>
          </div>
          <span class="missions-login-streak">🔥 Giorno ${loginStreak + (canClaimLogin ? 1 : 0)}</span>
        </div>

        <!-- Daily Missions -->
        <div class="glass-panel">
          <h3 class="missions-section-title">📅 Daily</h3>
          <div class="missions-list">
            ${this._renderMissionsByType('daily')}
          </div>
        </div>

        <!-- Weekly Missions -->
        <div class="glass-panel">
          <h3 class="missions-section-title">📆 Settimanali</h3>
          <div class="missions-list">
            ${this._renderMissionsByType('weekly')}
          </div>
        </div>

        <!-- Progress Missions -->
        <div class="glass-panel">
          <h3 class="missions-section-title">🏆 Progresso</h3>
          <div class="missions-list">
            ${this._renderMissionsByType('progress')}
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Renderizza missioni di un tipo.
   */
  _renderMissionsByType(type) {
    const missions = this._missions.filter(m => m.type === type);
    if (missions.length === 0) return '<p style="color:var(--text-muted);">Nessuna missione disponibile.</p>';

    return missions.map(m => {
      const progress = Math.min(m.progress, m.target);
      const percent = m.target > 0 ? Math.round((progress / m.target) * 100) : 0;
      const completed = progress >= m.target;
      const claimed = m.claimed;

      return `
        <div class="missions-item ${completed ? 'missions-completed' : ''} ${claimed ? 'missions-claimed' : ''}">
          <span class="missions-item-icon">${claimed ? '✅' : (completed ? m.icon : '🔒')}</span>
          <div class="missions-item-info">
            <span class="missions-item-title">${m.title}</span>
            <span class="missions-item-desc">${m.description}</span>
            <div class="missions-item-progress">
              <div class="missions-item-bar">
                <div class="missions-item-fill" style="width:${percent}%"></div>
              </div>
              <span class="missions-item-text">${progress}/${m.target}</span>
            </div>
          </div>
          <div class="missions-item-rewards">
            ${m.rewardGold > 0 ? `<span class="missions-reward">🪙 ${m.rewardGold}</span>` : ''}
            ${m.rewardXP > 0 ? `<span class="missions-reward">⚡ ${m.rewardXP}</span>` : ''}
            ${m.pack ? `<span class="missions-reward">🎁 ${m.pack === 'pack-premium' ? 'Premium' : 'Deluxe'}</span>` : ''}
            ${completed && !claimed ? `<button class="btn btn-gold btn-small" onclick="VinylDexMissions.claimMission('${m.id}', this)">Reclama</button>` : ''}
            ${claimed ? '<span class="missions-claimed-badge">Reclamato</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Trova ricompense livello non reclamate.
   */
  _getUnclaimedLevelRewards(storage) {
    const currentLevel = storage.getLevel();
    const claimedLevels = storage.get('claimedLevelRewards', []);
    const unclaimed = [];
    for (let lv = 1; lv < currentLevel; lv++) {
      if (!claimedLevels.includes(lv)) unclaimed.push(lv);
    }
    return unclaimed;
  },

  /**
   * Reclama ricompensa livello.
   */
  claimLevelReward(level) {
    const storage = new window.VinylDexStorage();
    const rewards = this._getLevelRewards(level);
    const claimedLevels = storage.get('claimedLevelRewards', []);

    if (claimedLevels.includes(level)) return;

    if (rewards.gold > 0) storage.addGold(rewards.gold);
    if (rewards.pack) storage.addGold(150); // Valore pacchetto

    claimedLevels.push(level);
    storage.set('claimedLevelRewards', claimedLevels);

    this._reRender();
  },

  /**
   * Reclama login giornaliero.
   */
  claimLoginReward() {
    const storage = new window.VinylDexStorage();
    const today = new Date().toDateString();
    const lastLogin = storage.get('lastLoginDate', '');
    
    if (lastLogin === today) return;

    let streak = storage.get('loginStreak', 0);
    
    // Verifica se il login è consecutivo (giorno prima)
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastLogin === yesterday) {
      streak++;
    } else {
      streak = 1;
    }

    // Ricompensa base
    const goldReward = 10 + streak * 2;
    const xpReward = 20 + streak * 3;

    storage.addGold(goldReward);
    storage.addXP(xpReward);
    storage.set('lastLoginDate', today);
    storage.set('loginStreak', streak);

    // Calcola e aggiorna livello
    const totalXP = storage.getXP();
    const { level } = this._calcLevel(totalXP);
    storage.setLevel(level);

    this._reRender();
  },

  /**
   * Reclama ricompensa missione.
   */
  claimMission(missionId, btnElement) {
    const storage = new window.VinylDexStorage();
    const mission = this._missions.find(m => m.id === missionId);
    if (!mission || mission.claimed) return;

    mission.claimed = true;

    // Applica ricompense
    if (mission.rewardGold > 0) storage.addGold(mission.rewardGold);
    if (mission.rewardXP > 0) storage.addXP(mission.rewardXP);
    if (mission.pack) storage.addGold(150); // Valore pacchetto

    // Calcola e aggiorna livello
    const totalXP = storage.getXP();
    const { level } = this._calcLevel(totalXP);
    storage.setLevel(level);

    // Feedback visivo
    if (btnElement) {
      const item = btnElement.closest('.missions-item');
      if (item) {
        item.classList.add('missions-claimed');
        btnElement.remove();
        const badge = document.createElement('span');
        badge.className = 'missions-claimed-badge';
        badge.textContent = 'Reclamato';
        item.querySelector('.missions-item-rewards').appendChild(badge);
      }
    }
  },

  /**
   * Aggiorna progresso missioni (chiamato da altre feature).
   */
  updateProgress(type, amount = 1) {
    // Questa funzione verrà chiamata da pack-opening.js e battle.js
    // per aggiornare il progresso delle missioni in tempo reale
    const storage = new window.VinylDexStorage();
    const missionData = storage.get('missionProgress', {});
    
    if (!missionData[type]) missionData[type] = 0;
    missionData[type] += amount;
    storage.set('missionProgress', missionData);
  },

  /**
   * Ri-renderizza.
   */
  _reRender() {
    const container = document.getElementById('app-view');
    if (container) this.render(container, {});
  },

  /**
   * Cleanup.
   */
  destroy() {}
};

// Export globale
window.VinylDexMissions = VinylDexMissions;