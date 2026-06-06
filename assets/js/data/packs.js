/**
 * VinylDex - Packs Database
 * 
 * Definizione dei pacchetti acquistabili/ottenibili nel gioco.
 * Ogni pacchetto ha: drop rate, garanzie minime, costo, numero carte.
 */
const VinylDexPacks = [
  {
    id: 'pack-base',
    name: 'Pacchetto Base',
    description: '5 carte con 1 Rara garantita. Perfetto per iniziare la collezione!',
    price: 0,         // Gratuito (con cooldown)
    cardCount: 5,
    dropRates: {
      common: 0.50,
      uncommon: 0.30,
      rare: 0.12,
      epic: 0.06,
      legendary: 0.02
    },
    guarantees: { rare: 1, epic: 0, legendary: 0 },
    img: 'pack-base.png',
    isFree: true
  },
  {
    id: 'pack-deluxe',
    name: 'Pacchetto Deluxe',
    description: '7 carte con 1 Epica garantita. Raddoppia le possibilità di trovare tesori!',
    price: 100,
    cardCount: 7,
    dropRates: {
      common: 0.30,
      uncommon: 0.30,
      rare: 0.20,
      epic: 0.15,
      legendary: 0.05
    },
    guarantees: { rare: 1, epic: 1, legendary: 0 },
    img: 'pack-deluxe.png',
    isFree: false
  },
  {
    id: 'pack-premium',
    name: 'Pacchetto Premium',
    description: '10 carte con 1 Leggendaria garantita. Il massimo del lusso!',
    price: 250,
    cardCount: 10,
    dropRates: {
      common: 0.20,
      uncommon: 0.25,
      rare: 0.25,
      epic: 0.20,
      legendary: 0.10
    },
    guarantees: { rare: 1, epic: 0, legendary: 1 },
    img: 'pack-premium.png',
    isFree: false
  }
];

// Esporta globalmente
window.VinylDexPacks = VinylDexPacks;