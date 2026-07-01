import { useCallback, useState } from 'react';

/**
 * useState sincronizzato con localStorage (JSON). Aggiornamento funzionale supportato.
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setAndPersist = useCallback((next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // storage pieno/non disponibile: lo stato in memoria resta comunque aggiornato
      }
      return resolved;
    });
  }, [key]);

  return [value, setAndPersist];
}
