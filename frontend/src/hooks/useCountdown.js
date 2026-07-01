import { useEffect, useState } from 'react';

/**
 * Ricalcola `remainingMs` ogni secondo finché non arriva a 0.
 * `getRemaining` viene richiamato ad ogni tick (permette al valore sorgente di cambiare).
 */
export function useCountdown(getRemaining) {
  const [remaining, setRemaining] = useState(getRemaining());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- risincronizza subito il countdown quando cambia la sorgente
    setRemaining(getRemaining());
    if (getRemaining() <= 0) return undefined;

    const interval = setInterval(() => {
      const next = getRemaining();
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [getRemaining]);

  return remaining;
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
