import { useCallback, useEffect, useState } from 'react';

/**
 * Esegue `fetchFn` al mount (e ogni volta che cambia `reloadKey`), esponendo
 * loading/error/data. Pensato per le pagine che dipendono da endpoint backend
 * non ancora completati (Fase 2): l'errore di rete/404 si traduce in uno stato
 * "error" gestito esplicitamente dalla UI, non in un crash silenzioso.
 */
export function useApiResource(fetchFn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset del flag loading ad ogni fetch (mount/reload/deps)
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchFn()
      .then((data) => { if (!cancelled) setState({ loading: false, error: null, data }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: err, data: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
}
