import { apiClient } from './apiClient.js';

export const adminApi = {
  // Incassi del casino (cassa del banco)
  async getCasinoBank() { return apiClient.get('/admin/casino/bank'); },
  async withdrawCasino(currency, amount) { return apiClient.post('/admin/casino/bank/withdraw', { currency, amount }); },

  // Utenti
  async getUsers() { return apiClient.get('/admin/users'); },
  async banUser(userId) { return apiClient.post(`/admin/users/${userId}/ban`); },
  async unbanUser(userId) { return apiClient.post(`/admin/users/${userId}/unban`); },
  async setUserGold(userId, gold) { return apiClient.patch(`/admin/users/${userId}/gold`, { gold }); },
  async giveCard(userId, cardId, quantity) { return apiClient.post(`/admin/users/${userId}/cards`, { cardId, quantity }); },

  // Carte / pacchetti / drop-rate / garanzie
  async getCards(q = '') { return apiClient.get(`/admin/cards${q ? `?q=${encodeURIComponent(q)}` : ''}`); },
  async createCard(payload) { return apiClient.post('/admin/cards', payload); },
  async updateCard(cardId, payload) { return apiClient.patch(`/admin/cards/${cardId}`, payload); },
  async getPacks() { return apiClient.get('/admin/packs'); },
  async createPack(payload) { return apiClient.post('/admin/packs', payload); },
  async updatePack(packId, payload) { return apiClient.patch(`/admin/packs/${packId}`, payload); },
  async setDropRates(packId, dropRates) { return apiClient.put(`/admin/packs/${packId}/drop-rates`, { dropRates }); },
  async setGuarantees(packId, guarantees) { return apiClient.put(`/admin/packs/${packId}/guarantees`, { guarantees }); },

  // Import carte da API esterne
  async importPokemon(payload) { return apiClient.post('/admin/import/pokemon', payload); },
  async importScryfall(payload) { return apiClient.post('/admin/import/scryfall', payload); },
  async importYugioh(payload) { return apiClient.post('/admin/import/yugioh', payload); },
  async importOnePiece(payload) { return apiClient.post('/admin/import/onepiece', payload); },
  async importDigimon(payload) { return apiClient.post('/admin/import/digimon', payload); },
  async importLorcana(payload) { return apiClient.post('/admin/import/lorcana', payload); },
  async importRiftbound(payload) { return apiClient.post('/admin/import/riftbound', payload); },
  async importNikke(payload) { return apiClient.post('/admin/import/nikke', payload); },
  /** Giochi dal catalogo TCGplayer: stesso percorso, cambia solo la fonte. */
  async importSource(source, payload) {
    // Tutto il catalogo sono migliaia di carte: il server ci mette minuti, non secondi.
    return apiClient.post(`/admin/import/${source}`, payload, { timeout: payload?.all ? 3_600_000 : 180_000 });
  },
  async importGundam(payload) { return apiClient.post('/admin/import/gundam', payload); },
  async importDragonBall(payload) { return apiClient.post('/admin/import/dragonball', payload); },

  // Missioni / eventi
  async getMissions() { return apiClient.get('/admin/missions'); },
  async createMission(payload) { return apiClient.post('/admin/missions', payload); },
  async updateMission(missionId, payload) { return apiClient.patch(`/admin/missions/${missionId}`, payload); },
  async getEvents() { return apiClient.get('/admin/events'); },
  async createEvent(payload) { return apiClient.post('/admin/events', payload); },
  async updateEvent(eventId, payload) { return apiClient.patch(`/admin/events/${eventId}`, payload); },

  // Log
  async getPackOpeningLogs() { return apiClient.get('/admin/logs/pack-openings'); },
  async getMarketListings() { return apiClient.get('/admin/market/listings'); },
  async getTrades() { return apiClient.get('/admin/trades'); }
};
