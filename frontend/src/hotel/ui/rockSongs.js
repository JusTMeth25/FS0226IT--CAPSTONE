/**
 * Canzoni della gara rock: brani originali (titoli e band inventati), scritti come riff su una
 * griglia di sedicesimi. Ogni battuta e' una stringa di 16 caratteri:
 *   G R Y B O  una nota sul tasto verde, rosso, giallo, blu, arancione
 *   1 2 3 4    accordo di due tasti: verde+rosso, rosso+giallo, giallo+blu, blu+arancione
 *   -          la nota prima continua (nota lunga da tenere premuta)
 *   .          pausa
 * Il tasto sceglie la nota: i cinque tasti sono i cinque gradi della scala pentatonica minore
 * sopra la fondamentale della battuta (roots), suonati come power chord distorti.
 * Le sezioni "star" sono le frasi con le note stella: prendendole tutte si carica lo star power.
 */

/** Gradi della pentatonica minore per i cinque tasti (semitoni sopra la fondamentale). */
export const LANE_STEPS = [0, 3, 5, 7, 10];
export const LANE_COLORS = ['#22c55e', '#ef4444', '#facc15', '#3b82f6', '#f97316'];
export const LANE_NAMES = ['Verde', 'Rosso', 'Giallo', 'Blu', 'Arancione'];

/** Moltiplicatore della serie: x1, poi x2 dopo 10 note di fila, x3 dopo 20, x4 dopo 30. */
export const multOf = (streak) => Math.min(4, 1 + Math.floor(streak / 10));

