import { useEffect, useRef, useState } from 'react';
import { GUITAR_SOUND, GuitarRig } from '../guitarSynth.js';
import { getJukebox } from '../music.js';
import GuitarFace from './GuitarFace.jsx';

/**
 * Prova di una chitarra nel Rock Store: accordi e power chord da suonare con i pulsanti (o con i
 * tasti 1-8) e un riff di prova, con il suono di quello strumento: nylon per la classica, acciaio
 * per l'acustica, distorta per le elettriche, basso per i bassi.
 */

const OPEN = {
  Mi: [40, 47, 52, 56, 59, 64],
  La: [45, 52, 57, 61, 64],
  Re: [50, 57, 62, 66],
  Sol: [43, 47, 50, 55, 59, 67],
  Do: [48, 52, 55, 60, 64],
  Lam: [45, 52, 57, 60, 64],
  Mim: [40, 47, 52, 55, 59, 64],
  Fa: [41, 48, 53, 57, 60, 65]
};
const POWER = { E5: [40, 47, 52], A5: [45, 52, 57], D5: [50, 57, 62], G5: [43, 50, 55], C5: [48, 55, 60], B5: [47, 54, 59], F5: [41, 48, 53], Fa5: [42, 49, 54] };
const BASS = { Mi: [28], La: [33], Re: [38], Sol: [43], 'Mi alto': [40], Do: [36], Si: [35], Fa: [29] };

/** Riff di prova per ogni suono: [ottavi dall'inizio, note, durata in ottavi]. */
const RIFFS = {
  nylon: { bpm: 96, notes: [[0, [45]], [1, [52]], [2, [57]], [3, [60]], [4, [64]], [5, [60]], [6, [57]], [7, [52]],
    [8, [40]], [9, [47]], [10, [52]], [11, [55]], [12, [59]], [13, [55]], [14, [52]], [15, [47]], [16, OPEN.Lam, 4]] },
  steel: { bpm: 100, notes: [[0, OPEN.Sol, 2], [2, OPEN.Sol], [3, OPEN.Sol], [4, OPEN.Do, 2], [6, OPEN.Do], [7, OPEN.Do],
    [8, OPEN.Re, 2], [10, OPEN.Re], [11, OPEN.Re], [12, OPEN.Sol, 4]] },
  drive: { bpm: 132, notes: [[0, POWER.E5, 2], [2, POWER.E5], [3, POWER.G5, 2], [5, POWER.A5, 3], [8, POWER.E5, 2], [10, POWER.E5],
    [11, POWER.G5, 2], [13, POWER.B5], [14, POWER.A5, 2], [16, POWER.E5, 6]] },
  bass: { bpm: 110, notes: [[0, [28]], [1, [28]], [2, [40]], [3, [28]], [4, [31]], [5, [33]], [6, [35]], [7, [33]],
    [8, [28]], [9, [28]], [10, [40]], [11, [38]], [12, [36]], [13, [35]], [14, [33]], [15, [31]], [16, [28], 4]] }
};

export default function GuitarTester({ index, name, onClose }) {
  const kind = GUITAR_SOUND[index] || 'clean';
  const audio = useRef(null);
  const [strum, setStrum] = useState(0);
  const chords = kind === 'bass' ? BASS : kind === 'drive' ? POWER : OPEN;
  const names = Object.keys(chords);

  // Mentre si prova la chitarra la musica della stanza tace.
  useEffect(() => {
    getJukebox().setMuted(true);
    return () => {
      getJukebox().setMuted(false);
      audio.current?.ctx.close().catch(() => {});
    };
  }, []);

  function rig() {
    if (!audio.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      audio.current = { ctx, rig: new GuitarRig(ctx, master) };
    }
    if (audio.current.ctx.state === 'suspended') audio.current.ctx.resume();
    return audio.current;
  }

  function play(notes, when = 0, length = null) {
    const { ctx, rig: r } = rig();
    const time = ctx.currentTime + 0.02 + when;
    if (notes.length === 1) r.pluck(notes[0], kind, time, { length });
    else r.strum(notes, kind, time, { length, spread: kind === 'nylon' ? 0.03 : 0.014 });
    setStrum((n) => n + 1);
  }

  function playRiff() {
    const riff = RIFFS[kind] || RIFFS.drive;
    const eighth = 60 / riff.bpm / 2;
    riff.notes.forEach(([at, notes, len = 1]) => play(notes, at * eighth, kind === 'drive' || kind === 'bass' ? len * eighth * 0.95 : null));
  }

  // Tasti 1-8 per gli accordi, R per il riff.
  const keyRef = useRef(null);
  useEffect(() => {
    keyRef.current = (event) => {
      if (event.target instanceof HTMLInputElement) return;
      const n = Number(event.key);
      if (n >= 1 && n <= names.length) play(chords[names[n - 1]]);
      if (event.key === 'r' || event.key === 'R') playRiff();
    };
  });
  useEffect(() => {
    const onKey = (event) => keyRef.current?.(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const label = { nylon: 'corde di nylon', steel: 'corde di acciaio', drive: 'elettrica distorta', bass: 'basso', clean: 'elettrica pulita' }[kind];
  return (
    <div className="guitar-tester" role="dialog" aria-label={`Prova: ${name}`}>
      <header>
        <strong><i className="ph-fill ph-music-notes" /> Prova: {name}</strong>
        <small>{label}</small>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi la prova"><i className="ph ph-x" /></button>
      </header>
      <div className={`guitar-tester-art strum-${strum % 2}`} key={strum}>
        <GuitarFace index={index} big />
      </div>
      <div className="guitar-tester-chords">
        {names.map((chord, i) => (
          <button key={chord} type="button" className="btn btn-secondary btn-small" onClick={() => play(chords[chord])}>
            <kbd>{i + 1}</kbd> {chord}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-small" onClick={playRiff}>
        <i className="ph-fill ph-play" /> Riff di prova <kbd>R</kbd>
      </button>
    </div>
  );
}
