/**
 * Colori delle rarita' per le modalita' daltonismo (services/accessibility.js, campo cvd).
 * Stessi valori delle variabili --rarity-* in styles/a11y-cvd.css: se ne cambi uno, cambia anche
 * l'altro.
 *
 * Scelti (partendo da Okabe-Ito / IBM) perche' restino distinguibili fra loro nella simulazione
 * della deficienza (Machado 2009, severita' piena) e si leggano come testo sui fondi scuri del
 * sito (#07040f, #0d0820) con contrasto almeno 4.5:1:
 * - rg (protanopia e deuteranopia): tutto sull'asse blu-giallo e sulla luminosita';
 * - by (tritanopia): tutto sull'asse rosso-ciano e sulla luminosita';
 * - mono (scala di grigi): solo luminosita', a passi uguali dal piu' scuro (comune) al piu'
 *   chiaro (leggendaria). Sei grigi leggibili su fondo scuro restano vicini: lo distinguono
 *   anche le gemme di forma diversa.
 * Comune resta un grigio neutro, leggendaria la piu' calda o brillante.
 */
export const RARITY_PALETTES = {
  rg: {
    common: '#868686',
    uncommon: '#C0FFE5',
    rare: '#88D0FF',
    epic: '#6670E8',
    legendary: '#FFF23E',
    mythic: '#F63000'
  },
  by: {
    common: '#878787',
    uncommon: '#A5FFB1',
    rare: '#087BF1',
    epic: '#FF3DF5',
    legendary: '#FFE300',
    mythic: '#F70000'
  },
  mono: {
    common: '#7B7B7B',
    uncommon: '#8E8E8E',
    rare: '#A4A4A4',
    epic: '#BDBDBD',
    legendary: '#FAFAFA',
    mythic: '#DADADA'
  }
};
