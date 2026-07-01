import { apiClient } from './apiClient.js';

export const leaderboardApi = {
  async getLeaderboard(type = 'collection') {
    return apiClient.get(`/leaderboard?type=${encodeURIComponent(type)}`);
  }
};
