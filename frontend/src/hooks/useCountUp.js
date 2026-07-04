import { useEffect, useRef, useState } from 'react';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Anima un valore numerico verso `value` ogni volta che cambia (es. saldo gold dopo
 * un acquisto o una missione completata), invece di scattare istantaneamente.
 * displayRef tiene traccia del valore realmente mostrato a schermo (non solo l'ultimo
 * target): se `value` cambia di nuovo a metà di un'animazione, la nuova parte dal punto
 * in cui si trovava quella in corso, senza scatti.
 */
export function useCountUp(value, duration = 600) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    if (typeof value !== 'number' || Number.isNaN(value) || displayRef.current === value) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      displayRef.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- salta l'animazione e allinea subito il valore mostrato al target
      setDisplay(value);
      return undefined;
    }

    const from = displayRef.current;
    const start = performance.now();
    let frameId;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (value - from) * easeOutCubic(progress));
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return display;
}
