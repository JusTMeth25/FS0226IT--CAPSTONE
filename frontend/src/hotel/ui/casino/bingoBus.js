/**
 * Stato del Bingo arrivato dal server (messaggi "bingo_state" e "bingo_win" del WebSocket
 * dell'hotel): HotelPage lo passa qui, il banco del Bingo (BingoGame) lo ascolta finche' e' aperto.
 */
let last = null;
const listeners = new Set();

export const bingoBus = {
  state(bingo) {
    last = bingo;
    listeners.forEach((fn) => fn({ type: 'state', bingo }));
  },
  win(chips, prize) {
    listeners.forEach((fn) => fn({ type: 'win', chips, prize }));
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
