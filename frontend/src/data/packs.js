/**
 * VinylDex - Database pacchetti acquistabili/ottenibili.
 */
export const PACKS = [
  {
    id: 'pack-base',
    name: 'Pacchetto Base',
    description: '5 carte con 1 Rara garantita. Perfetto per iniziare la collezione!',
    price: 50,
    cardCount: 5,
    dropRates: { common: 0.50, uncommon: 0.30, rare: 0.12, epic: 0.06, legendary: 0.02 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: true,
    freeCooldownHours: 4
  },
  {
    id: 'pack-deluxe',
    name: 'Pacchetto Deluxe',
    description: '7 carte con 1 Epica garantita. Raddoppia le possibilità di trovare tesori!',
    price: 100,
    cardCount: 7,
    dropRates: { common: 0.30, uncommon: 0.30, rare: 0.20, epic: 0.15, legendary: 0.05 },
    guarantees: { rare: 1, epic: 1, legendary: 0 },
    isFree: false
  },
  {
    id: 'pack-premium',
    name: 'Pacchetto Premium',
    description: '10 carte con 1 Leggendaria garantita. Il massimo del lusso!',
    price: 250,
    cardCount: 10,
    dropRates: { common: 0.20, uncommon: 0.25, rare: 0.25, epic: 0.20, legendary: 0.10 },
    guarantees: { rare: 1, epic: 0, legendary: 1 },
    isFree: false
  },
  {
    id: 'pack-ultimate',
    name: 'Pacchetto Ultimate Team',
    description: '6 carte EA FC 27 con 1 Rara garantita: giocatori, giocatrici e icone di Ultimate Team.',
    price: 150,
    cardCount: 6,
    dropRates: { common: 0.35, uncommon: 0.30, rare: 0.20, epic: 0.11, legendary: 0.04 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'fc27'
  },
  // Pacchetti di un solo gioco (V16): pescano solo le carte di quella fonte.
  {
    id: 'pack-pokemon',
    name: 'Pacchetto Pokémon',
    description: '5 carte solo Pokémon con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'pokemon'
  },
  {
    id: 'pack-yugioh',
    name: 'Pacchetto Yu-Gi-Oh!',
    description: '5 carte solo Yu-Gi-Oh! con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'yugioh'
  },
  {
    id: 'pack-scryfall',
    name: 'Pacchetto Magic',
    description: '5 carte solo Magic con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'scryfall'
  },
  {
    id: 'pack-onepiece',
    name: 'Pacchetto One Piece',
    description: '5 carte solo One Piece con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'onepiece'
  },
  {
    id: 'pack-dragonball',
    name: 'Pacchetto Dragon Ball',
    description: '5 carte solo Dragon Ball con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'dragonball'
  },
  {
    id: 'pack-digimon',
    name: 'Pacchetto Digimon',
    description: '5 carte solo Digimon con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'digimon'
  },
  {
    id: 'pack-lorcana',
    name: 'Pacchetto Lorcana',
    description: '5 carte solo Lorcana con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'lorcana'
  },
  {
    id: 'pack-riftbound',
    name: 'Pacchetto Riftbound',
    description: '5 carte solo Riftbound con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'riftbound'
  },
  {
    id: 'pack-gundam',
    name: 'Pacchetto Gundam',
    description: '5 carte solo Gundam con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'gundam'
  },
  {
    id: 'pack-original',
    name: 'Pacchetto VinylDex Originali',
    description: '5 carte solo VinylDex Originali con 1 Rara garantita.',
    price: 100,
    cardCount: 5,
    dropRates: { common: 0.45, uncommon: 0.30, rare: 0.15, epic: 0.07, legendary: 0.03 },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    isFree: false,
    source: 'original'
  }
];

export const FREE_PACK_COOLDOWN_MS = 4 * 60 * 60 * 1000;

export function findPackById(id) {
  return PACKS.find((p) => p.id === id) || null;
}
