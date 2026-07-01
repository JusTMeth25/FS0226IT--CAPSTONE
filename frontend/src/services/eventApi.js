import { apiClient } from './apiClient.js';

export const eventApi = {
  async getEvents() {
    return apiClient.get('/events');
  }
};
