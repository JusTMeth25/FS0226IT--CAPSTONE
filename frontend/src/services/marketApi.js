import { apiClient } from './apiClient.js';

export const marketApi = {
  async getListings(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    return apiClient.get(`/market/listings${qs ? `?${qs}` : ''}`);
  },
  async createListing(cardId, quantity, pricePerUnit) {
    return apiClient.post('/market/list', { cardId, quantity, pricePerUnit });
  },
  async buyListing(listingId, quantity) {
    return apiClient.post('/market/buy', { listingId, quantity });
  },
  async cancelListing(listingId) {
    return apiClient.delete(`/market/listings/${listingId}`);
  }
};
