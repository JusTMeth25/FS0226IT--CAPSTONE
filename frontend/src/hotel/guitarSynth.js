/**
 * Chitarre, bassi e batteria sintetizzati con WebAudio, senza file audio.
 *
 * Le corde usano l'algoritmo di Karplus-Strong: un breve rumore che rimbalza in una linea di
 * ritardo lunga quanto il periodo della nota e si smorza a ogni giro, come una corda pizzicata
 * vera. Il timbro cambia con lo strumento: nylon morbido e caldo, acciaio brillante, elettrica
 * pulita o distorta (saturazione e cassa dell'amplificatore simulata con i filtri), basso
 * profondo. Per ogni nota il suono si calcola una volta e poi si riusa.
 *
 * Usato dalla gara rock (rockGame.jsx), dalla prova delle chitarre nel Rock Store e dai brani
 * rock del jukebox (music.js).
 */

export const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);

/** Strumenti: brillantezza del pizzico, quanto dura la corda, catena del suono. */
export const INSTRUMENTS = {
  nylon: { bright: 0.35, decay: 0.9955, seconds: 2.4, chain: 'acoustic', gain: 0.9 },
  steel: { bright: 0.7, decay: 0.9972, seconds: 2.8, chain: 'acoustic', gain: 0.8 },
  clean: { bright: 0.65, decay: 0.9982, seconds: 2.6, chain: 'clean', gain: 0.75 },
  drive: { bright: 0.8, decay: 0.9988, seconds: 2.2, chain: 'drive', gain: 0.55 },
  bass: { bright: 0.45, decay: 0.9975, seconds: 2.4, chain: 'bass', gain: 1.1 }
};

/** Strumento delle chitarre del catalogo (indice "g" del codice aspetto). */
export const GUITAR_SOUND = [null, 'nylon', 'steel', 'drive', 'drive', 'drive', 'drive', 'bass', 'bass', 'drive', 'drive', 'clean'];

const bufferCache = new WeakMap();

function cacheFor(ctx) {
  let map = bufferCache.get(ctx);
  if (!map) {
    map = new Map();
    bufferCache.set(ctx, map);
  }
  return map;
}

/** Suono di una corda (Karplus-Strong) per la nota MIDI e lo strumento dati. */
export function stringBuffer(ctx, midi, kind) {
  const key = `${kind}:${midi}`;
  const cache = cacheFor(ctx);
  const hit = cache.get(key);
  if (hit) return hit;
  const inst = INSTRUMENTS[kind] || INSTRUMENTS.clean;
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * inst.seconds);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(sr / midiToHz(midi)));
  const ring = new Float32Array(period);
  // Pizzico: rumore passato in un passa-basso (piu' chiuso per il nylon e il basso).
  let last = 0;
  for (let i = 0; i < period; i += 1) {
    last += inst.bright * ((Math.random() * 2 - 1) - last);
    ring[i] = last;
  }
  // Posizione del plettro: un po' di pettine sul pizzico toglie le armoniche "a meta' corda".
  const pick = Math.max(1, Math.floor(period * 0.13));
  for (let i = period - 1; i >= pick; i -= 1) ring[i] -= 0.5 * ring[i - pick];
  // Le note acute si spengono prima: la perdita per giro cresce con la frequenza.
  const decay = inst.decay ** (1 + Math.max(0, midi - 52) / 30);
  let at = 0;
  let peak = 0;
  for (let n = 0; n < length; n += 1) {
    const cur = ring[at];
    const next = ring[(at + 1) % period];
    ring[at] = decay * 0.5 * (cur + next);
    out[n] = cur;
    peak = Math.max(peak, Math.abs(cur));
    at = (at + 1) % period;
  }
  const norm = peak > 0 ? 0.9 / peak : 1;
  const fade = Math.floor(sr * 0.05);
  for (let n = 0; n < length; n += 1) {
    out[n] *= norm * (n > length - fade ? (length - n) / fade : 1);
  }
  cache.set(key, buffer);
  return buffer;
}

function distortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function reverbImpulse(ctx, seconds = 1.6) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return impulse;
}

