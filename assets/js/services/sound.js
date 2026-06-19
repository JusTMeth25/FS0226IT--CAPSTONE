/**
 * VinylDex - Sound Service
 *
 * Effetti sonori reali (file mp3 in assets/audio/, sorgente: libreria gratuita
 * Mixkit, licenza libera senza attribuzione) mappati alle azioni dell'app:
 * apertura pacchetti, rivelazione carte (per rarità), ricompense missioni/
 * livelli, battaglie PvP, login/registrazione.
 *
 * Lo stato di attivazione (mute) è persistito in storage e rispettato da
 * ogni metodo: se disattivato, tutte le chiamate diventano no-op.
 */
const VinylDexSound = {
  _enabled: true,
  _loaded: false,

  /** Percorsi dei file audio (relativi a index.html), per nome effetto. */
  FILES: {
    click: 'assets/audio/click.mp3',
    packOpenWhoosh: 'assets/audio/pack-open-whoosh.mp3',
    packOpenPop: 'assets/audio/pack-open-pop.mp3',
    cardReveal: 'assets/audio/card-reveal.mp3',
    cardLegendary: 'assets/audio/card-legendary.mp3',
    coin: 'assets/audio/coin.mp3',
    reward: 'assets/audio/reward.mp3',
    levelUp: 'assets/audio/level-up.mp3',
    roundWin: 'assets/audio/round-win.mp3',
    roundLose: 'assets/audio/round-lose.mp3',
    draw: 'assets/audio/draw.mp3',
    battleWin: 'assets/audio/battle-win.mp3',
    battleLose: 'assets/audio/battle-lose.mp3',
    success: 'assets/audio/success.mp3',
    error: 'assets/audio/error.mp3'
  },

  _ensureLoaded() {
    if (this._loaded) return;
    const storage = new window.VinylDexStorage();
    this._enabled = storage.get('soundEnabled', true);
    this._loaded = true;
  },

  isEnabled() {
    this._ensureLoaded();
    return this._enabled;
  },

  setEnabled(value) {
    this._ensureLoaded();
    this._enabled = !!value;
    new window.VinylDexStorage().set('soundEnabled', this._enabled);
    this._updateToggleButton();
  },

  toggle() {
    this.setEnabled(!this.isEnabled());
    if (this.isEnabled()) this.click();
  },

  /** Sincronizza l'icona del bottone mute nella topbar con lo stato corrente. */
  _updateToggleButton() {
    const btn = document.getElementById('sound-toggle-btn');
    if (!btn) return;
    btn.innerHTML = this.isEnabled()
      ? '<i class="ph-fill ph-speaker-high"></i>'
      : '<i class="ph-fill ph-speaker-slash"></i>';
    btn.title = this.isEnabled() ? 'Disattiva audio' : 'Attiva audio';
  },

  /**
   * Riproduce un file audio. Crea una nuova istanza Audio ad ogni chiamata
   * (invece di riusarne una condivisa) per permettere a più effetti di
   * sovrapporsi senza tagliarsi a vicenda (es. carte rivelate in sequenza rapida:
   * la stessa ding che si accavalla leggermente con sé stessa è naturale).
   *
   * `maxDuration` (ms) tronca la coda lunga dei file mp3 (pensati per essere
   * ascoltati per intero) con un breve dissolvimento, così un suono non resta
   * udibile fin dentro la carta successiva.
   */
  _play(fileKey, { volume = 0.5, delay = 0, maxDuration = null } = {}) {
    if (!this.isEnabled()) return;
    const src = this.FILES[fileKey];
    if (!src) return;

    const run = () => {
      const audio = new Audio(src);
      audio.volume = volume;
      // L'autoplay può essere bloccato dal browser se non c'è ancora stata
      // un'interazione utente: ignoriamo silenziosamente il rifiuto.
      audio.play().catch(() => {});
      if (maxDuration) this._scheduleFadeOut(audio, volume, maxDuration);
    };

    if (delay > 0) setTimeout(run, delay);
    else run();
  },

  /** Dissolve rapidamente il volume e interrompe la riproduzione dopo `afterMs`. */
  _scheduleFadeOut(audio, startVolume, afterMs) {
    const fadeSteps = 5;
    const fadeStepMs = 12;
    setTimeout(() => {
      let step = 0;
      const fade = () => {
        step++;
        audio.volume = Math.max(0, startVolume * (1 - step / fadeSteps));
        if (step < fadeSteps) setTimeout(fade, fadeStepMs);
        else audio.pause();
      };
      fade();
    }, afterMs);
  },

  // ===== EFFETTI SPECIFICI (mappati alle azioni dell'app) =====

  /** Click leggero per navigazione/toggle. */
  click() {
    this._play('click', { volume: 0.3 });
  },

  /** Apertura scatola pacchetto: fruscio + "pop" della carta che scatta fuori. */
  packOpen() {
    this._play('packOpenWhoosh', { volume: 0.45 });
    this._play('packOpenPop', { volume: 0.4, delay: 280 });
  },

  /**
   * Rivelazione carta: stessa ding per tutte le rarità normali, suono speciale
   * per le leggendarie. Troncata a una durata inferiore al ritmo di rivelazione
   * (una carta ogni 500ms) per evitare che resti udibile sopra la carta dopo.
   */
  cardReveal(rarity) {
    if (rarity === 'legendary') {
      this._play('cardLegendary', { volume: 0.6, maxDuration: 450 });
    } else {
      this._play('cardReveal', { volume: 0.45, maxDuration: 300 });
    }
  },

  /** Guadagno gold. */
  coin() {
    this._play('coin', { volume: 0.5 });
  },

  /** Ricompensa generica reclamata (missioni, login giornaliero, milestone collezione). */
  reward() {
    this._play('reward', { volume: 0.5 });
  },

  /** Salita di livello / ricompensa di livello reclamata. */
  levelUp() {
    this._play('levelUp', { volume: 0.55 });
  },

  /** Esito di un round di battaglia. */
  roundWin() {
    this._play('roundWin', { volume: 0.5 });
  },
  roundLose() {
    this._play('roundLose', { volume: 0.45 });
  },
  roundDraw() {
    this._play('draw', { volume: 0.4 });
  },

  /** Esito finale di una manche/torneo. */
  battleWin() {
    this._play('battleWin', { volume: 0.55 });
  },
  battleLose() {
    this._play('battleLose', { volume: 0.5 });
  },
  battleDraw() {
    this._play('draw', { volume: 0.4 });
  },

  /** Login/registrazione riuscita. */
  success() {
    this._play('success', { volume: 0.5 });
  },

  /** Errore generico (credenziali errate, gold insufficienti, campi mancanti, ecc). */
  error() {
    this._play('error', { volume: 0.45 });
  }
};

// Export globale
window.VinylDexSound = VinylDexSound;
