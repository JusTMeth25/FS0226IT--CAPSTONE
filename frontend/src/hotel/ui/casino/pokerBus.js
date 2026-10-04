/**
 * Stato del tavolo del poker arrivato dal server (messaggi "poker_state" del WebSocket dell'hotel):
 * HotelPage lo riceve e lo passa qui, il tavolo (HoldemGame) lo ascolta finche' e' aperto.
 */
let last = null;
const listeners = new Set();

export const pokerBus = {
  state(table) {
    last = table;
    listeners.forEach((fn) => fn({ type: 'state', table }));
  },
  cashout(chips, reason) {
    listeners.forEach((fn) => fn({ type: 'cashout', chips, reason }));
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
