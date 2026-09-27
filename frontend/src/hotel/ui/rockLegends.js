/**
 * Leggende del Locale Rock (i gatti rockstar delle carte leggendarie originali), che si possono
 * sfidare alla gara rock. Stesso ordine di NpcRoster.LEGEND_KEYS nel backend: al server va
 * l'indice. "skill" e' il voto su 1000 che fanno di solito (il verdetto vero lo da' il server).
 */
export const ROCK_LEGENDS = [
  { key: 'riot_avenue', name: 'Riot Avenue', role: 'The Rebel', skill: 860, card: 'rebel-001' },
  { key: 'thunder_chord', name: 'Thunder Chord', role: 'The King of Riffs', skill: 920, card: 'riff-001' },
  { key: 'royal_echo', name: 'Royal Echo', role: 'The Showman', skill: 780, card: 'showman-001' },
  { key: 'whisker_riot', name: 'Whisker Riot', role: 'The Rebel', skill: 880, card: 'rebel-extra-001' },
  { key: 'virtuoso_soul', name: 'Virtuoso\'s Soul', role: 'The Virtuoso', skill: 960, card: 'virtuoso-001' },
  { key: 'digital_god', name: 'Digital God', role: 'The Synth Master', skill: 900, card: 'synth-001' },
  { key: 'lyric_storm', name: 'Lyric Storm', role: 'The Poet', skill: 740, card: 'poet-001' },
  { key: 'astral_lullaby', name: 'Astral Lullaby', role: 'The Dreamer', skill: 700, card: 'dreamer-001' },
  { key: 'future_frequency', name: 'Future Frequency', role: 'The Innovator', skill: 820, card: 'innovator-001' }
];

/** Voto della leggenda a questo punto della canzone (per la barra della sfida mentre si suona). */
export function rivalLive(legend, t, length) {
  const progress = Math.max(0, Math.min(1, t / length));
  // Un po' di ondeggiamento: a volte e' avanti, a volte insegue.
  const wobble = 1 + Math.sin(t / 2300 + legend.skill) * 0.04;
  return Math.round(legend.skill * progress * wobble);
}
