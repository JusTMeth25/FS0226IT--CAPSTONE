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
  }
];

export const FREE_PACK_COOLDOWN_MS = 4 * 60 * 60 * 1000;

export function findPackById(id) {
  return PACKS.find((p) => p.id === id) || null;
}
