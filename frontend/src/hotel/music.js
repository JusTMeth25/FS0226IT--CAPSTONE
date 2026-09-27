import { soundService } from '../services/soundService.js';

/**
 * Jukebox dell'hotel: sei brani generati con WebAudio, nessun file audio da scaricare.
 *
 * Ogni brano e' un giro di 4 battute a sedicesimi: batteria (cassa, rullante, charleston),
 * basso e arpeggio sugli accordi. Il server dice solo quale brano suona e quando e' partito;
 * ogni client calcola a che punto del giro siamo, cosi' tutti nella stanza sentono la stessa
 * battuta nello stesso momento (a meno della latenza di rete).
 *
 * Gli ultimi due sono disco anni 80 (la Disco li fa suonare da sola): cassa in quattro, charleston
 * aperto in levare (`open`) e basso che salta d'ottava (`octave`).
 *
 * I brani devono restare 6, come RoomInstance.JUKEBOX_TRACKS sul server.
 */

const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);

// Accordi come note MIDI della fondamentale + tipo (m = minore, M = maggiore).
export const TRACKS = [
  {
    name: 'Neon Nights',
    bpm: 108,
    chords: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.xx',
    bass: 'x.x.x.x.x.x.x.x.',
    arp: 'xxxxxxxxxxxxxxxx',
    lead: 'sawtooth'
  },
  {
    name: 'Vinyl Funk',
    bpm: 100,
    chords: [[52, 'm'], [52, 'm'], [57, 'm'], [59, 'M']],
    kick: 'x..x..x...x..x..',
    snare: '....x..x....x...',
    hat: 'xxxxxxxxxxxxxxxx',
    bass: 'x..x.xx...x.x.x.',
    arp: '..x...x...x...x.',
    lead: 'square'
  },
  {
    name: 'Arcade Rush',
    bpm: 132,
    chords: [[48, 'M'], [55, 'M'], [57, 'm'], [53, 'M']],
    kick: 'x...x...x...x...',
    snare: '....x.......x.x.',
    hat: '..x...x...x...x.',
    bass: 'xxxxxxxxxxxxxxxx',
    arp: 'x.xxx.xxx.xxx.xx',
    lead: 'square'
  },
  {
    name: 'Midnight Lo-fi',
    bpm: 80,
    chords: [[50, 'm'], [55, 'M'], [48, 'M'], [57, 'm']],
    kick: 'x.......x..x....',
    snare: '........x.......',
    hat: '..x...x...x...x.',
    bass: 'x.......x.......',
    arp: 'x...x...x...x...',
    lead: 'triangle'
  },
  {
    name: 'Saturday Fever',
    bpm: 108,
    chords: [[53, 'm'], [53, 'm'], [51, 'M'], [56, 'M']],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x...x...x...x...',
    open: '..x...x...x...x.',
    bass: 'x.x.x.x.x.x.x.x.',
    octave: true,
    arp: 'x..x..x...x.x...',
    lead: 'sawtooth'
  },
  {
    name: 'Mirror Ball',
    bpm: 120,
    chords: [[57, 'm'], [50, 'm'], [55, 'M'], [48, 'M']],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..x...x...x...x.',
    bass: 'x.xxx.x.x.xxx.x.',
    octave: true,
    arp: 'x.x.x.xxx.x.x.xx',
    lead: 'square'
  }
];

const STEPS_PER_BAR = 16;
const BARS = 4;
const LOOKAHEAD_S = 0.15;
const TICK_MS = 30;

function chordNotes([root, kind]) {
  return [root, root + (kind === 'm' ? 3 : 4), root + 7, root + 12];
}

class JukeboxPlayer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.timer = 0;
    this.track = -1;
    this.startedAt = 0;
    this.clockOffset = 0;
    this.nextStep = 0;
    this.nextTime = 0;
    this.unsubscribe = soundService.subscribe(() => this.refresh());
    // Con la scheda nascosta la musica si ferma e riprende dal punto giusto al ritorno.
    document.addEventListener('visibilitychange', () => this.refresh());
  }

  /** L'audio del browser parte solo dopo un gesto dell'utente: si chiama al primo clic nell'hotel. */
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.refresh();
  }

  /** Brano da suonare secondo il server. serverTime serve a correggere l'orologio locale. */
  set(track, startedAt, serverTime) {
    this.track = track;
    this.startedAt = startedAt;
    if (serverTime) this.clockOffset = serverTime - Date.now();
    this.refresh();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  destroy() {
    this.stop();
    this.unsubscribe();
    this.ctx?.close();
    this.ctx = null;
  }

  get playing() {
    return this.track >= 0;
  }

  refresh() {
    this.stop();
    const enabled = soundService.isEnabled();
    if (!this.ctx || this.track < 0 || !enabled || document.hidden) return;

    // A che punto del giro siamo, secondo l'orario d'inizio deciso dal server.
    const song = TRACKS[this.track];
    const stepDur = 60 / song.bpm / 4;
    const elapsed = Math.max(0, (Date.now() + this.clockOffset - this.startedAt) / 1000);
    const stepFloat = elapsed / stepDur;
    this.nextStep = Math.ceil(stepFloat) % (STEPS_PER_BAR * BARS);
    this.nextTime = this.ctx.currentTime + (Math.ceil(stepFloat) - stepFloat) * stepDur;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  schedule() {
    const song = TRACKS[this.track];
    if (!song || !this.ctx) return;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(song, this.nextStep, this.nextTime, stepDur);
      this.nextStep = (this.nextStep + 1) % (STEPS_PER_BAR * BARS);
      this.nextTime += stepDur;
    }
  }

  playStep(song, step, time, stepDur) {
    const inBar = step % STEPS_PER_BAR;
    const chord = chordNotes(song.chords[Math.floor(step / STEPS_PER_BAR)]);
    if (song.kick[inBar] === 'x') this.kick(time);
    if (song.snare[inBar] === 'x') this.snare(time);
    if (song.hat[inBar] === 'x') this.hat(time);
    if (song.open?.[inBar] === 'x') this.noiseHit(time, 0.14, 6000, 0.1);
    if (song.bass[inBar] === 'x') {
      // Basso disco: un ottavo giu', un ottavo su.
      const up = song.octave && Math.floor(inBar / 2) % 2 === 1;
      this.tone(midiToHz(chord[0] - (up ? 0 : 12)), time, stepDur * 1.6, 'sawtooth', 0.22, 700);
    }
    if (song.arp[inBar] === 'x') {
      const note = chord[inBar % chord.length] + 12;
      this.tone(midiToHz(note), time, stepDur * 0.9, song.lead, 0.07, 3000);
    }
  }

  tone(freq, time, duration, type, volume, cutoff) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  kick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  noiseHit(time, duration, highpass, volume) {
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  snare(time) {
    this.noiseHit(time, 0.16, 1500, 0.35);
  }

  hat(time) {
    this.noiseHit(time, 0.04, 7000, 0.12);
  }
}

let player = null;

/** Un solo lettore per tutta l'app: cambiando stanza si riusa lo stesso contesto audio. */
export function getJukebox() {
  if (!player) player = new JukeboxPlayer();
  return player;
}
