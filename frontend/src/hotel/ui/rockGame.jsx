import { Drums, GuitarRig } from '../guitarSynth.js';
import { DIFFICULTIES, DRUMS, LANE_STEPS, SONGS, buildChart, multOf, perfectScore } from './rockSongs.js';
import RockView from './RockView.jsx';

/**
 * Gara rock in stile Guitar Hero.
 *
 * Si sceglie la canzone e la difficolta'; le note arrivano lungo la tastiera in prospettiva e si
 * premono i tasti colorati (A S D F G, o 1-5) quando toccano la linea in fondo. Accordi (due tasti
 * insieme), note lunghe da tenere, serie di note che fanno salire il moltiplicatore fino a 4x,
 * frasi stella che caricano lo star power (SPAZIO: punti doppi), e la barra del pubblico: se
 * scende a zero la canzone finisce tra i fischi.
 *
 * L'audio e' sincronizzato con il gioco: il tempo della canzone viene dall'orologio audio. La
 * chitarra suona solo finche' si prendono le note: sbagliando si spegne, come nel gioco vero.
 * Al server va un voto da 0 a 1000: la percentuale del punteggio perfetto (senza star power).
 */

const COUNT_IN_BARS = 1;
const LOOKAHEAD = 0.15;

// ------------------------------------------------------------------ audio della canzone

class RockAudio {
  constructor(song, full) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.song = song;
    this.full = full;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.guitarBus = this.ctx.createGain();
    this.guitarBus.connect(this.master);
    this.rig = new GuitarRig(this.ctx, this.guitarBus);
    this.backing = this.ctx.createGain();
    this.backing.gain.value = 0.8;
    this.backing.connect(this.master);
    this.bassRig = new GuitarRig(this.ctx, this.backing);
    this.drums = new Drums(this.ctx, this.backing);
    this.stepDur = 60 / song.bpm / 4;
    this.songStart = this.ctx.currentTime + 0.3 + COUNT_IN_BARS * 16 * this.stepDur;
    this.nextStep = -COUNT_IN_BARS * 16;
    this.byStep = new Map();
    full.notes.forEach((note) => this.byStep.set(note.bar * 16 + note.step, note));
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  /** Millisecondi dall'inizio della canzone (negativi durante il conteggio). */
  songTime() {
    return (this.ctx.currentTime - this.songStart) * 1000;
  }

  schedule() {
    const { ctx } = this;
    const last = this.full.bars.length * 16;
    while (this.nextStep < last && this.songStart + this.nextStep * this.stepDur < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.nextStep, this.songStart + this.nextStep * this.stepDur);
      this.nextStep += 1;
    }
  }

  playStep(k, time) {
    if (k < 0) {
      // Conteggio: quattro colpi sulle bacchette.
      if ((k + 16) % 4 === 0) this.drums.hit(time, 0.05, 3000, 0.4);
      return;
    }
    const bar = this.full.bars[Math.floor(k / 16)];
    const i = k % 16;
    const d = DRUMS[bar.drums] || DRUMS.rock;
    if (i === 0 && bar.first) this.drums.crash(time);
    if (d.kick[i] === 'x') this.drums.kick(time);
    if (d.snare[i] === 'x') this.drums.snare(time);
    if (d.hat[i] === 'x') this.drums.hat(time);
    if (d.hat[i] === 'o') this.drums.hat(time, true);
    // Basso sugli ottavi, sulla fondamentale della battuta.
    if (i % 2 === 0) this.bassRig.pluck(bar.root - 12 + (bar.root < 42 ? 12 : 0), 'bass', time, { length: this.stepDur * 1.8, velocity: 0.8 });
    const note = this.byStep.get(k);
    if (!note) return;
    const length = note.sustain ? note.sustain / 1000 : this.stepDur * 1.6;
    if (note.tone === 'clean') {
      note.lanes.forEach((lane) => this.rig.pluck(note.root + 12 + LANE_STEPS[lane], 'clean', time, { length: Math.max(length, 0.6) }));
    } else {
      const low = Math.min(...note.lanes);
      this.rig.power(note.root + LANE_STEPS[low], time, { length });
      if (note.lanes.length > 1) this.rig.pluck(note.root + 12 + LANE_STEPS[Math.max(...note.lanes)], 'drive', time, { length, velocity: 0.7 });
    }
  }

  /** Chitarra accesa (si prendono le note) o spenta (errore): come nel gioco vero. */
  setGuitar(on) {
    const g = this.guitarBus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(on ? 1 : 0.04, now, on ? 0.01 : 0.03);
  }

  /** Corda stoppata: il rumore di un errore. */
  clunk() {
    this.drums.hit(this.ctx.currentTime, 0.09, 400, 0.5, 'lowpass');
  }

  stop() {
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, now, 0.15);
    setTimeout(() => this.ctx.close().catch(() => {}), 800);
  }
}

// ------------------------------------------------------------------ regole

function popup(s, text, color = '#fde047') {
  s.popups = [...s.popups.filter((p) => s.t - p.at < 1500), { text, color, at: s.t }];
}

function startSong(s) {
  const song = SONGS[s.song];
  const diff = DIFFICULTIES[s.diff];
  const built = buildChart(song, diff);
  s.chart = built.chart;
  s.length = built.length;
  s.beat = 60000 / song.bpm;
  s.perfect = perfectScore(built.chart, song);
  // Ultima nota di ogni frase stella: prendendo tutta la frase si carica lo star power.
  s.phraseLast = new Map();
  s.chart.forEach((note) => { if (note.star) s.phraseLast.set(note.phrase, note.id); });
  s.phraseFailed = new Set();
  s.audio = new RockAudio(song, built);
  s.phase = 'play';
  s.t = s.audio.songTime();
}