/** Batterie: cassa, rullante, charleston per sedicesimo (x colpo, o charleston aperto). */
export const DRUMS = {
  rock: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  punk: { kick: 'x...x...x...x...', snare: '..x...x...x...x.', hat: 'x.x.x.x.x.x.x.x.' },
  metal: { kick: 'x.xxx.xxx.xxx.xx', snare: '....x.......x...', hat: 'x...x...x...x...' },
  glam: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
  ballad: { kick: 'x.......x.......', snare: '........x.......', hat: 'x...x...x...x...' },
  half: { kick: 'x.......x.......', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' }
};

const E = 40;
const A = 45;
const D = 38;
const G = 43;
const B = 47;
const C = 48;

export const SONGS = [
  {
    id: 'vinile',
    title: 'Vinile Infuocato',
    band: 'Gli Scratch',
    genre: 'Hard rock',
    bpm: 132,
    level: 2,
    sections: [
      { drums: 'half', bars: ['G...G...R...G...', 'G...Y...R-..G...'], roots: [E, E] },
      { drums: 'rock', repeat: 2, bars: ['G.G.R.G.Y.G.R.G.', 'G.G.R.G.B.Y.R.G.', 'G.G.R.G.Y.G.R.G.', 'Y-..R-..G-......'], roots: [E, E, E, E] },
      { drums: 'rock', star: true, bars: ['1...1...2...2...', '3...3...2...1...', '1...1...2...2...', '4-------3-------'], roots: [E, A, E, B] },
      { drums: 'rock', bars: ['G.G.R.G.Y.G.R.G.', 'G.G.R.G.B.Y.R.G.', 'G.G.R.G.Y.G.R.G.', 'Y-..R-..G-......'], roots: [E, E, E, E] },
      { drums: 'rock', star: true, bars: ['1...1...2...2...', '3...3...2...1...', '1...1...2...2...', '4-------3-------'], roots: [E, A, E, B] },
      { drums: 'rock', bars: ['G.R.Y.B.O.B.Y.R.', 'G.R.Y.B.O.O.B.Y.', 'OBYROBYRGRYBOBYR', '1---------------'], roots: [E, E, E, E] }
    ]
  },
  {
    id: 'autostrada',
    title: 'Autostrada Elettrica',
    band: 'I Semafori Rotti',
    genre: 'Punk rock',
    bpm: 176,
    level: 3,
    sections: [
      { drums: 'half', bars: ['G.G.G.G.G.G.G.G.', 'R.R.R.R.Y.Y.Y.Y.'], roots: [E, E] },
      { drums: 'punk', repeat: 2, bars: ['G.G.G.G.G.G.G.G.', 'G.G.G.G.G.G.G.G.', 'R.R.R.R.R.R.R.R.', 'Y.Y.Y.Y.R.R.G.G.'], roots: [E, E, A, B] },
      { drums: 'punk', star: true, bars: ['2.2.2.2.3.3.3.3.', '2.2.2.2.1.1.1.1.', '2.2.2.2.3.3.3.3.', '4.4.4.4.3-2-1---'], roots: [E, E, E, E] },
      { drums: 'punk', bars: ['G.G.G.G.G.G.G.G.', 'G.G.G.G.G.G.G.G.', 'R.R.R.R.R.R.R.R.', 'Y.Y.Y.Y.R.R.G.G.'], roots: [E, E, A, B] },
      { drums: 'punk', star: true, bars: ['2.2.2.2.3.3.3.3.', '2.2.2.2.1.1.1.1.', '2.2.2.2.3.3.3.3.', '4.4.4.4.3-2-1---'], roots: [E, E, E, E] },
      { drums: 'punk', bars: ['GRYBOBYRGRYBOBYR', 'GRYBOBYRGRYBOBYR', 'O.O.O.O.B.B.Y.Y.', '1---------------'], roots: [E, E, E, E] }
    ]
  },
  {
    id: 'neon',
    title: 'Tuono al Neon',
    band: 'Glam Palace',
    genre: 'Glam rock anni 80',
    bpm: 120,
    level: 2,
    sections: [
      { drums: 'glam', bars: ['G-..R-..Y.B.Y.R.', 'G-..R-..Y.B.O---'], roots: [A, A] },
      { drums: 'glam', repeat: 2, bars: ['G.G.Y.G.B.Y.G...', 'R.R.B.R.O.B.R...', 'G.G.Y.G.B.Y.G...', 'Y---B---O-------'], roots: [A, A, D, E] },
      { drums: 'glam', star: true, bars: ['3---2---1---G.R.', '3---2---1---G.R.', 'Y.B.O.B.Y.R.G.R.', '4---------------'], roots: [A, D, A, E] },
      { drums: 'glam', bars: ['G.G.Y.G.B.Y.G...', 'R.R.B.R.O.B.R...', 'G.G.Y.G.B.Y.G...', 'Y---B---O-------'], roots: [A, A, D, E] },
      { drums: 'glam', star: true, bars: ['OBOYOBOYOBOYORGR', 'OBOYOBOYBYRGR---', 'G.R.Y.B.O---B---', '1---------------'], roots: [A, A, A, A] }
    ]
  },
  {
    id: 'metallo',
    title: 'Metallo Vinile',
    band: 'Ferro Battuto',
    genre: 'Heavy metal',
    bpm: 150,
    level: 3,
    sections: [
      { drums: 'half', bars: ['G---------------', 'G---R---Y---B---'], roots: [E, E] },
      { drums: 'metal', repeat: 2, bars: ['G.GGG.GGG.GGR.RR', 'G.GGG.GGY.YYB.BB', 'G.GGG.GGG.GGR.RR', 'O.OOB.BBY.YYR---'], roots: [E, E, E, E] },
      { drums: 'metal', star: true, bars: ['1.1.1.1.2.2.2.2.', '3.3.3.3.2.2.1...', '1.1.1.1.2.2.2.2.', '4.4.3.3.2.2.1---'], roots: [E, E, C, D] },
      { drums: 'metal', bars: ['G.GGG.GGG.GGR.RR', 'G.GGG.GGY.YYB.BB', 'G.GGG.GGG.GGR.RR', 'O.OOB.BBY.YYR---'], roots: [E, E, E, E] },
      { drums: 'metal', star: true, bars: ['OBYBOBYBOBYBOBYB', 'RYRYBYBYOBOBYRGR', 'GRYBOBYRGRYBOBYR', 'O---------------'], roots: [E, E, E, E] }
    ]
  },
  {
    id: 'ballata',
    title: 'Ballata del Jukebox',
    band: 'Luna Elettrica',
    genre: 'Power ballad',
    bpm: 84,
    level: 1,
    sections: [
      { drums: 'ballad', tone: 'clean', bars: ['G.R.Y.B.O.B.Y.R.', 'G.R.Y.B.O.B.Y.R.'], roots: [D, G] },
      { drums: 'ballad', tone: 'clean', repeat: 2, bars: ['G-------Y-------', 'R-------B-------', 'G-------Y-------', 'R---Y---B-------'], roots: [D, A, G, A] },
      { drums: 'half', star: true, bars: ['2-------3-------', '4-------3-------', '2-------3-------', '1---------------'], roots: [D, A, G, D] },
      { drums: 'half', bars: ['G.R.Y.B.O---B---', 'Y.R.G.R.Y---B---', 'O.B.Y.R.G---R---', '1---------------'], roots: [D, A, G, D] }
    ]
  }
];

export const DIFFICULTIES = [
  { id: 'easy', label: 'Facile', lanes: 3, travel: 2100, window: 120 },
  { id: 'medium', label: 'Medio', lanes: 4, travel: 1800, window: 110 },
  { id: 'hard', label: 'Difficile', lanes: 5, travel: 1500, window: 95 }
];

const CHORDS = { 1: [0, 1], 2: [1, 2], 3: [2, 3], 4: [3, 4] };
const LETTERS = { G: 0, R: 1, Y: 2, B: 3, O: 4 };

/** Battute una dopo l'altra, con le ripetizioni delle sezioni. */
export function songBars(song) {
  const bars = [];
  song.sections.forEach((section, index) => {
    for (let rep = 0; rep < (section.repeat || 1); rep += 1) {
      section.bars.forEach((pattern, i) => bars.push({
        pattern, root: section.roots[i % section.roots.length], drums: section.drums, tone: section.tone || 'drive',
        star: !!section.star, phrase: `${index}:${rep}`, first: i === 0
      }));
    }
  });
  return bars;
}

/** Note complete (quelle della difficolta' Difficile): servono anche per l'audio della chitarra. */
export function fullNotes(song) {
  const bars = songBars(song);
  const step = 60000 / song.bpm / 4;
  const notes = [];
  bars.forEach((bar, b) => {
    for (let i = 0; i < 16; i += 1) {
      const c = bar.pattern[i];
      const lanes = LETTERS[c] !== undefined ? [LETTERS[c]] : CHORDS[c];
      if (!lanes) continue;
      let length = 1;
      while (i + length < 16 && bar.pattern[i + length] === '-') length += 1;
      notes.push({
        bar: b, step: i, time: (b * 16 + i) * step, lanes, sustain: length >= 4 ? length * step : 0,
        root: bar.root, tone: bar.tone, star: bar.star, phrase: bar.phrase
      });
    }
  });
  return { notes, bars, step, length: bars.length * 16 * step };
}

/**
 * Spartito per la difficolta': Facile solo le note sui quarti e tre tasti, Medio gli ottavi e
 * quattro tasti, Difficile tutto. Gli accordi che finiscono sullo stesso tasto diventano note singole.
 */
export function buildChart(song, difficulty) {
  const full = fullNotes(song);
  const map = difficulty.lanes === 3 ? [0, 1, 1, 2, 2] : difficulty.lanes === 4 ? [0, 1, 2, 3, 3] : [0, 1, 2, 3, 4];
  const every = difficulty.lanes === 3 ? 4 : difficulty.lanes === 4 ? 2 : 1;
  const chart = full.notes
    .filter((n) => n.step % every === 0)
    .map((n, id) => ({ ...n, id, lanes: [...new Set(n.lanes.map((l) => map[l]))], hit: false, missed: false }));
  return { ...full, chart };
}

/** Punteggio perfetto senza star power: 50 punti per tasto, moltiplicatore che sale con la serie, note lunghe. */
export function perfectScore(chart, song) {
  const beat = 60000 / song.bpm;
  let streak = 0;
  let total = 0;
  chart.forEach((note) => {
    streak += 1;
    const mult = Math.min(4, 1 + Math.floor(streak / 10));
    total += 50 * note.lanes.length * mult + (note.sustain ? Math.floor((note.sustain / beat) * 25) * mult : 0);
  });
  return Math.max(1, total);
}
