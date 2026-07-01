import { apiClient } from './apiClient.js';

export const packApi = {
  async getPacks() {
    return apiClient.get('/packs');
  },
  /** POST /api/open-pack — il server decide gold, drop-rate e carte vinte. */
  async openPack(packId, mode = 'paid') {
    return apiClient.post('/open-pack', { packId, mode });
  }
};
