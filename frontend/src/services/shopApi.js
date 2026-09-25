import { apiClient } from './apiClient.js';

export const shopApi = {
  /** Carte della collezione che il negozio dell'hotel compra, con l'offerta in gold. */
  async buybackQuotes() {
    return apiClient.get('/shop/buyback');
  },
  /** Vende copie di una carta al negozio; cardId e' il code pubblico. */
  async sellCard(cardId, quantity) {
    return apiClient.post('/shop/buyback', { cardId, quantity });
  }
};
