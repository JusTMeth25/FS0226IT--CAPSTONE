/**
 * Canzoni del karaoke (testi originali). Ogni riga e' scritta a sillabe separate da "-" e spazi;
 * la melodia si ricava da sola: una sillaba per battito (le sillabe con "~" durano due battiti),
 * altezza su quattro livelli che salgono e scendono con un andamento fisso per canzone, e
 * l'ultima sillaba di ogni riga tenuta a lungo. Le righe del ritornello ("*") hanno le note d'oro.
 * Il livello (0-3) diventa una nota vera sull'accordo della battuta: fondamentale, terza, quinta,
 * ottava, cosi' la melodia sta sempre bene sulla base.
 */

export const PITCH_LABELS = ['Basso', 'Medio', 'Alto', 'Acuto'];
export const PITCH_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24'];

export const KARAOKE_SONGS = [
  {
    id: 'mezzanotte',
    title: 'Giradischi di mezzanotte',
    artist: 'I Solchi',
    genre: 'Pop',
    bpm: 104,
    level: 1,
    // Accordi per battuta (nota MIDI della fondamentale, minore o maggiore): La- Fa Do Sol.
    chords: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']],
    contour: [1, 2, 2, 1, 0, 1, 2, 3, 2, 1],
    lines: [
      'Gi-ra il vi-ni-le sot-to la lu~-na',
      'o-gni sol-co rac-con-ta u-na sto~-ria',
      '*Al-za il vo-lu-me e bal-la con me~',
      '*la pun-ti-na scen-de e il cuo-re va~',
      'le lu-ci del bar si spen-go-no pia~-no',
      '*can-ta piu for-te fi-no al mat-ti~-no'
    ]
  },
  {
    id: 'estate',
    title: 'Estate al neon',
    artist: 'Luna Park',
    genre: 'Dance',
    bpm: 118,
    level: 2,
    chords: [[50, 'm'], [58, 'M'], [53, 'M'], [48, 'M']],
    contour: [0, 1, 2, 3, 3, 2, 1, 2, 3, 2, 1, 0],
    lines: [
      'Sab-bia cal-da sot-to i pie~-di',
      'bal-lia-mo sul mo-lo fi-no a tar~-di',
      '*E-sta-te al ne-on, bril-la-no le stel~-le',
      '*e-sta-te al ne-on, bri-vi-di sul-la pel~-le',
      'un gel-la-to che si scio-glie tra le ma~-ni',
      'non pen-sia-mo a co-sa suc-ce-de do-ma~-ni',
      '*E-sta-te al ne-on, re-sta an-co-ra un po~'
    ]
  },
  {
    id: 'autostrada',
    title: 'Cuore in autostrada',
    artist: 'Motore Acceso',
    genre: 'Rock',
    bpm: 128,
    level: 3,
    chords: [[52, 'm'], [48, 'M'], [55, 'M'], [50, 'M']],
    contour: [2, 2, 3, 2, 1, 1, 2, 0, 1, 3, 3, 2],
    lines: [
      'Chia-vi nel cru-scot-to e ra-dio al mas-si~-mo',
      'la cit-ta di-e-tro, da-van-ti il de-sti~-no',
      '*Cuo-re in au-to-stra-da, non mi fer-mo piu~',
      '*cuo-re in au-to-stra-da, cor-ro ver-so il blu~',
      'ca-sel-li e scin-til-le, la not-te e lun~-ga',
      '*cuo-re in au-to-stra-da, fi-no al-la fi~-ne'
    ]
  },
  {
    id: 'lento',
    title: 'Lento sotto le stelle',
    artist: 'Velluto',
    genre: 'Ballata',
    bpm: 84,
    level: 1,
    chords: [[48, 'M'], [57, 'm'], [53, 'M'], [55, 'M']],
    contour: [0, 1, 2, 1, 2, 3, 2, 1, 0, 1],
    lines: [
      'Tien-mi la ma-no an-co~-ra',
      'bal-la-re len-to ci con-so~-la',
      '*Sot-to le stel-le io e te~',
      '*non c e nes-sun al-tro ol-tre a te~',
      'la mu-si-ca fi-ni~-sce',
      '*ma noi re-stia-mo qui~'
    ]
  }
];

/** Da nota MIDI della fondamentale e livello (0-3) all'altezza vera sull'accordo. */
export function pitchOf(chord, level) {
  const [root, quality] = chord;
  const third = quality === 'm' ? 3 : 4;
  return root + 12 + [0, third, 7, 12][level];
}

/**
 * Melodia della canzone: sillabe con tempo (in battiti dall'inizio), durata, livello, riga,
 * e le righe con il loro inizio e fine. Ogni riga parte a inizio battuta, con una pausa di due
 * battiti dopo la fine della riga precedente.
 */
export function buildMelody(song) {
  const syllables = [];
  const lines = [];
  let beat = 0;
  let c = 0;
  song.lines.forEach((raw, lineIndex) => {
    const gold = raw.startsWith('*');
    const text = gold ? raw.slice(1) : raw;
    const start = beat;
    const parts = [];
    text.split(' ').forEach((word, w) => {
      const syl = word.split('-');
      syl.forEach((piece, k) => parts.push({ text: piece + (k === syl.length - 1 ? ' ' : ''), word: w }));
    });
    parts.forEach((part, k) => {
      const long = part.text.includes('~');
      const last = k === parts.length - 1;
      const length = last ? 3 : long ? 2 : 1;
      const level = last ? (lineIndex % 2 ? 0 : 2) : song.contour[c % song.contour.length];
      c += 1;
      syllables.push({
        id: syllables.length, line: lineIndex, text: part.text.replace('~', ''), beat, length, level, gold: gold && (last || k % 4 === 3)
      });
      beat += length;
    });
    lines.push({ index: lineIndex, start, end: beat, gold });
    // Pausa, poi la riga dopo parte alla battuta successiva.
    beat = Math.ceil((beat + 2) / 4) * 4;
  });
  return { syllables, lines, beats: beat };
}
