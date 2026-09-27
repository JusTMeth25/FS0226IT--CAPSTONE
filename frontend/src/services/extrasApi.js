import { apiClient } from './apiClient.js';

/** Lista dei desideri, squadre salvate, confronto fra collezioni e statistiche. */
export const extrasApi = {
  wishlist: () => apiClient.get('/wishlist'),
  wishCodes: () => apiClient.get('/wishlist/codes'),
  addWish: (code) => apiClient.put(`/wishlist/${encodeURIComponent(code)}`),
  removeWish: (code) => apiClient.delete(`/wishlist/${encodeURIComponent(code)}`),
  teams: () => apiClient.get('/teams'),
  saveTeam: (name, cards) => apiClient.post('/teams', { name, cards }),
  deleteTeam: (id) => apiClient.delete(`/teams/${id}`),
  compare: (userId) => apiClient.get(`/collection/compare/${userId}`),
  stats: () => apiClient.get('/collection/stats')
};
