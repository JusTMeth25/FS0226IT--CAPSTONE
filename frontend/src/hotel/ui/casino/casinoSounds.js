import { soundService } from '../../../services/soundService.js';

/**
 * Suoni del casino, sintetizzati con WebAudio (nessun file da scaricare): fiches puntate, carte
 * distribuite e girate, rulli della slot che girano e si fermano, monete che cadono nel vassoio,
 * pallina della roulette che corre e rimbalza nelle caselle, dadi agitati e lanciati, fanfara
 * delle vincite. Seguono il pulsante dell'audio dell'app (soundService).
 */

let ctx = null;
let master = null;
let noiseBuffer = null;

function audio() {
  if (!soundService.isEnabled()) return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Nota breve con inviluppo: tipo d'onda, frequenza, durata, volume, quando (secondi da ora). */
function tone(freq, { type = 'sine', dur = 0.15, vol = 0.3, at = 0, slide = null, attack = 0.005 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Rumore filtrato (fruscio di carte, rotolio, scuotimento). */
function noise({ dur = 0.08, vol = 0.25, at = 0, freq = 2000, q = 1, type = 'bandpass', sweep = null } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  filter.Q.value = q;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Clic secco di plastica/ceramica: fiche, dado sul panno, pallina sulle caselle. */
function click(at = 0, freq = 3200, vol = 0.35) {
  noise({ dur: 0.03, vol, at, freq, q: 6 });
  tone(freq * 0.45, { type: 'triangle', dur: 0.04, vol: vol * 0.5, at });
}

export const casinoSound = {
  /** Fiche appoggiata sul panno (con la seconda fiche che tintinna sopra). */
  chip() {
    click(0, 3600, 0.3);
    click(0.045, 4200, 0.18);
  },
  /** Pila di fiches spinta al giocatore (vincita) o raccolta dal banco. */
  chipStack(n = 5) {
    for (let i = 0; i < n; i += 1) click(i * 0.05 + Math.random() * 0.02, 3000 + Math.random() * 1500, 0.22);
  },
  /** Carta distribuita che scivola sul panno. */
  deal(at = 0) {
    noise({ dur: 0.12, vol: 0.28, at, freq: 3500, q: 0.8, sweep: 1200 });
    click(at + 0.1, 1800, 0.12);
  },
  /** Carta girata. */
  flip(at = 0) {
    noise({ dur: 0.06, vol: 0.3, at, freq: 5000, q: 1.2 });
    noise({ dur: 0.05, vol: 0.18, at: at + 0.05, freq: 2500, q: 1.2 });
  },
  /** Mazzo mescolato. */
  shuffle() {
    for (let i = 0; i < 14; i += 1) noise({ dur: 0.03, vol: 0.18, at: i * 0.035, freq: 3000 + Math.random() * 2500, q: 2 });
  },

  // ---------------------------------------------------------------- slot
  /** Leva tirata e rulli che partono. Torna una funzione che ferma il ronzio. */
  slotSpin(seconds = 2) {
    tone(140, { type: 'sawtooth', dur: 0.18, vol: 0.12, slide: 70 });
    const ticks = Math.floor(seconds / 0.06);
    for (let i = 0; i < ticks; i += 1) click(0.15 + i * 0.06, 2200 + (i % 3) * 300, 0.07);
  },
  /** Un rullo che si ferma con lo scatto. */
  reelStop(index = 0) {
    click(0, 1600 - index * 150, 0.35);
    tone(220 - index * 20, { type: 'square', dur: 0.06, vol: 0.08 });
  },
  /** Monete che cadono nel vassoio: tante quante il moltiplicatore (fino a 20). */
  coins(multiplier = 1) {
    const n = Math.min(20, Math.max(2, multiplier));
    for (let i = 0; i < n; i += 1) {
      const at = i * 0.07 + Math.random() * 0.03;
      tone(2300 + Math.random() * 900, { type: 'triangle', dur: 0.12, vol: 0.12, at });
      tone(3400 + Math.random() * 600, { type: 'sine', dur: 0.08, vol: 0.08, at: at + 0.01 });
    }
  },
  /** Sirena e luci del jackpot (tris di vinili, sette o bar). */
  jackpot() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'square', dur: 0.14, vol: 0.12, at: i * 0.11 }));
    this.coins(20);
  },

  // ---------------------------------------------------------------- roulette
  /**
   * La pallina lanciata corre sul bordo (fruscio che rallenta), poi rimbalza fra le caselle con
   * clic sempre piu' radi, e si ferma. Dura `seconds`, come l'animazione della ruota.
   */
  rouletteSpin(seconds = 4.2) {
    noise({ dur: seconds * 0.7, vol: 0.12, freq: 1800, q: 0.7, type: 'bandpass', sweep: 500 });
    let t = seconds * 0.55;
    let gap = 0.08;
    while (t < seconds - 0.05) {
      click(t, 2600 + Math.random() * 1200, 0.25);
      t += gap;
      gap *= 1.35;
    }
    click(seconds - 0.05, 2000, 0.3);
  },
  /** Il croupier annuncia: una campanella. */
  bell() {
    tone(1568, { type: 'sine', dur: 0.6, vol: 0.18 });
    tone(2093, { type: 'sine', dur: 0.5, vol: 0.1, at: 0.01 });
  },

  // ---------------------------------------------------------------- dadi
  /** Dadi agitati in mano. */
  diceShake() {
    for (let i = 0; i < 8; i += 1) click(i * 0.045, 2500 + Math.random() * 1500, 0.16);
  },
  /** Dadi lanciati: rotolano sul panno e sbattono sulla sponda. */
  diceRoll() {
    noise({ dur: 0.35, vol: 0.12, freq: 900, q: 0.8, type: 'lowpass' });
    [0.05, 0.13, 0.22, 0.3, 0.4, 0.46].forEach((at) => click(at, 1500 + Math.random() * 1200, 0.28));
    noise({ dur: 0.08, vol: 0.3, at: 0.5, freq: 400, q: 1, type: 'lowpass' });
  },

  // ---------------------------------------------------------------- esiti
  /** Vincita: arpeggio luminoso (piu' lungo per le vincite grosse). */
  win(big = false) {
    const notes = big ? [523, 659, 784, 1047, 1319, 1568] : [659, 784, 1047];
    notes.forEach((f, i) => tone(f, { type: 'triangle', dur: 0.22, vol: 0.18, at: i * 0.09 }));
    this.chipStack(big ? 10 : 5);
  },
  /** Sconfitta: due note che scendono, sottovoce. */
  lose() {
    tone(330, { type: 'sine', dur: 0.25, vol: 0.12 });
    tone(247, { type: 'sine', dur: 0.35, vol: 0.12, at: 0.18 });
  },
  push() {
    tone(523, { type: 'sine', dur: 0.2, vol: 0.12 });
    tone(523, { type: 'sine', dur: 0.2, vol: 0.1, at: 0.16 });
  },
  /** Blackjack! */
  blackjack() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'square', dur: 0.16, vol: 0.12, at: i * 0.08 }));
    this.chipStack(8);
  },
  /** Cassa: il cassetto dei soldi e le fiches contate. */
  register() {
    tone(1200, { type: 'sine', dur: 0.12, vol: 0.18 });
    tone(1800, { type: 'sine', dur: 0.25, vol: 0.14, at: 0.08 });
    this.chipStack(6);
  }
};

/** Suono dell'esito di un giro, dalla differenza fra quanto torna e quanto si e' puntato. */
export function outcomeSound(res) {
  if (!res) return;
  if (res.net > 0) casinoSound.win(res.returned >= res.staked * 10);
  else if (res.net === 0) casinoSound.push();
  else casinoSound.lose();
}
