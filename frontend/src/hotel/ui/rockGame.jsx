import { Drums, GUITAR_SOUND, GuitarRig, midiToHz } from '../guitarSynth.js';
import { DIFFICULTIES, DRUMS, DRUM_COLORS, LANE_COLORS, SCALES, SONGS, buildChart, buildDrumChart, multOf, perfectScore } from './rockSongs.js';
import RockView from './RockView.jsx';

/**
 * Gara rock in stile Guitar Hero, con la chitarra (pedana della gara rock) o con la batteria
 * (pedana della gara di batteria, come Rock Band).
 *
 * Si sceglie la canzone e la difficolta'; le note arrivano lungo la tastiera in prospettiva e si
 * premono i tasti colorati (A S D F G, o 1-5) quando toccano la linea in fondo. Accordi (piu' tasti
 * insieme), note lunghe da tenere, serie di note che fanno salire il moltiplicatore fino a 4x,
 * frasi stella che caricano lo star power (SPAZIO: punti doppi), e la barra del pubblico: se
 * scende a zero la canzone finisce tra i fischi.
 *
 * L'audio e' sincronizzato con il gioco: il tempo della canzone viene dall'orologio audio. Lo
 * strumento di chi gioca suona solo finche' si prendono le note, come nel gioco vero. Con la
 * chitarra a tracolla (comprata al Rock Store) si suona con il suo suono: classica, acustica,
 * elettrica o basso. Al server va un voto da 0 a 1000 (percentuale del punteggio perfetto) con
 * canzone e difficolta', per la classifica della canzone; ogni secondo il voto parziale va alla
 * stanza, cosi' chi guarda (e lo sfidante sull'altra pedana) lo vede sopra la testa.
 */

const COUNT_IN_BARS = 1;
const LOOKAHEAD = 0.15;

// ------------------------------------------------------------------ audio della canzone

