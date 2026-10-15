/**
 * Effetti sonori (mp3 in public/assets/audio/) mappati alle azioni dell'app.
 * Lo stato "enabled" è persistito in localStorage e notificato via subscribe()
 * così i componenti React (topbar) possono sincronizzare l'icona.
 *
 * Si suonano con la Web Audio API: i file si scaricano e si decodificano una volta sola, partono
 * senza ritardo e il volume (con le dissolvenze) funziona anche su iPhone, dove Safari ignora
 * audio.volume e un new Audio() parte in ritardo. Il contesto audio si sblocca al primo tocco,
 * come vuole iOS. Senza Web Audio si ripiega su new Audio(), senza tagliare i suoni.
 */

const STORAGE_KEY = 'vinyldex_sound_enabled';

const FILES = {
  click: '/assets/audio/click.mp3',
  packOpenWhoosh: '/assets/audio/pack-open-whoosh.mp3',
  packOpenPop: '/assets/audio/pack-open-pop.mp3',
  cardReveal: '/assets/audio/card-reveal.mp3',
  cardLegendary: '/assets/audio/card-legendary.mp3',
  coin: '/assets/audio/coin.mp3',
  reward: '/assets/audio/reward.mp3',
  levelUp: '/assets/audio/level-up.mp3',
  roundWin: '/assets/audio/round-win.mp3',
  roundLose: '/assets/audio/round-lose.mp3',
  draw: '/assets/audio/draw.mp3',
  battleWin: '/assets/audio/battle-win.mp3',
  battleLose: '/assets/audio/battle-lose.mp3',
  success: '/assets/audio/success.mp3',
  error: '/assets/audio/error.mp3'
};

/** Dissolvenza quando una carta nuova interrompe il suono della precedente (secondi). */
const HANDOVER_FADE = 0.12;

function readEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

class SoundService {
  constructor() {
    this._enabled = readEnabled();
    this._listeners = new Set();
    this._ctx = null;
    this._buffers = new Map();
    this._loading = null;
    this._reveal = null;
    this._installUnlock();
  }

  isEnabled() {
    return this._enabled;
  }

  setEnabled(value) {
    this._enabled = !!value;
    try { localStorage.setItem(STORAGE_KEY, String(this._enabled)); } catch { /* ignore */ }
    this._listeners.forEach((cb) => cb(this._enabled));
  }

  toggle() {
    this.setEnabled(!this._enabled);
    if (this._enabled) this.click();
  }

  subscribe(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  // ------------------------------------------------------------------ Web Audio

  /** iOS fa partire l'audio solo dentro un gesto: al primo tocco si crea il contesto e si caricano i suoni. */
  _installUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const ctx = this._context();
      if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      // Un buffer muto suonato nel gesto sblocca davvero l'uscita su Safari.
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      } catch { /* ignore */ }
      this._preload();
      this._unlockSpeech();
    };
    ['pointerdown', 'touchend', 'keydown'].forEach((type) => window.addEventListener(type, unlock, { passive: true }));
  }

  /**
   * Safari su iPhone fa parlare la sintesi vocale (banditore del bingo) solo se la prima frase
   * parte dentro un gesto: al primo tocco si dice una frase muta, poi le palline si sentono.
   */
  _unlockSpeech() {
    if (this._speechUnlocked || typeof window === 'undefined' || !window.speechSynthesis) return;
    this._speechUnlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'it-IT';
      window.speechSynthesis.speak(u);
      // Le voci su iOS arrivano dopo: chiederle subito le fa caricare.
      window.speechSynthesis.getVoices();
    } catch { /* sintesi vocale non disponibile */ }
  }

  _context() {
    if (this._ctx) return this._ctx;
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return null;
    try {
      this._ctx = new Ctx();
    } catch {
      this._ctx = null;
    }
    return this._ctx;
  }

  _preload() {
    if (this._loading || !this._ctx) return this._loading;
    const ctx = this._ctx;
    this._loading = Promise.all(Object.entries(FILES).map(async ([key, src]) => {
      try {
        const data = await (await fetch(src)).arrayBuffer();
        const buffer = await new Promise((ok, ko) => {
          const p = ctx.decodeAudioData(data, ok, ko);
          if (p && typeof p.then === 'function') p.then(ok, ko);
        });
        this._buffers.set(key, buffer);
      } catch { /* quel suono restera' su new Audio() */ }
    }));
    return this._loading;
  }

  /**
   * Suona un effetto. Con `maxDuration` (ms) dopo quel tempo parte una dissolvenza di `fade` ms:
   * niente tagli netti. Restituisce un controllo { stop(fadeSeconds) } se suonato con Web Audio.
   */
  _play(fileKey, { volume = 0.5, delay = 0, maxDuration = null, fade = 350 } = {}) {
    if (!this._enabled) return null;
    const ctx = this._ctx;
    const buffer = this._buffers.get(fileKey);
    if (ctx && buffer && ctx.state === 'running') {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + delay / 1000;
      gain.gain.setValueAtTime(volume, start);
      let end = start + buffer.duration;
      if (maxDuration) {
        const fadeAt = start + maxDuration / 1000;
        if (fadeAt < end) {
          gain.gain.setValueAtTime(volume, fadeAt);
          gain.gain.linearRampToValueAtTime(0.0001, fadeAt + fade / 1000);
          end = Math.min(end, fadeAt + fade / 1000 + 0.02);
        }
      }
      source.start(start);
      source.stop(end);
      return {
        stop: (fadeSeconds = HANDOVER_FADE) => {
          const now = ctx.currentTime;
          if (now >= end) return;
          try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
            source.stop(now + fadeSeconds + 0.02);
          } catch { /* gia' fermo */ }
        }
      };
    }
    // Ripiego: senza Web Audio (o prima del primo tocco) il suono parte intero, senza tagli.
    const src = FILES[fileKey];
    if (!src) return null;
    const run = () => {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.play().catch(() => {});
    };
    if (delay > 0) setTimeout(run, delay);
    else run();
    return null;
  }

  click() { this._play('click', { volume: 0.3 }); }
  packOpen() {
    this._play('packOpenWhoosh', { volume: 0.45 });
    this._play('packOpenPop', { volume: 0.4, delay: 280 });
  }
  /**
   * Una carta che si scopre: il suono va fino in fondo (circa un secondo e mezzo) e, se intanto si
   * scopre la carta dopo, quello della precedente sfuma in un attimo invece di accavallarsi.
   */
  cardReveal(rarity) {
    this._reveal?.stop();
    this._reveal = rarity === 'legendary'
      ? this._play('cardLegendary', { volume: 0.6, maxDuration: 1300, fade: 400 })
      : this._play('cardReveal', { volume: 0.45, maxDuration: 1100, fade: 450 });
  }
  coin() { this._play('coin', { volume: 0.5 }); }
  reward() { this._play('reward', { volume: 0.5 }); }
  levelUp() { this._play('levelUp', { volume: 0.55 }); }
  roundWin() { this._play('roundWin', { volume: 0.5 }); }
  roundLose() { this._play('roundLose', { volume: 0.45 }); }
  roundDraw() { this._play('draw', { volume: 0.4 }); }
  battleWin() { this._play('battleWin', { volume: 0.55 }); }
  battleLose() { this._play('battleLose', { volume: 0.5 }); }
  battleDraw() { this._play('draw', { volume: 0.4 }); }
  success() { this._play('success', { volume: 0.5 }); }
  error() { this._play('error', { volume: 0.45 }); }
}

export const soundService = new SoundService();
