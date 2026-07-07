import { apiClient } from './apiClient.js';

export const battleApi = {
  async claimReward(payload) {
    return apiClient.post('/battles/reward', payload);
  }
};
