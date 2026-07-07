import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Esegue `fetchFn` al mount (e ogni volta che cambia `reloadKey`), esponendo
 * loading/error/data. Pensato per le pagine che dipendono da endpoint backend
 * non ancora completati (Fase 2): l'errore di rete/404 si traduce in uno stato
 * "error" gestito esplicitamente dalla UI, non in un crash silenzioso.
 *
 * `reload({ silent: true })` riesegue il fetch senza rimettere `loading` a true:
 * i dati vecchi restano visibili finché non arrivano quelli nuovi, invece di far
 * sparire l'intera lista dietro uno spinner (utile dopo un'azione rapida come
 * reclamare una missione, dove un flash a schermo intero sembra un refresh di pagina).
 */
export function useApiResource(fetchFn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [reloadKey, setReloadKey] = useState(0);
  const silentRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const silent = silentRef.current;
    silentRef.current = false;
    if (!silent) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }
    fetchFn()
      .then((data) => { if (!cancelled) setState({ loading: false, error: null, data }); })
      .catch((err) => { if (!cancelled) setState((s) => (silent ? { ...s, loading: false, error: err } : { loading: false, error: err, data: null })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  const reload = useCallback((opts = {}) => {
    silentRef.current = !!opts.silent;
    setReloadKey((k) => k + 1);
  }, []);

  return { ...state, reload };
}
