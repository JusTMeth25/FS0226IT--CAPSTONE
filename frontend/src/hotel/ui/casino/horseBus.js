/**
 * Stato dell'ippodromo arrivato dal server (messaggi "horse_state" e "horse_win" del WebSocket
 * dell'hotel): HotelPage lo passa qui, la pista (HorseRaceGame) lo ascolta finche' e' aperto.
 */
let last = null;
const listeners = new Set();

export const horseBus = {
  state(race) {
    last = race;
    listeners.forEach((fn) => fn({ type: 'state', race }));
  },
  win(chips, bet) {
    listeners.forEach((fn) => fn({ type: 'win', chips, bet }));
  },
  error(code) {
    listeners.forEach((fn) => fn({ type: 'error', code }));
  },
  last() {
    return last;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
