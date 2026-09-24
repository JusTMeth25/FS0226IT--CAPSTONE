import { apiClient } from './apiClient.js';

export const furniApi = {
  /** Tutti i mobili con prezzo, ingombro e regole (FurniCatalog.java). */
  async catalog() {
    return apiClient.get('/furni/catalog');
  },
  /** Mobili comprati e non ancora posizionati in una stanza. */
  async inventory() {
    return apiClient.get('/furni/inventory');
  },
  async buy(type) {
    return apiClient.post('/furni/buy', { type });
  }
};
