import { apiClient } from './apiClient.js';

export const missionApi = {
  async getMissions() {
    return apiClient.get('/missions');
  },
  async claimMission(missionId) {
    return apiClient.post(`/missions/${missionId}/claim`);
  },
  async claimDailyLogin() {
    return apiClient.post('/missions/daily-login/claim');
  }
};
