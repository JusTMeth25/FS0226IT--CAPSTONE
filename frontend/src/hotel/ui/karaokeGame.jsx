import { Drums, GuitarRig, midiToHz } from '../guitarSynth.js';
import KaraokeView from './KaraokeView.jsx';
import { KARAOKE_SONGS, buildMelody, pitchOf } from './karaokeSongs.js';

/**
 * Karaoke del Neon Bar, in stile SingStar senza microfono: si sceglie la canzone, il testo scorre
 * a sillabe e ogni sillaba ha la sua altezza su quattro corsie (Basso, Medio, Alto, Acuto). Si
 * tiene premuto il tasto dell'altezza giusta (A S D F, o i pulsanti) mentre la sillaba passa sul
 * cursore: piu' a lungo si tiene la nota giusta, piu' punti. Le note d'oro del ritornello valgono
 * doppio. Alla fine di ogni riga arriva il giudizio (Perfetto, Ottimo, Bene, Stonato).
 *
 * La base (batteria, basso, chitarra acustica) e la melodia guida sono sintetizzate e seguono
 * l'orologio audio; la voce di chi canta e' un oscillatore con due formanti ("aaa") che suona
 * l'altezza del tasto premuto sull'accordo del momento. Al server va un voto da 0 a 120.
 */

const LOOKAHEAD = 0.15;
const COUNT_IN_BEATS = 4;
/** Tolleranza: una sillaba si prende anche un attimo prima o dopo (la reazione non e' immediata). */
const SLACK_MS = 140;

class KaraokeAudio {
  constructor(song, melody) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.song = song;
    this.melody = melody;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.backing = this.ctx.createGain();
    this.backing.gain.value = 0.7;
    this.backing.connect(this.master);
    this.guide = this.ctx.createGain();
    this.guide.gain.value = 0.35;
    this.guide.connect(this.master);
    this.rig = new GuitarRig(this.ctx, this.backing);
    this.drums = new Drums(this.ctx, this.backing);
    this.beatDur = 60 / song.bpm;
    this.songStart = this.ctx.currentTime + 0.3 + COUNT_IN_BEATS * this.beatDur;
    this.nextHalf = -COUNT_IN_BEATS * 2;
    this.bySyllable = new Map();
    melody.syllables.forEach((syl) => this.bySyllable.set(syl.beat * 2, syl));
    this.buildVoice();
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  /** Voce di chi canta: dente di sega con vibrato, filtrata da due formanti della vocale "a". */
  buildVoice() {
    const { ctx } = this;
    this.voiceOsc = ctx.createOscillator();
    this.voiceOsc.type = 'sawtooth';
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 4;
    vibrato.connect(depth).connect(this.voiceOsc.frequency);
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0;
    [[800, 6, 1], [1200, 8, 0.6], [2500, 10, 0.25]].forEach(([freq, q, level]) => {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = level * 2.2;
      this.voiceOsc.connect(band).connect(g).connect(this.voiceGain);
    });
    this.voiceGain.connect(this.master);
    this.voiceOsc.start();
    vibrato.start();
    this.sources = [this.voiceOsc, vibrato];
  }

  /** Millisecondi dall'inizio della canzone (negativi durante il conteggio). */
  songTime() {
    return (this.ctx.currentTime - this.songStart) * 1000;
  }

  chordAt(beat) {
    const { chords } = this.song;
    return chords[Math.floor(Math.max(0, beat) / 4) % chords.length];
  }

  schedule() {
    const half = this.beatDur / 2;
    const last = (this.melody.beats + 4) * 2;
    while (this.nextHalf < last && this.songStart + this.nextHalf * half < this.ctx.currentTime + LOOKAHEAD) {
      this.playHalf(this.nextHalf, this.songStart + this.nextHalf * half);
      this.nextHalf += 1;
    }
  }

