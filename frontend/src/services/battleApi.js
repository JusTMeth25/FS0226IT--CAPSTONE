import { apiClient } from './apiClient.js';

export const battleApi = {
  async claimReward(payload) {
    return apiClient.post('/battles/reward', payload);
  },
  /** Giocatori da affrontare con la loro squadra (anche offline), filtrati per nome. */
  async opponents(q = '') {
    return apiClient.get(`/battles/opponents${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  },
  /** Squadra con cui si difende un giocatore: l'ultima salvata o le sue tre carte migliori. */
  async opponentTeam(userId) {
    return apiClient.get(`/battles/opponents/${userId}/team`);
  },
  /** Battaglia contro gli NPC iniziata o finita: nel frattempo non si ricevono proposte di scambio. */
  async activity(busy) {
    return apiClient.post('/battles/activity', { busy });
  },
  /** Giocatori collegati adesso, da sfidare in tempo reale. */
  async online() {
    return apiClient.get('/battles/online');
  }
};
