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
  /** Raccoglitore a pagine: le carte di un gioco (source) o di un set (set) da offset, al massimo limit. */
  /** Carte di un altro giocatore da chiedere in uno scambio (username o id). */
  async tradable(handle) {
    return apiClient.get(`/collection/of/${encodeURIComponent(handle)}`);
  },
  async binder({ source, set, offset = 0, limit = 90 }) {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (set) params.set('set', set);
    else if (source) params.set('source', source);
    return apiClient.get(`/collection/binder?${params}`);
  },
  async toggleFavorite(cardId) {
    return apiClient.post(`/collection/${cardId}/favorite`);
  }
};
