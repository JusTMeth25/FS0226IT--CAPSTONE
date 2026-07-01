import { apiClient } from './apiClient.js';

export const collectionApi = {
  /**
   * GET /api/collection con filtri opzionali: search, rarity, set, source, owned.
   */
  async getCollection(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    return apiClient.get(`/collection${qs ? `?${qs}` : ''}`);
  },
  async toggleFavorite(cardId) {
    return apiClient.post(`/collection/${cardId}/favorite`);
  }
};