class RockAudio {
  constructor(song, full, { instrument, guitarKind }) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.song = song;
    this.full = full;
    this.instrument = instrument;
    this.guitarKind = guitarKind;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    // La parte di chi gioca (chitarra o batteria) passa da "player": si spegne sbagliando.
    this.player = this.ctx.createGain();
    this.player.connect(this.master);
    this.backing = this.ctx.createGain();
    this.backing.gain.value = 0.8;
    this.backing.connect(this.master);
    const drumsBus = instrument === 'drums' ? this.player : this.backing;
    const guitarBus = instrument === 'drums' ? this.backing : this.player;
    this.rig = new GuitarRig(this.ctx, guitarBus);
    this.bassRig = new GuitarRig(this.ctx, this.backing);
    this.drums = new Drums(this.ctx, drumsBus);
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
    // Batteria di accompagnamento solo quando si suona la chitarra: la batteria la suona chi gioca.
    if (this.instrument !== 'drums') {
      const d = DRUMS[bar.drums] || DRUMS.rock;
      if (i === 0 && bar.first) this.drums.crash(time);
      if (d.kick[i] === 'x') this.drums.kick(time);
      if (d.snare[i] === 'x') this.drums.snare(time);
      if (d.hat[i] === 'x') this.drums.hat(time);
      if (d.hat[i] === 'o') this.drums.hat(time, true);
    }
    // Basso sugli ottavi, sulla fondamentale della battuta.
    if (i % 2 === 0) this.bassRig.pluck(bar.root - 12 + (bar.root < 42 ? 12 : 0), 'bass', time, { length: this.stepDur * 1.8, velocity: 0.8 });
    // Tastiere: tappeto di synth su tutta la battuta, o il pianoforte a tempo con la chitarra.
    const note = this.byStep.get(k);
    if (bar.keys === 'synth' && i === 0) this.keys(bar, time, this.stepDur * 16, 'synth');
    if (bar.keys === 'piano' && (note || i % 4 === 0) && !(note?.lead)) this.keys(bar, time, this.stepDur * (note ? 3 : 2), 'piano');
    if (note) this.playGuitar(note, time);
  }

  /** Accordo delle tastiere (triade maggiore o minore secondo la scala della sezione). */
  keys(bar, time, length, kind) {
    const { ctx } = this;
    const root = bar.root + 12;
    const chord = [root, root + (bar.scale === 'major' ? 4 : 3), root + 7, root + 12];
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'synth' ? 1800 : 3200;
    out.connect(filter).connect(this.backing);
    const peak = kind === 'synth' ? 0.05 : 0.07;
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(peak, time + (kind === 'synth' ? 0.08 : 0.005));
    if (kind === 'piano') out.gain.setTargetAtTime(peak * 0.25, time + 0.01, 0.25);
    out.gain.setTargetAtTime(0, time + length - 0.05, 0.06);
    chord.forEach((midi, n) => {
      [-6, 6].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = kind === 'synth' ? 'sawtooth' : 'triangle';
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = kind === 'synth' ? cents : cents / 3;
        osc.connect(out);
        osc.start(time + (kind === 'piano' ? n * 0.004 : 0));
        osc.stop(time + length + 0.4);
      });
    });
  }

  /**
   * Chitarra solista: note singole acute (o due insieme), con il suono della chitarra di chi gioca.
   * Le note lunghe partono piegate un tono sotto e salgono (bending), poi vibrano come negli assoli.
   */
  playLead(note, time, length, steps) {
    const kind = this.instrument === 'drums' ? 'drive' : (note.tone === 'clean' ? (this.guitarKind === 'drive' ? 'clean' : this.guitarKind) : this.guitarKind);
    const tone = kind === 'bass' ? 'bass' : kind;
    const shift = kind === 'bass' ? -12 : 12 + (note.up || 0);
    note.lanes.forEach((lane, n) => {
      const src = this.rig.pluck(note.root + shift + steps[lane], tone, time, { length: Math.max(length, 0.18), velocity: n ? 0.7 : 1 });
      if (!note.sustain || !src) return;
      const rate = src.playbackRate;
      rate.setValueAtTime(2 ** (-2 / 12), time);
      rate.linearRampToValueAtTime(1, time + 0.14);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 6;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.014;
      lfo.connect(depth).connect(rate);
      lfo.start(time + 0.3);
      lfo.stop(time + length + 0.1);
    });
  }

  /** Nota della chitarra: power chord distorto, o arpeggio con la chitarra classica/acustica, o il basso. */
  playGuitar(note, time) {
    const length = note.sustain ? note.sustain / 1000 : this.stepDur * 1.6;
    const LANE_STEPS = SCALES[note.scale] || SCALES.minor;
    if (note.lead) {
      this.playLead(note, time, note.sustain ? length : this.stepDur * 1.2, LANE_STEPS);
      return;
    }
    const kind = this.instrument === 'drums' ? 'drive' : this.guitarKind;
    const low = Math.min(...note.lanes);
    const high = Math.max(...note.lanes);
    if (kind === 'bass') {
      this.rig.pluck(note.root - 12 + LANE_STEPS[low], 'bass', time, { length: Math.max(length, 0.3) });
    } else if (kind === 'nylon' || kind === 'steel' || note.tone === 'clean') {
      const tone = kind === 'drive' ? 'clean' : kind;
      note.lanes.forEach((lane) => this.rig.pluck(note.root + 12 + LANE_STEPS[lane], tone, time, { length: Math.max(length, 0.6) }));
      if (kind !== 'drive') this.rig.pluck(note.root + LANE_STEPS[low], tone, time + 0.02, { length: Math.max(length, 0.6), velocity: 0.7 });
    } else {
      this.rig.power(note.root + LANE_STEPS[low], time, { length });
      if (note.lanes.length > 1) this.rig.pluck(note.root + 12 + LANE_STEPS[high], 'drive', time, { length, velocity: 0.7 });
    }
  }

  /** Batteria di chi gioca: il colpo suona subito, al tocco del tasto. */
  pad(lane) {
    const t = this.ctx.currentTime;
    if (lane === 0) this.drums.kick(t);
    else if (lane === 1) this.drums.snare(t);
    else if (lane === 2) this.drums.hat(t);
    else this.drums.crash(t);
  }

  /** Strumento di chi gioca acceso (si prendono le note) o spento (errore): come nel gioco vero. */
  setPlayer(on) {
    const g = this.player.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(on ? 1 : (this.instrument === 'drums' ? 0.35 : 0.04), now, on ? 0.01 : 0.03);
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
  const built = s.instrument === 'drums' ? buildDrumChart(song, diff) : buildChart(song, diff);
  s.chart = built.chart;
  s.length = built.length;
  s.beat = 60000 / song.bpm;
  s.perfect = perfectScore(built.chart, song);
  // Ultima nota di ogni frase stella: prendendo tutta la frase si carica lo star power.
  s.phraseLast = new Map();
  s.chart.forEach((note) => { if (note.star) s.phraseLast.set(note.phrase, note.id); });
  s.phraseFailed = new Set();
  s.audio = new RockAudio(song, built, { instrument: s.instrument, guitarKind: GUITAR_SOUND[s.guitar] || 'drive' });
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
  s.audio.setPlayer(true);
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
  s.audio.setPlayer(false);
}

function endSong(s, failed) {
  s.phase = 'results';
  s.failed = failed;
  s.audio?.stop();
  s.sustaining = [];
}

function gradeOf(s) {
  const ratio = s.points / s.perfect;
  return Math.max(0, Math.min(1000, Math.round(ratio * 1000 * (s.failed ? 0.5 : 1))));
}

