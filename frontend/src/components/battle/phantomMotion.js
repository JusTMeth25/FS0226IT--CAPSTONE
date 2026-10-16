import { useLocation } from 'react-router-dom';

/**
 * Preset di movimento in stile Phantom (Persona 5) per le schermate di gioco.
 *
 * Alcuni componenti che li usano (PackOpeningFlow, il tabellone del torneo) girano anche
 * nell'hotel, dove lo stile Phantom e' spento: usePhantomSkin dice se mostrare gli effetti,
 * con la stessa regola di App.jsx (tutte le pagine tranne /hotel).
 */
export function usePhantomSkin() {
  const { pathname } = useLocation();
  return !pathname.startsWith('/hotel');
}

/** Scatto breve con un filo di rimbalzo: lo stesso della copertina della Home. */
export const SNAP = { type: 'spring', stiffness: 520, damping: 30 };

/** Ingressi laterali dei due schieramenti (VS, confronto del round). */
export const FROM_LEFT = { initial: { x: -90, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: SNAP };
export const FROM_RIGHT = { initial: { x: 90, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: { ...SNAP, delay: 0.07 } };

/** Entrata del pannello di risultato, con la scossa all'impatto solo se si vince. Props per un m.div. */
export function impactProps(shake) {
  return {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1, x: shake ? [0, -12, 10, -6, 3, 0] : 0 },
    transition: {
      opacity: { duration: 0.15 },
      scale: SNAP,
      x: { delay: 0.3, duration: 0.36, ease: 'easeOut' }
    }
  };
}
