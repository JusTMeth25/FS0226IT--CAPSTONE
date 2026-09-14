import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Quanti fotogrammi riprovare prima di arrendersi (circa mezzo secondo a 60fps). */
const MAX_ATTEMPTS = 30;

/**
 * Riporta la pagina dov'era quando ci si torna con "indietro".
 *
 * Serve perche' questa applicazione usa HashRouter con Routes: ScrollRestoration di
 * react-router funziona solo con i router a dati, e il ripristino nativo del browser non
 * puo' agire perche' il contenuto viene ricreato da React dopo il cambio di indirizzo.
 *
 * Comportamento:
 *   - navigazione in avanti (PUSH/REPLACE): si parte dall'inizio
 *   - ritorno (POP): si torna al punto in cui si era
 */
export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Una posizione per ogni voce della cronologia: visitare due volte la stessa pagina
  // produce due posizioni distinte, come si aspetta l'utente.
  const positions = useRef(new Map());

  useEffect(() => {
    // Il browser proverebbe a ripristinare per conto suo e finirebbe per litigare con
    // questo hook, perche' non sa che il contenuto arriva dopo.
    const previous = window.history.scrollRestoration;
    if (previous) window.history.scrollRestoration = 'manual';
    return () => {
      if (previous) window.history.scrollRestoration = previous;
    };
  }, []);

  // useLayoutEffect e non useEffect, ed e' il perno di tutto l'hook.
  //
  // Cambiando pagina React smonta la vista precedente: il documento si accorcia e il
  // browser riduce lo scorrimento, mettendo in coda un evento scroll. Quell'evento
  // salverebbe zero sopra alla posizione buona, un istante prima che serva.
  //
  // La pulizia di un effetto di layout avviene dentro la fase di commit, in modo
  // sincrono, mentre l'evento in coda viene emesso solo al passo di rendering
  // successivo. Staccando qui l'ascoltatore, quell'evento non trova piu' nessuno.
  // Con useEffect la pulizia e' asincrona e la corsa si perde.
  useLayoutEffect(() => {
    const key = location.key;
    const save = () => positions.current.set(key, window.scrollY);

    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location.key]);

  useEffect(() => {
    const target = navigationType === 'POP' ? (positions.current.get(location.key) ?? 0) : 0;

    if (target === 0) {
      window.scrollTo(0, 0);
      return undefined;
    }

    // Il ripristino non puo' avvenire in un colpo solo: al primo fotogramma la pagina
    // e' ancora corta, perche' la collezione carica le carte dal server. Si riprova a
    // ogni fotogramma finche' non e' abbastanza alta da contenere quella posizione.
    let attempts = 0;
    let frame = 0;

    const tryRestore = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      if (maxScroll >= target) {
        window.scrollTo(0, target);
        return;
      }
      if (++attempts < MAX_ATTEMPTS) {
        frame = requestAnimationFrame(tryRestore);
      } else {
        // I dati non sono arrivati in tempo o la pagina e' davvero piu' corta:
        // si va il piu' in basso possibile invece di restare in cima.
        window.scrollTo(0, Math.max(0, maxScroll));
      }
    };

    frame = requestAnimationFrame(tryRestore);
    return () => cancelAnimationFrame(frame);
  }, [location.key, navigationType]);
}
