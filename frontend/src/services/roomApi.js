import { apiClient } from './apiClient.js';

export const roomApi = {
  /** Stanze pubbliche e dei giocatori, con il numero di presenti in questo momento. */
  async navigator() {
    return apiClient.get('/rooms/navigator');
  }
};
