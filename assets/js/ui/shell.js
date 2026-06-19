/**
 * VinylDex - App Shell (sidebar + topbar)
 *
 * Gestisce le parti dell'interfaccia che vivono fuori da #app-view
 * (sidebar di navigazione, topbar) e che quindi il router non
 * re-renderizza da solo:
 * - Aggiorna username/livello/XP/gold ogni volta che cambia qualcosa
 *   (chiamato da app.js a ogni cambio di route).
 * - Apertura/chiusura della sidebar in versione mobile (hamburger).
 */
const VinylDexShell = {
  /**
   * Aggiorna i dati dinamici di sidebar e topbar leggendo lo storage corrente.
   */
  update() {
    const storage = new window.VinylDexStorage();
    const totalXP = storage.getXP();
    const gold = storage.getGold();

    // Stesso calcolo livello/XP usato in missions.js, per restare coerenti
    // con quanto mostrato nella pagina Missioni.
    const { level, xpRemaining, xpForNext } = window.VinylDexMissions._calcLevel(totalXP);
    const xpPercent = xpForNext > 0 ? Math.round((xpRemaining / xpForNext) * 100) : 100;

    const user = window.VinylDexAuth && window.VinylDexAuth.isAuthenticated()
      ? window.VinylDexAuth.currentUser()
      : null;

    this._setText('sidebar-username', user ? user.username : 'Ospite');
    this._setText('sidebar-level', `Livello ${level}`);
    this._setText('sidebar-xp-text', `${xpRemaining} / ${xpForNext} XP`);
    this._setWidth('sidebar-xp-fill', xpPercent);
    this._setText('sidebar-gold', gold);
    this._setText('topbar-gold', gold);

    if (window.VinylDexSound) window.VinylDexSound._updateToggleButton();
  },

  /**
   * Apre/chiude la sidebar mobile (off-canvas) e l'overlay associato.
   */
  toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const hamburger = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('sidebar-open');
    if (hamburger) hamburger.classList.toggle('hamburger-open');
    if (overlay) overlay.classList.toggle('sidebar-overlay-visible');
  },

  /**
   * Chiude la sidebar mobile se aperta (usato su navigazione/click overlay).
   */
  closeSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('sidebar-open')) {
      this.toggleSidebar();
    }
  },

  /**
   * Inizializza gli event listener dello shell. Chiamato una volta da app.js.
   */
  init() {
    this.update();

    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      hamburger.addEventListener('click', () => this.toggleSidebar());
    }

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeSidebar());
    }

    // Chiudi il menu mobile al click su un link di navigazione + feedback sonoro leggero
    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-link')) {
        this.closeSidebar();
        if (window.VinylDexSound) window.VinylDexSound.click();
      }
    });

    // Aggiorna username quando l'utente fa login/logout (auth.js, se attivo)
    window.addEventListener('vinyldex:auth:changed', () => this.update());
  },

  /** Helper: imposta il testo di un elemento per id, se esiste. */
  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  /** Helper: imposta la larghezza percentuale di una progress-fill per id. */
  _setWidth(id, percent) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${percent}%`;
  }
};

// Export globale
window.VinylDexShell = VinylDexShell;