function hitNote(s, note, pulse) {
  note.hit = true;
  s.streak += 1;
  s.best = Math.max(s.best, s.streak);
  s.hits += 1;
  const mult = multOf(s.streak) * (s.starOn ? 2 : 1);
  s.points += 50 * note.lanes.length * mult;
  s.rock = Math.min(1, s.rock + 0.03);
  note.lanes.forEach((lane) => { s.flash[lane] = s.t; });
  s.audio.setGuitar(true);
  if (note.sustain) s.sustaining.push({ note, until: note.time + note.sustain });
  if (s.streak > 0 && s.streak % 50 === 0) popup(s, `${s.streak} NOTE DI FILA!`);
  if (multOf(s.streak) !== multOf(s.streak - 1)) popup(s, `MOLTIPLICATORE x${multOf(s.streak)}`, '#22d3ee');
  if (note.star && s.phraseLast.get(note.phrase) === note.id && !s.phraseFailed.has(note.phrase)) {
    s.star = Math.min(1, s.star + 0.25);
    popup(s, s.star >= 0.5 && !s.starOn ? 'STAR POWER PRONTO! (SPAZIO)' : 'FRASE STELLA!', '#93c5fd');
  }
  pulse();
}

function missNote(s, note) {
  note.missed = true;
  s.misses += 1;
  s.streak = 0;
  // Il pubblico perdona di piu' alle difficolta' basse.
  s.rock = Math.max(0, s.rock - [0.03, 0.04, 0.05][s.diff]);
  if (note.star) s.phraseFailed.add(note.phrase);
  s.audio.setGuitar(false);
}

function endSong(s, failed) {
  s.phase = 'results';
  s.failed = failed;
  s.audio?.stop();
  s.sustaining = [];
}

export const rock = {
  help: 'Scegli la canzone. Premi A S D F G (o 1-5) quando le note toccano la linea; tieni premuto sulle note lunghe; SPAZIO per lo star power.',
  duration: 0,
  ownStart: true,
  wide: true,
  keys: {
    a: 0, A: 0, 1: 0, s: 1, S: 1, 2: 1, d: 2, D: 2, 3: 2, f: 3, F: 3, 4: 3, g: 4, G: 4, 5: 4, ' ': 'star', Enter: 'star'
  },
  buttons: [[0, 'Verde', null], [1, 'Rosso', null], [2, 'Giallo', null], [3, 'Blu', null], [4, 'Arancio', null], ['star', 'Star', 'ph-star']],
  init: () => ({
    phase: 'select', song: 0, diff: 1, t: 0, chart: [], points: 0, streak: 0, best: 0, hits: 0, misses: 0, rock: 0.65,
    star: 0, starOn: false, held: [false, false, false, false, false], flash: [-9999, -9999, -9999, -9999, -9999],
    sustaining: [], popups: [], failed: false, finished: false, audio: null, perfect: 1, length: 1, beat: 500
  }),
  tick(s, dt) {
    if (s.phase !== 'play' || !s.audio) return;
    s.t = s.audio.songTime();
    const diff = DIFFICULTIES[s.diff];
    s.chart.forEach((note) => {
      if (!note.hit && !note.missed && s.t - note.time > diff.window) missNote(s, note);
    });
    // Note lunghe: finche' si tengono premuti i tasti giusti si prendono punti.
    s.sustaining = s.sustaining.filter((sus) => {
      const holding = sus.note.lanes.every((lane) => s.held[lane]);
      if (!holding || s.t > sus.until) return false;
      s.points += (dt / s.beat) * 25 * multOf(s.streak) * (s.starOn ? 2 : 1);
      return true;
    });
    if (s.starOn) {
      s.star -= dt / (s.beat * 32);
      if (s.star <= 0) {
        s.star = 0;
        s.starOn = false;
      }
    }
    if (s.rock <= 0) endSong(s, true);
    else if (s.t > s.length + 1200) endSong(s, false);
  },
  press(s, action, pulse) {
    if (s.phase === 'select') {
      if (typeof action === 'string' && action.startsWith('song:')) s.song = Number(action.slice(5));
      else if (typeof action === 'string' && action.startsWith('diff:')) s.diff = Number(action.slice(5));
      else if (action === 'go') startSong(s);
      return;
    }
    if (s.phase === 'results') {
      if (action === 'finish') s.finished = true;
      return;
    }
    if (action === 'star') {
      if (!s.starOn && s.star >= 0.5) {
        s.starOn = true;
        popup(s, 'STAR POWER!', '#93c5fd');
      }
      return;
    }
    if (typeof action !== 'number') return;
    s.held[action] = true;
    const diff = DIFFICULTIES[s.diff];
    const candidates = s.chart.filter((n) => !n.hit && !n.missed && n.lanes.includes(action) && Math.abs(n.time - s.t) <= diff.window);
    if (!candidates.length) {
      // Tasto a vuoto: la serie si spezza.
      if (s.streak >= 5) popup(s, 'SERIE PERSA', '#f87171');
      s.streak = 0;
      s.audio?.clunk();
      return;
    }
    const note = candidates.reduce((a, b) => (Math.abs(a.time - s.t) <= Math.abs(b.time - s.t) ? a : b));
    // Accordo: servono tutti i tasti premuti insieme.
    if (note.lanes.every((lane) => s.held[lane])) hitNote(s, note, pulse);
  },
  release(s, action) {
    if (typeof action === 'number') s.held[action] = false;
  },
  score: (s) => {
    const ratio = s.points / s.perfect;
    return Math.max(0, Math.min(1000, Math.round(ratio * 1000 * (s.failed ? 0.5 : 1))));
  },
  done: (s) => s.finished,
  view: (s, act) => <RockView s={s} act={act} grade={rock.score(s)} />
};
