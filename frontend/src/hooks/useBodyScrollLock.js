import { useEffect } from 'react';

/**
 * Blocca lo scroll del body mentre `active` è vero (es. un modal di ispezione carta aperto).
 * Senza questo, su mobile/tablet trascinare il dito sulla carta per l'effetto tilt scorre
 * anche il contenuto sottostante. Ripristina il valore precedente allo smontaggio/chiusura,
 * non un valore fisso, per non rompere un eventuale lock già impostato da altro codice.
 */
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [active]);
}
