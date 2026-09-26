import { apiClient } from './apiClient.js';

/** API dell'hotel fuori dal WebSocket: tutorial, amici, messaggi privati, animali. */
export const hotelApi = {
  /** Il tutorial della prima visita e' gia' stato visto? */
  async tutorial() {
    return apiClient.get('/hotel/tutorial');
  },
  async tutorialDone() {
    return apiClient.post('/hotel/tutorial');
  },
  /** Amici con stato e stanza, richieste ricevute e mandate. */
  async friends() {
    return apiClient.get('/friends');
  },
  async friendRequest(username) {
    return apiClient.post('/friends/request', { username });
  },
  async acceptFriend(requestId) {
    return apiClient.post(`/friends/requests/${requestId}/accept`);
  },
  async removeFriend(userId) {
    return apiClient.delete(`/friends/${userId}`);
  },
  async thread(userId) {
    return apiClient.get(`/friends/${userId}/messages`);
  },
  async sendMessage(userId, text) {
    return apiClient.post(`/friends/${userId}/messages`, { text });
  },
  /** Animale da compagnia: catalogo, il proprio animale, adozione e cibo. */
  async pets() {
    return apiClient.get('/pets');
  },
  async adoptPet(type, name) {
    return apiClient.post('/pets/adopt', { type, name });
  },
  async feedPet() {
    return apiClient.post('/pets/feed');
  },
  async releasePet() {
    return apiClient.delete('/pets');
  },
  /** Eventi a orario: in corso con classifica, prossimi, ultimi vincitori. */
  async events() {
    return apiClient.get('/hotel/events');
  },
  /** Asta: carta in vendita, ultime aste, offerta. */
  async auction() {
    return apiClient.get('/hotel/auction');
  },
  async bid(amount) {
    return apiClient.post('/hotel/auction/bid', { amount });
  }
};
