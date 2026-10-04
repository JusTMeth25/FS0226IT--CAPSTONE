import { useEffect, useRef, useSyncExternalStore } from 'react';
import { gamepad } from './gamepad.js';

const ARROWS = { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };
// Corsie dei giochi musicali (verde, rosso, giallo, blu, arancio), come Clone Hero col controller.
const LANES = ['A', 'B', 'Y', 'X', 'LB'];

/**
 * Tasti del controller per un minigioco, ricavati dai suoi tasti della tastiera:
 * - croce/levetta = frecce;
 * - A (e RT) = spazio/Invio, l'azione principale; senza, A e RT fanno "su" (il gas) e LT "giu'" (il freno);
 * - giochi a corsie (A S D F G): A, B, Y, X, LB e, se le frecce sono libere, anche la croce.
 */
export function padBindings(game) {
  const keys = game?.keys || {};
  const map = {};
  Object.entries(ARROWS).forEach(([button, key]) => {
    if (keys[key] !== undefined) map[button] = keys[key];
  });
  const fire = keys[' '] ?? keys.Enter;
  const lanes = [...new Set(Object.values(keys).filter((a) => typeof a === 'number' && !Object.values(map).includes(a)))].sort((a, b) => a - b);
  if (lanes.length) {
    lanes.forEach((lane, i) => { if (LANES[i]) map[LANES[i]] = lane; });
    if (!map.LEFT && lanes.length >= 4) {
      map.LEFT = lanes[0];
      map.DOWN = lanes[1];
      map.UP = lanes[2];
      map.RIGHT = lanes[3];
    }
    if (fire !== undefined) {
      map.RT = fire;
      map.LT = fire;
    }
  } else if (fire !== undefined) {
    map.A = fire;
    map.RT = fire;
  } else if (typeof map.UP !== 'number') {
    // Le frecce numeriche sono corsie (giochi di ballo): li' A e RT non fanno nulla.
    if (map.UP !== undefined) {
      map.A = map.UP;
      map.RT = map.UP;
    }
    if (map.DOWN !== undefined) {
      map.LT = map.DOWN;
      map.X = map.DOWN;
    }
  }
  return map;
}

/** Legenda per l'utente: per ogni azione (con l'etichetta dei pulsanti del gioco) i tasti. */
export function padLegend(game, map = padBindings(game)) {
  const byAction = new Map();
  Object.entries(map).forEach(([button, action]) => {
    if (!byAction.has(action)) byAction.set(action, []);
    byAction.get(action).push(button);
  });
  const label = (action) => {
    const b = (game?.buttons || []).find(([a]) => a === action);
    return b ? b[1] : String(action);
  };
  return [...byAction.entries()].map(([action, buttons]) => ({ action, label: label(action), buttons }));
}

/**
 * Collega il controller al minigioco mentre si gioca: i tasti mappati vanno al gioco (premuto e
 * rilasciato, per le azioni da tenere come lo sterzo), Menu esce; gli altri tasti si ignorano
 * per non chiudere il gioco per sbaglio.
 */
export function usePadControls(game, playing, act, release, onExit) {
  const fns = useRef({ act, release, onExit });
  useEffect(() => { fns.current = { act, release, onExit }; });
  useEffect(() => {
    if (!playing || !game) return undefined;
    const map = padBindings(game);
    const held = new Map();
    const off = gamepad.subscribe((event) => {
      if (event.type === 'axes') return false;
      const action = map[event.button];
      if (event.type === 'down' && event.button === 'MENU') {
        fns.current.onExit?.();
        return true;
      }
      if (event.button === 'Y' && action === undefined) return false;
      if (action === undefined) return true;
      if (event.type === 'down') {
        held.set(event.button, action);
        fns.current.act(action);
      } else if (event.type === 'up') {
        held.delete(event.button);
        // Un'azione tenuta da due tasti (A e RT per il gas) si rilascia solo all'ultimo.
        if (![...held.values()].includes(action)) fns.current.release(action);
      }
      return true;
    }, 80);
    return () => {
      off();
      held.forEach((action) => fns.current.release(action));
    };
  }, [game, playing]);
}

/** Controller collegato ({ kind }) oppure null, aggiornato al collegamento e allo scollegamento. */
export function usePadStatus() {
  return useSyncExternalStore((cb) => gamepad.onStatus(cb), () => gamepad.status(), () => null);
}