  playHalf(k, time) {
    if (k < 0) {
      if (k % 2 === 0) this.drums.hit(time, 0.05, 3000, 0.4);
      return;
    }
    const beat = k / 2;
    const inBar = k % 8;
    const chord = this.chordAt(beat);
    const ballad = this.song.bpm < 95;
    // Batteria: cassa sull'1 e sul 3, rullante sul 2 e sul 4, charleston sugli ottavi.
    if (inBar === 0 || inBar === 4 || (!ballad && inBar === 5)) this.drums.kick(time, ballad ? 0.6 : 1);
    if (inBar === 2 || inBar === 6) this.drums.snare(time, ballad ? 0.4 : 0.8);
    if (!ballad || k % 2 === 0) this.drums.hat(time, this.song.genre === 'Dance' && k % 2 === 1);
    // Basso sulla fondamentale, chitarra acustica che arpeggia (ballata) o strimpella l'accordo.
    if (k % 2 === 0) this.rig.pluck(chord[0] - 12, 'bass', time, { length: this.beatDur * 0.9, velocity: 0.7 });
    const notes = [chord[0], chord[0] + (chord[1] === 'm' ? 3 : 4), chord[0] + 7, chord[0] + 12];
    if (ballad) this.rig.pluck(notes[k % 4] + 12, 'nylon', time, { length: this.beatDur * 2, velocity: 0.55 });
    else if (inBar === 0 || inBar === 3 || inBar === 6) this.rig.strum(notes, 'steel', time, { up: inBar === 3, velocity: 0.45, length: this.beatDur * 1.4 });
    // Melodia guida, piano: la si sente appena, per sapere come va la canzone.
    const syl = this.bySyllable.get(k);
    if (syl) this.guideNote(pitchOf(chord, syl.level), time, syl.length * this.beatDur * 0.95);
  }

  guideNote(midi, time, length) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.12, time + 0.03);
    g.gain.setTargetAtTime(0, time + length - 0.05, 0.04);
    osc.connect(g).connect(this.guide);
    osc.start(time);
    osc.stop(time + length + 0.3);
  }

  /** Voce di chi canta: altezza (nota MIDI) o null per tacere. */
  voice(midi) {
    const now = this.ctx.currentTime;
    if (midi == null) {
      this.voiceGain.gain.setTargetAtTime(0, now, 0.04);
      this.voiceMidi = null;
      return;
    }
    if (midi !== this.voiceMidi) this.voiceOsc.frequency.setTargetAtTime(midiToHz(midi), now, this.voiceMidi == null ? 0.001 : 0.03);
    this.voiceMidi = midi;
    this.voiceGain.gain.setTargetAtTime(0.28, now, 0.02);
  }

  stop() {
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, now, 0.15);
    setTimeout(() => {
      this.sources.forEach((src) => { try { src.stop(); } catch { /* gia' fermo */ } });
      this.ctx.close().catch(() => {});
    }, 800);
  }
}

// ------------------------------------------------------------------ regole

const RATINGS = [[0.8, 'PERFETTO!', '#fde047'], [0.6, 'Ottimo!', '#22d3ee'], [0.35, 'Bene', '#a78bfa'], [0, 'Stonato…', '#f87171']];

function weightOf(syl) {
  return syl.gold ? 2 : 1;
}

function startSong(s) {
  const song = KARAOKE_SONGS[s.song];
  s.melody = buildMelody(song);
  s.beatMs = 60000 / song.bpm;
  s.melody.syllables.forEach((syl) => { syl.sung = 0; });
  s.perfect = s.melody.syllables.reduce((sum, syl) => sum + syl.length * s.beatMs * 0.9 * weightOf(syl), 0);
  s.audio = new KaraokeAudio(song, s.melody);
  s.phase = 'play';
  s.t = s.audio.songTime();
}

function endSong(s) {
  s.phase = 'results';
  s.audio?.voice(null);
  s.audio?.stop();
}

/** Voto da 0 a 120: la quota di note tenute giuste, con un po' di margine. */
function gradeOf(s) {
  if (!s.perfect) return 0;
  return Math.max(0, Math.min(120, Math.round((s.got / s.perfect / 0.85) * 120)));
}

