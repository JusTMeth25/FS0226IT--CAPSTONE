import { apiClient } from './apiClient.js';

export const tradeApi = {
  async createTrade(payload) {
    // payload: { toUserId, offeredCards: [{cardId, quantity}], offeredGold, requestedCards: [...], requestedGold }
    return apiClient.post('/trades', payload);
  },
  async getIncoming() {
    return apiClient.get('/trades/incoming');
  },
  async getOutgoing() {
    return apiClient.get('/trades/outgoing');
  },
  async accept(tradeId) {
    return apiClient.post(`/trades/${tradeId}/accept`);
  },
  async reject(tradeId) {
    return apiClient.post(`/trades/${tradeId}/reject`);
  },
  async cancel(tradeId) {
    return apiClient.post(`/trades/${tradeId}/cancel`);
  }
};
