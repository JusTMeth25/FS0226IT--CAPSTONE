/** Costanti e funzioni del casino condivise dai tavoli (CasinoPanel, games, casinoParts). */

export const CASINO_GAMES = {
  cashier: { title: 'Cassa', icon: 'ph-coins' },
  slot: { title: 'Slot machine', icon: 'ph-cherries' },
  poker: { title: 'Video poker', icon: 'ph-cards' },
  roulette: { title: 'Roulette', icon: 'ph-circle-half' },
  blackjack: { title: 'Blackjack', icon: 'ph-spade' },
  baccarat: { title: 'Baccarat', icon: 'ph-crown-simple' },
  craps: { title: 'Dadi', icon: 'ph-dice-five' },
  holdem: { title: 'Poker', icon: 'ph-club' }
};

/** Il mobile del casino cliccato -> il gioco da aprire. */
export const CASINO_FURNI = {
  slot_machine: 'slot', poker_machine: 'poker', roulette_table: 'roulette', blackjack_table: 'blackjack',
  baccarat_table: 'baccarat', craps_table: 'craps', casino_cashier: 'cashier', poker_table: 'holdem'
};

/** Tagli delle fiches con i colori classici dei casino. */
export const CHIPS = [
  { value: 1, color: '#f4f1e8', edge: '#1d4ed8', text: '#1d4ed8' },
  { value: 5, color: '#c1121f', edge: '#f4f1e8', text: '#ffffff' },
  { value: 25, color: '#15803d', edge: '#f4f1e8', text: '#ffffff' },
  { value: 100, color: '#111018', edge: '#d4a537', text: '#ffffff' },
  { value: 500, color: '#6d28d9', edge: '#f4f1e8', text: '#ffffff' },
  { value: 1000, color: '#d4a537', edge: '#7a0f1c', text: '#4e0912' }
];

export function chipStyle(value) {
  return [...CHIPS].reverse().find((c) => value >= c.value) || CHIPS[0];
}

export const formatAmount = (n) => new Intl.NumberFormat('it-IT').format(n);

/** Esito del giro: vinto, perso o pari, con quanto. */
export function outcomeText(res, unit) {
  const net = res.net;
  if (net > 0) return { tone: 'win', text: `Hai vinto ${formatAmount(net)} ${unit}!` };
  if (net === 0) return { tone: 'push', text: 'Pari: riprendi la puntata.' };
  return { tone: 'lose', text: `Hai perso ${formatAmount(-net)} ${unit}.` };
}

