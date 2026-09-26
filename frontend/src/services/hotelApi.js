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
  },
  /** Club: il mio (con i membri) e la lista di tutti. */
  async clubs() {
    return apiClient.get('/hotel/clubs');
  },
  async createClub(club) {
    return apiClient.post('/hotel/clubs', club);
  },
  async joinClub(clubId) {
    return apiClient.post(`/hotel/clubs/${clubId}/join`);
  },
  async leaveClub() {
    return apiClient.post('/hotel/clubs/leave');
  },
  /** Feste nelle stanze. */
  async startParty(roomId, title) {
    return apiClient.post('/hotel/parties', { roomId, title });
  },
  async stopParty(roomId) {
    return apiClient.delete(`/hotel/parties/${roomId}`);
  },
  /** Banchetto delle carte. */
  async stall(itemId) {
    return apiClient.get(`/hotel/stalls/${itemId}`);
  },
  async stallAdd(itemId, card, price) {
    return apiClient.post(`/hotel/stalls/${itemId}`, { card, price });
  },
  async stallRemove(stallItemId) {
    return apiClient.delete(`/hotel/stalls/items/${stallItemId}`);
  },
  async stallBuy(stallItemId) {
    return apiClient.post(`/hotel/stalls/items/${stallItemId}/buy`);
  },
  /** Foto dell'hotel. */
  async photos(userId) {
    return apiClient.get(userId ? `/hotel/photos/users/${userId}` : '/hotel/photos');
  },
  async savePhoto(image, roomName) {
    return apiClient.post('/hotel/photos', { image, roomName });
  },
  async deletePhoto(photoId) {
    return apiClient.delete(`/hotel/photos/${photoId}`);
  },
  /** Posta fra amici. */
  async mail() {
    return apiClient.get('/hotel/mail');
  },
  async sendMail(to, gold, card, note) {
    return apiClient.post('/hotel/mail', { to, gold, card, note });
  },
  async claimMail(mailId) {
    return apiClient.post(`/hotel/mail/${mailId}/claim`);
  }
};