/** Giudizio della riga appena finita. */
function rateLine(s, line) {
  const syls = s.melody.syllables.filter((syl) => syl.line === line.index);
  const want = syls.reduce((sum, syl) => sum + syl.length * s.beatMs * 0.9, 0);
  const got = syls.reduce((sum, syl) => sum + syl.sung, 0);
  const ratio = want ? got / want : 0;
  const [, text, color] = RATINGS.find(([min]) => ratio >= min);
  s.rating = { text, color, at: s.t, ratio };
  if (ratio >= 0.6) {
    s.lineStreak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.lineStreak);
  } else s.lineStreak = 0;
  s.lineRatings.push(ratio);
}

export const sing = {
  help: 'Scegli la canzone. Tieni premuto A, S, D o F (Basso, Medio, Alto, Acuto) quando la sillaba passa sul microfono, all\'altezza giusta. Le note d\'oro valgono doppio.',
  duration: 0,
  ownStart: true,
  wide: true,
  keys: { a: 0, A: 0, 1: 0, s: 1, S: 1, 2: 1, d: 2, D: 2, 3: 2, f: 3, F: 3, 4: 3 },
  buttons: [[0, 'Basso', 'ph-music-note'], [1, 'Medio', 'ph-music-note'], [2, 'Alto', 'ph-music-notes'], [3, 'Acuto', 'ph-music-notes']],
  init: () => ({
    phase: 'select', song: 0, t: 0, melody: null, beatMs: 500, perfect: 0, got: 0, held: [false, false, false, false],
    level: -1, rated: 0, rating: null, lineStreak: 0, bestStreak: 0, lineRatings: [], lastFx: -9999, audio: null, finished: false
  }),
  tick(s, dt, emit) {
    if (s.phase !== 'play' || !s.audio) return;
    s.t = s.audio.songTime();
    const beat = s.t / s.beatMs;
    const chord = s.audio.chordAt(beat);
    s.audio.voice(s.level >= 0 ? pitchOf(chord, s.level) : null);
    if (s.level >= 0 && s.t > 0) {
      // Sillaba sotto il cursore (con la tolleranza): se l'altezza e' giusta, si prende il tempo.
      const syl = s.melody.syllables.find((x) => {
        const from = x.beat * s.beatMs - SLACK_MS;
        const to = (x.beat + x.length * 0.9) * s.beatMs + SLACK_MS;
        return s.t >= from && s.t < to && x.level === s.level;
      });
      if (syl && syl.sung < syl.length * s.beatMs * 0.9) {
        const add = Math.min(dt, syl.length * s.beatMs * 0.9 - syl.sung);
        syl.sung += add;
        s.got += add * weightOf(syl);
        if (s.t - s.lastFx > 400) {
          s.lastFx = s.t;
          emit?.({ kind: 'sing', x: s.level });
        }
      }
    }
    // Righe finite: giudizio.
    while (s.rated < s.melody.lines.length && beat > s.melody.lines[s.rated].end + 0.3) {
      rateLine(s, s.melody.lines[s.rated]);
      s.rated += 1;
    }
    if (beat > s.melody.beats + 2) endSong(s);
  },
  press(s, action, pulse) {
    if (s.phase === 'select') {
      if (typeof action === 'string' && action.startsWith('song:')) s.song = Number(action.slice(5));
      else if (action === 'go') startSong(s);
      return;
    }
    if (s.phase === 'results') {
      if (action === 'finish') s.finished = true;
      return;
    }
    if (typeof action !== 'number') return;
    s.held[action] = true;
    s.level = action;
    pulse();
  },
  release(s, action) {
    if (typeof action !== 'number') return;
    s.held[action] = false;
    // Rilasciando si torna all'ultimo tasto ancora premuto, o si tace.
    if (s.level === action) s.level = s.held.lastIndexOf(true);
  },
  score: gradeOf,
  done: (s) => s.finished,
  meta: (s) => ({ song: KARAOKE_SONGS[s.song].id }),
  view: (s, act) => <KaraokeView s={s} act={act} grade={gradeOf(s)} />
};
