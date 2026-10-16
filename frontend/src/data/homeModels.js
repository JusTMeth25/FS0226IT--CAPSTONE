/**
 * Modelli della copertina della Home: le figure ritagliate dalle illustrazioni delle carte
 * originali VinylDex (sfondo tolto una volta sola, a parte: vedi public/assets/img/models).
 * Ne compare uno a caso a ogni apertura o refresh; `card` e' il codice della carta da cui viene,
 * per il link "Modello: ..." alla sua scheda.
 */
export const HOME_MODELS = [
  { slug: 'eternal-empress-full', name: 'Eternal Empress', card: 'legendary-ultimate-001' },
  { slug: 'eternal-empress-realistic-full', name: 'Eternal Empress', card: 'legendary-ultimate-002' },
  { slug: 'astral-lullaby', name: 'Astral Lullaby', card: 'dreamer-001' },
  { slug: 'future-frequency', name: 'Future Frequency', card: 'innovator-001' },
  { slug: 'lyric-storm', name: 'Lyric Storm', card: 'poet-001' },
  { slug: 'whisker', name: 'Whisker Riot', card: 'rebel-extra-001' },
  { slug: 'binary-beat', name: 'Binary Beat', card: 'innovator-004' },
  { slug: 'neon-circuit', name: 'Neon Circuit', card: 'innovator-003' },
  { slug: 'neon-performer', name: 'Neon Performer', card: 'showman-003' },
  { slug: 'silent-rhyme', name: 'Silent Rhyme', card: 'poet-003' },
  { slug: 'pixel-bass', name: 'Pixel Bass', card: 'innovator-005' },
  { slug: 'crystal-note', name: 'Crystal Note', card: 'virtuoso-004' },
  { slug: 'silver-scale', name: 'Silver Scale', card: 'virtuoso-005' },
  { slug: 'paper-wings', name: 'Paper Wings', card: 'poet-004' },
  { slug: 'street-voltage', name: 'Street Voltage', card: 'rebel-004' },
  { slug: 'street-vision', name: 'Street Vision', card: 'court-uncommon-001' },
  { slug: 'blue-lightning', name: 'Blue Lightning', card: 'court-rare-001' },
  { slug: 'fast-break', name: 'Fast Break', card: 'court-rare-004' }
];

const LAST_KEY = 'vinyldex_home_model';

/** Un modello a caso, mai lo stesso della volta prima (se la memoria del browser c'e'). */
export function pickHomeModel() {
  let last = null;
  try {
    last = sessionStorage.getItem(LAST_KEY);
  } catch {
    // senza sessionStorage si sceglie e basta
  }
  const pool = HOME_MODELS.filter((m) => m.slug !== last);
  const model = pool[Math.floor(Math.random() * pool.length)] || HOME_MODELS[0];
  try {
    sessionStorage.setItem(LAST_KEY, model.slug);
  } catch {
    // vale solo per questa apertura
  }
  return model;
}

export const modelSrc = (model, small = false) => `${import.meta.env.BASE_URL}assets/img/models/${model.slug}${small ? '-sm' : ''}.webp`;
