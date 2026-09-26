import { soundService } from '../services/soundService.js';

/**
 * Effetti sonori dell'hotel generati con WebAudio: calcio al pallone, rete, canestro, ferro,
 * boccia e birilli, bilie, golf, pugni, pesca, karaoke, kart, applausi. Nessun file da scaricare.
 *
 * Ogni suono ha un volume (0-1) che il motore abbassa con la distanza da chi ascolta: quello
 * che succede dall'altra parte della stanza si sente appena. Rispetta l'interruttore dei suoni
 * del sito (soundService).
 */

let context = null;

function audio() {
  if (!soundService.isEnabled()) return null;
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

/** Colpo breve di rumore filtrato: impatti, schiocchi, spruzzi. */
function noise(ctx, { at = 0, duration = 0.12, volume = 0.3, freq = 1200, q = 1, type = 'bandpass', decay = true }) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (decay ? 1 - i / length : 1);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(ctx.currentTime + at);
}

/** Nota con inviluppo: campanelli, clacson, voci del karaoke. */
function tone(ctx, { at = 0, duration = 0.2, volume = 0.2, freq = 440, to = null, type = 'sine' }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const start = ctx.currentTime + at;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const SOUNDS = {
  kick: (ctx, v) => { tone(ctx, { duration: 0.12, volume: 0.45 * v, freq: 160, to: 60 }); noise(ctx, { duration: 0.05, volume: 0.2 * v, freq: 900 }); },
  goal: (ctx, v) => {
    // Tromba da stadio e il boato del pubblico.
    [0, 0.25, 0.5].forEach((at) => tone(ctx, { at, duration: 0.22, volume: 0.18 * v, freq: 523, type: 'sawtooth' }));
    tone(ctx, { at: 0.75, duration: 0.6, volume: 0.2 * v, freq: 659, type: 'sawtooth' });
    noise(ctx, { duration: 1.8, volume: 0.25 * v, freq: 700, q: 0.4, decay: true });
  },
  cheer: (ctx, v) => noise(ctx, { duration: 1.4, volume: 0.22 * v, freq: 800, q: 0.5 }),
  bounce: (ctx, v) => tone(ctx, { duration: 0.09, volume: 0.35 * v, freq: 110, to: 70 }),
  swish: (ctx, v) => noise(ctx, { duration: 0.35, volume: 0.25 * v, freq: 3500, q: 0.7, type: 'highpass' }),
  rim: (ctx, v) => { tone(ctx, { duration: 0.35, volume: 0.2 * v, freq: 880, type: 'triangle' }); tone(ctx, { duration: 0.3, volume: 0.1 * v, freq: 1320, type: 'triangle' }); },
  roll: (ctx, v) => noise(ctx, { duration: 1.0, volume: 0.25 * v, freq: 180, q: 0.8, type: 'lowpass', decay: false }),
  pins: (ctx, v) => {
    noise(ctx, { duration: 0.5, volume: 0.35 * v, freq: 2400, q: 0.6 });
    [0, 0.05, 0.11, 0.19].forEach((at) => tone(ctx, { at, duration: 0.08, volume: 0.12 * v, freq: 1200 + at * 3000, type: 'triangle' }));
  },
  clack: (ctx, v) => { noise(ctx, { duration: 0.04, volume: 0.35 * v, freq: 3000, q: 2 }); tone(ctx, { duration: 0.05, volume: 0.15 * v, freq: 2200 }); },
  putt: (ctx, v) => tone(ctx, { duration: 0.06, volume: 0.3 * v, freq: 1500, type: 'triangle' }),
  cup: (ctx, v) => { tone(ctx, { duration: 0.12, volume: 0.25 * v, freq: 600, to: 300 }); tone(ctx, { at: 0.15, duration: 0.3, volume: 0.15 * v, freq: 1046, type: 'triangle' }); },
  punch: (ctx, v) => { tone(ctx, { duration: 0.1, volume: 0.45 * v, freq: 90, to: 45 }); noise(ctx, { duration: 0.08, volume: 0.25 * v, freq: 500 }); },
  lift: (ctx, v) => tone(ctx, { duration: 0.15, volume: 0.12 * v, freq: 220, to: 180, type: 'triangle' }),
  clink: (ctx, v) => tone(ctx, { duration: 0.2, volume: 0.15 * v, freq: 1800, type: 'triangle' }),
  splash: (ctx, v) => noise(ctx, { duration: 0.5, volume: 0.3 * v, freq: 1400, q: 0.5 }),
  reel: (ctx, v) => [0, 0.06, 0.12, 0.18, 0.24].forEach((at) => noise(ctx, { at, duration: 0.03, volume: 0.15 * v, freq: 4000, q: 3 })),
  note: (ctx, v, pitch = 0) => tone(ctx, { duration: 0.25, volume: 0.15 * v, freq: 440 * 2 ** (pitch / 12), type: 'square' }),
  engine: (ctx, v) => tone(ctx, { duration: 0.35, volume: 0.1 * v, freq: 90, to: 140, type: 'sawtooth' }),
  whistle: (ctx, v) => { tone(ctx, { duration: 0.25, volume: 0.2 * v, freq: 2600 }); tone(ctx, { at: 0.3, duration: 0.5, volume: 0.2 * v, freq: 2600 }); },
  gavel: (ctx, v) => [0, 0.18, 0.36].forEach((at) => { tone(ctx, { at, duration: 0.08, volume: 0.35 * v, freq: 200, to: 90 }); noise(ctx, { at, duration: 0.05, volume: 0.2 * v, freq: 1500 }); }),
  bark: (ctx, v) => { tone(ctx, { duration: 0.08, volume: 0.25 * v, freq: 520, to: 300, type: 'sawtooth' }); tone(ctx, { at: 0.12, duration: 0.08, volume: 0.25 * v, freq: 560, to: 320, type: 'sawtooth' }); },
  meow: (ctx, v) => tone(ctx, { duration: 0.45, volume: 0.18 * v, freq: 700, to: 950, type: 'triangle' })
};

/** Suona un effetto. `volume` 0-1 (gia' abbassato con la distanza); `extra` per le note del karaoke. */
export function playSfx(name, volume = 1, extra) {
  const ctx = audio();
  const sound = SOUNDS[name];
  if (!ctx || !sound || volume <= 0.02) return;
  try {
    sound(ctx, Math.min(1, volume), extra);
  } catch {
    // Audio non disponibile (browser senza WebAudio o contesto chiuso): si resta in silenzio.
  }
}

/** Volume per la distanza in caselle: vicino pieno, dall'altra parte della stanza appena udibile. */
export function volumeAt(distance) {
  return Math.max(0.12, 1 - distance / 22);
}
