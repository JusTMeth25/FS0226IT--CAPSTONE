import { useEffect, useState } from 'react';

/**
 * Segue la preferenza di sistema "riduci animazioni".
 *
 * Il CSS la gestisce gia' da solo con la media query, ma gli effetti disegnati su canvas o
 * creati da JavaScript devono poterla leggere per non partire affatto: un'animazione spenta
 * via CSS continuerebbe comunque a consumare CPU.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setReduced(event.matches);

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
