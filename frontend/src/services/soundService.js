/**
 * Effetti sonori (mp3 in public/assets/audio/) mappati alle azioni dell'app.
 * Lo stato "enabled" è persistito in localStorage e notificato via subscribe()
 * così i componenti React (topbar) possono sincronizzare l'icona.
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

  _play(fileKey, { volume = 0.5, delay = 0, maxDuration = null } = {}) {
    if (!this._enabled) return;
    const src = FILES[fileKey];
    if (!src) return;

    const run = () => {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.play().catch(() => {});
      if (maxDuration) this._scheduleFadeOut(audio, volume, maxDuration);
    };

    if (delay > 0) setTimeout(run, delay);
    else run();
  }

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
  }

  click() { this._play('click', { volume: 0.3 }); }
  packOpen() {
    this._play('packOpenWhoosh', { volume: 0.45 });
    this._play('packOpenPop', { volume: 0.4, delay: 280 });
  }
  cardReveal(rarity) {
    if (rarity === 'legendary') this._play('cardLegendary', { volume: 0.6, maxDuration: 450 });
    else this._play('cardReveal', { volume: 0.45, maxDuration: 300 });
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
