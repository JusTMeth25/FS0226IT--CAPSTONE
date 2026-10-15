import { apiClient } from './apiClient.js';

/** Casino dell'hotel: cassa delle fiches e tavoli (tutto deciso dal server, CasinoService). */
export const casinoApi = {
  wallet: () => apiClient.get('/casino/wallet'),
  exchange: (action, amount) => apiClient.post('/casino/exchange', { action, amount }),
  bonus: () => apiClient.post('/casino/bonus'),
  slot: (bet, currency) => apiClient.post('/casino/slot', { bet, currency }),
  roulette: (bets, currency) => apiClient.post('/casino/roulette', { bets, currency }),
  blackjackDeal: (bet, currency) => apiClient.post('/casino/blackjack/deal', { bet, currency }),
  blackjack: (action) => apiClient.post(`/casino/blackjack/${action}`),
  pokerDeal: (bet, currency) => apiClient.post('/casino/poker/deal', { bet, currency }),
  pokerDraw: (hold) => apiClient.post('/casino/poker/draw', { hold }),
  baccarat: (bets, currency) => apiClient.post('/casino/baccarat', { bets, currency }),
  craps: (bet, side, currency) => apiClient.post('/casino/craps', { bet, side, currency })
};

/** Messaggi per i codici d'errore del casino. */
export const CASINO_ERRORS = {
  casino_not_here: 'Si gioca solo dentro il Casinò.',
  hotel_other_device: 'L\'hotel è aperto su un altro dispositivo: gioca da lì o riprendilo qui.',
  casino_bad_bet: 'Puntata non valida: da 1 a 1000 per puntata.',
  casino_not_enough_chips: 'Non hai abbastanza fiches: cambiale alla cassa.',
  insufficient_gold: 'Non hai abbastanza gold.',
  casino_bonus_taken: 'Il regalo di fiches di oggi l\'hai già preso: torna domani!',
  casino_no_hand: 'Nessuna mano in corso.',
  casino_cannot_double: 'Puoi raddoppiare solo con le prime due carte.',
  casino_bad_amount: 'Importo non valido.'
};

export function casinoError(err) {
  return CASINO_ERRORS[err?.code] || err?.message || 'Qualcosa è andato storto, riprova.';
}