/** Gioco per lo strumento: "guitar" (cinque tasti) o "drums" (quattro pad: cassa, rullante, charleston, piatto). */
function makeGame(instrument) {
  const drums = instrument === 'drums';
  const laneCount = drums ? 4 : 5;
  const game = {
    help: drums
      ? 'Scegli la canzone. A = cassa, S = rullante, D = charleston, F = piatto (o 1-4): colpisci quando le note toccano la linea. SPAZIO per lo star power.'
      : 'Scegli la canzone. Premi A S D F G (o 1-5) quando le note toccano la linea; tieni premuto sulle note lunghe; SPAZIO per lo star power.',
    duration: 0,
    ownStart: true,
    wide: true,
    keys: drums
      ? { a: 0, A: 0, 1: 0, s: 1, S: 1, 2: 1, d: 2, D: 2, 3: 2, f: 3, F: 3, 4: 3, ' ': 'star', Enter: 'star' }
      : { a: 0, A: 0, 1: 0, s: 1, S: 1, 2: 1, d: 2, D: 2, 3: 2, f: 3, F: 3, 4: 3, g: 4, G: 4, 5: 4, ' ': 'star', Enter: 'star' },
    buttons: drums
      ? [[0, 'Cassa', null], [1, 'Rullante', null], [2, 'Charleston', null], [3, 'Piatto', null], ['star', 'Star', 'ph-star']]
      : [[0, 'Verde', null], [1, 'Rosso', null], [2, 'Giallo', null], [3, 'Blu', null], [4, 'Arancio', null], ['star', 'Star', 'ph-star']],
    init: () => ({
      phase: 'select', instrument, laneCount, laneColors: drums ? DRUM_COLORS : LANE_COLORS, guitar: 0,
      song: 0, diff: 1, t: 0, chart: [], points: 0, streak: 0, best: 0, hits: 0, misses: 0, rock: 0.65,
      rival: -1, star: 0, starOn: false, held: [false, false, false, false, false], flash: [-9999, -9999, -9999, -9999, -9999],
      sustaining: [], popups: [], failed: false, finished: false, audio: null, perfect: 1, length: 1, beat: 500, lastFx: -9999
    }),
    tick(s, dt, emit) {
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
      // Voto parziale alla stanza, una volta al secondo (percentuale e serie).
      if (s.t - s.lastFx > 1000 && s.t > 0) {
        s.lastFx = s.t;
        const done = s.chart.filter((n) => n.time <= s.t).length || 1;
        const hit = s.chart.filter((n) => n.hit).length;
        emit?.({ kind: 'rock', x: Math.round((hit / done) * 100), power: Math.min(100, s.streak) });
      }
      if (s.rock <= 0) endSong(s, true);
      else if (s.t > s.length + 1200) endSong(s, false);
    },
    press(s, action, pulse, emit) {
      if (s.phase === 'select') {
        if (typeof action === 'string' && action.startsWith('song:')) s.song = Number(action.slice(5));
        else if (typeof action === 'string' && action.startsWith('diff:')) s.diff = Number(action.slice(5));
        else if (typeof action === 'string' && action.startsWith('rival:')) s.rival = Number(action.slice(6));
        else if (typeof action === 'string' && action.startsWith('go')) {
          s.guitar = Number(action.split(':')[1]) || 0;
          // Sfida a una leggenda: il server la avvisa, e lei accetta ad alta voce.
          if (s.rival >= 0) emit?.({ kind: 'rival', x: s.rival });
          startSong(s);
        }
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
      if (typeof action !== 'number' || action >= laneCount) return;
      s.held[action] = true;
      if (drums) s.audio?.pad(action);
      const diff = DIFFICULTIES[s.diff];
      const candidates = s.chart.filter((n) => !n.hit && !n.missed && n.lanes.includes(action) && Math.abs(n.time - s.t) <= diff.window);
      if (!candidates.length) {
        // Tasto a vuoto: la serie si spezza.
        if (s.streak >= 5) popup(s, 'SERIE PERSA', '#f87171');
        s.streak = 0;
        if (!drums) s.audio?.clunk();
        return;
      }
      const note = candidates.reduce((a, b) => (Math.abs(a.time - s.t) <= Math.abs(b.time - s.t) ? a : b));
      // Accordo: servono tutti i tasti premuti insieme.
      if (note.lanes.every((lane) => s.held[lane])) hitNote(s, note, pulse);
    },
    release(s, action) {
      if (typeof action === 'number') s.held[action] = false;
    },
    score: gradeOf,
    done: (s) => s.finished,
    /** Canzone e difficolta' per la classifica della canzone. */
    meta: (s) => ({ song: SONGS[s.song].id, difficulty: DIFFICULTIES[s.diff].id }),
    view: (s, act, extra) => <RockView s={s} act={act} grade={gradeOf(s)} guitar={extra?.guitar || 0} />
  };
  return game;
}

export const rock = makeGame('guitar');
export const drums = makeGame('drums');
