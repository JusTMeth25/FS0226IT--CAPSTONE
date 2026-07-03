import { apiClient } from './apiClient.js';

export const cardApi = {
  /** Lookup pubblico di una carta dal catalogo backend (include le carte importate). */
  async getCard(id) {
    return apiClient.get(`/cards/${encodeURIComponent(id)}`);
  }
};
