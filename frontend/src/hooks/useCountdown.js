import { useEffect, useState } from 'react';

function remainingFrom(targetTimestamp) {
  if (!targetTimestamp) return 0;
  return Math.max(0, targetTimestamp - Date.now());
}

/**
 * Conto alla rovescia fino a `targetTimestamp` (epoch ms assoluto, o falsy se non attivo),
 * aggiornato ogni secondo. Riceve un VALORE primitivo (non una funzione): passare invece una
 * closure ricreata ad ogni render romperebbe la dependency array dell'effect e causerebbe un
 * loop di render infinito, perché il valore calcolato cambia di continuo (basato su Date.now()).
 */
export function useCountdown(targetTimestamp) {
  const [remaining, setRemaining] = useState(() => remainingFrom(targetTimestamp));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- risincronizza subito il countdown quando cambia il target
    setRemaining(remainingFrom(targetTimestamp));
    if (remainingFrom(targetTimestamp) <= 0) return undefined;

    const interval = setInterval(() => {
      const next = remainingFrom(targetTimestamp);
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return remaining;
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
