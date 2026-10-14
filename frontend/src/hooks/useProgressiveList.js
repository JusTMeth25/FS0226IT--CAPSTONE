import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lista lunga mostrata a blocchi: all'inizio `step` elementi, poi altri `step` ogni volta che la
 * sentinella in fondo alla griglia si avvicina allo schermo. Con migliaia di carte (collezione,
 * set, scelta della squadra) disegnarle tutte insieme fa finire la memoria del telefono: Safari su
 * iPhone chiude la pagina con "si e' verificato ripetutamente un errore".
 *
 * `resetKey` cambia con i filtri: si riparte dal primo blocco.
 */
export function useProgressiveList(items, { step = 48, resetKey } = {}) {
  const [limit, setLimit] = useState(step);
  const [shownFor, setShownFor] = useState(resetKey);
  if (shownFor !== resetKey) {
    setShownFor(resetKey);
    setLimit(step);
  }
  const observer = useRef(null);
  const total = items.length;

  const sentinelRef = useCallback((node) => {
    observer.current?.disconnect();
    if (!node || typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((n) => Math.min(n + step, Math.max(total, step)));
    }, { rootMargin: '1200px 0px' });
    observer.current.observe(node);
  }, [step, total]);

  useEffect(() => () => observer.current?.disconnect(), []);

  return {
    visible: limit >= total ? items : items.slice(0, limit),
    hasMore: limit < total,
    sentinelRef
  };
}
