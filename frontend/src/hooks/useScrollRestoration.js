import { useEffect, useRef } from 'react';
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
 * Il comportamento segue quello di un sito normale:
 *   - navigazione in avanti (PUSH/REPLACE): si parte dall'inizio
 *   - ritorno (POP): si torna esattamente al punto in cui si era
 */
export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // La chiave e' unica per ogni voce della cronologia: visitare due volte la stessa
  // pagina produce due posizioni distinte, come si aspetta l'utente.
  const positions = useRef(new Map());

  // Registra di continuo la posizione della pagina corrente. Salvarla solo allo
  // smontaggio non basterebbe: quando React smonta la vista lo scorrimento e' gia'
  // stato azzerato dal contenuto piu' corto.
  //
  // La posizione non viene salvata al montaggio: questo effetto gira prima di quello
  // di ripristino qui sotto, e scriverebbe zero sopra al valore da recuperare.
  useEffect(() => {
    // La chiave e' catturata nella chiusura e non letta da un ref: durante un cambio
    // di pagina un evento di scorrimento in ritardo finirebbe altrimenti sulla chiave
    // sbagliata.
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
