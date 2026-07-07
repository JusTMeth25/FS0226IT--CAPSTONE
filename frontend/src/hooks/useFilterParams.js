import { useSearchParams } from 'react-router-dom';

/**
 * Filtri/ordinamento sincronizzati con la query string invece che con useState locale:
 * navigando a una pagina di dettaglio e tornando indietro, l'URL (e quindi i filtri) sopravvive,
 * a differenza di uno stato interno che si resetta ad ogni remount del componente.
 * `replace: true` evita di riempire la cronologia con un'entry per ogni modifica ai filtri.
 */
export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  function getParam(key, fallback = '') {
    return searchParams.get(key) || fallback;
  }

  function setParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }

  function resetParams(keys) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  }

  return { getParam, setParam, resetParams };
}
