import { apiClient } from './apiClient.js';

export const roomApi = {
  /** Stanze pubbliche e dei giocatori, con il numero di presenti in questo momento. */
  async navigator() {
    return apiClient.get('/rooms/navigator');
  },
  /** La propria stanza, creata alla prima richiesta. */
  async mine() {
    return apiClient.post('/rooms/mine');
  },
  /** Nome, descrizione, porta aperta o chiusa e capienza: solo il proprietario. */
  async updateSettings(roomId, settings) {
    return apiClient.patch(`/rooms/${roomId}`, settings);
  }
};