/**
 * Catene del suono (una per strumento) collegate all'uscita: acustica con un po' di riverbero,
 * elettrica pulita, elettrica distorta (saturazione, poi la cassa dell'ampli: taglio dei bassi,
 * medi in evidenza, alti tagliati), basso.
 */
export class GuitarRig {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.chains = {};
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    reverb.connect(wet).connect(destination);
    this.reverb = reverb;

    const acoustic = ctx.createGain();
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 5200;
    acoustic.connect(warm);
    warm.connect(destination);
    warm.connect(reverb);
    this.chains.acoustic = acoustic;

    const clean = ctx.createGain();
    const cleanTone = ctx.createBiquadFilter();
    cleanTone.type = 'lowpass';
    cleanTone.frequency.value = 4200;
    clean.connect(cleanTone);
    cleanTone.connect(destination);
    cleanTone.connect(reverb);
    this.chains.clean = clean;

    const drive = ctx.createGain();
    drive.gain.value = 3.2;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(60);
    shaper.oversample = '4x';
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 90;
    const mids = ctx.createBiquadFilter();
    mids.type = 'peaking';
    mids.frequency.value = 900;
    mids.gain.value = 5;
    const cab = ctx.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = 3600;
    cab.Q.value = 0.8;
    const level = ctx.createGain();
    level.gain.value = 0.18;
    drive.connect(shaper).connect(lowCut).connect(mids).connect(cab).connect(level);
    level.connect(destination);
    level.connect(reverb);
    this.chains.drive = drive;

    const bass = ctx.createGain();
    const bassTone = ctx.createBiquadFilter();
    bassTone.type = 'lowpass';
    bassTone.frequency.value = 1400;
    bass.connect(bassTone).connect(destination);
    this.chains.bass = bass;
  }

  /** Una corda: nota MIDI, quando, quanto forte e per quanto (le stoppate sono corte). */
  pluck(midi, kind, time, { velocity = 1, length = null } = {}) {
    const ctx = this.ctx;
    const inst = INSTRUMENTS[kind] || INSTRUMENTS.clean;
    const source = ctx.createBufferSource();
    source.buffer = stringBuffer(ctx, midi, kind);
    const gain = ctx.createGain();
    gain.gain.value = inst.gain * velocity;
    source.connect(gain).connect(this.chains[inst.chain]);
    source.start(time);
    if (length) {
      gain.gain.setValueAtTime(inst.gain * velocity, time + length);
      gain.gain.exponentialRampToValueAtTime(0.001, time + length + 0.08);
      source.stop(time + length + 0.1);
    }
    return source;
  }

  /** Accordo strimpellato: le corde partono una dopo l'altra, dal basso (o dall'alto se "up"). */
  strum(notes, kind, time, { up = false, spread = 0.012, velocity = 1, length = null } = {}) {
    const order = up ? [...notes].reverse() : notes;
    order.forEach((midi, i) => this.pluck(midi, kind, time + i * spread, { velocity: velocity * (1 - i * 0.04), length }));
  }

  /** Power chord del rock: fondamentale, quinta e ottava, distorto. */
  power(root, time, { length = null, velocity = 1 } = {}) {
    this.strum([root, root + 7, root + 12], 'drive', time, { spread: 0.006, length, velocity });
  }
}

/** Batteria rock: cassa, rullante, charleston e piatto, dal rumore e da oscillatori. */
export class Drums {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(destination);
    const length = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  kick(time, strength = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    gain.gain.setValueAtTime(1.1 * strength, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(gain).connect(this.out);
    osc.start(time);
    osc.stop(time + 0.32);
    this.hit(time, 0.02, 2500, 0.3 * strength, 'lowpass');
  }

  hit(time, duration, freq, volume, type = 'highpass') {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(this.out);
    source.start(time, Math.random() * 0.5);
    source.stop(time + duration + 0.02);
  }

  snare(time, strength = 1) {
    const ctx = this.ctx;
    this.hit(time, 0.22, 1200, 0.7 * strength);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 190;
    gain.gain.setValueAtTime(0.45 * strength, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(gain).connect(this.out);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  hat(time, open = false) {
    this.hit(time, open ? 0.25 : 0.05, 8000, open ? 0.22 : 0.16);
  }

  crash(time) {
    this.hit(time, 1.4, 5000, 0.35);
  }
}
