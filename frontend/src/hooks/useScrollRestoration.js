import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'vinyldex:scroll-positions';

/** Per quanto continuare a rimettere la pagina al suo posto dopo un ritorno. */
const ENFORCE_MS = 900;

/** Scarto oltre il quale vale la pena ricorreggere: sotto e' rumore di arrotondamento. */
const TOLERANCE_PX = 2;

/** Eventi che significano "sto scorrendo io": da li' in poi il ripristino non interviene piu'. */
const USER_INTENT = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/**
 * Salto immediato, mai animato.
 *
 * global.css imposta scroll-behavior: smooth su html, che vale anche per gli
 * spostamenti da codice. Un ripristino animato e' gia' sbagliato di suo, ma soprattutto
 * ogni nuova chiamata fa ripartire l'animazione da capo: riaffermando la posizione a
 * ogni fotogramma, lo scorrimento morbido non arriverebbe mai a destinazione e la
 * pagina resterebbe dov'era.
 */
function jumpTo(top) {
  window.scrollTo({ top, left: 0, behavior: 'instant' });
}

/** Attivabile da console con localStorage.setItem('vinyldex:debug-scroll', '1'). */
function debugLog(...args) {
  try {
    if (localStorage.getItem('vinyldex:debug-scroll') === '1') console.log('[scroll]', ...args);
  } catch {
    // Archiviazione negata: nessuna diagnostica, nessun errore.
  }
}

function readStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    // Navigazione privata o archiviazione negata: si prosegue senza memoria fra i ricaricamenti.
    return {};
  }
}

function writeStored(positions) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Spazio esaurito o archiviazione negata: il ripristino resta valido per la sessione corrente.
  }
}

/**
 * Riporta la pagina dov'era quando ci si torna con "indietro".
 *
 * ScrollRestoration di react-router non e' utilizzabile: funziona solo con i router a
 * dati, mentre qui c'e' HashRouter con Routes. E il ripristino nativo del browser non
 * puo' agire, perche' il contenuto viene ricreato da React dopo il cambio di indirizzo.
 *
 * Tre accorgimenti, ognuno contro un modo diverso di perdere la posizione:
 *
 *   1. l'ascoltatore si stacca in un effetto di layout, prima che l'evento emesso
 *      dall'accorciarsi della pagina possa salvare zero sopra al valore buono;
 *   2. le posizioni stanno in sessionStorage e non solo in memoria, cosi' sopravvivono
 *      anche se l'albero viene rimontato, per esempio mentre si verifica la sessione;
 *   3. dopo un ritorno la posizione viene riaffermata per quasi un secondo, perche'
 *      immagini che arrivano e riquadri che si dimensionano possono spostarla dopo.
 *
 * Il terzo punto si disattiva al primo gesto dell'utente: se decide lui di scorrere,
 * la pagina non deve piu' tirare da un'altra parte.
 */
export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Copia in memoria, per non rileggere e riscrivere l'archiviazione a ogni evento.
  const positions = useRef(readStored());

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    if (previous) window.history.scrollRestoration = 'manual';
    return () => {
      if (previous) window.history.scrollRestoration = previous;
    };
  }, []);

  // useLayoutEffect e non useEffect: la pulizia avviene dentro la fase di commit, in modo
  // sincrono. Cambiando pagina il documento si accorcia, il browser riduce lo scorrimento
  // e mette in coda un evento che verrebbe emesso solo al passo di rendering successivo:
  // a quel punto questo ascoltatore non c'e' gia' piu'. Con un effetto normale la pulizia
  // e' asincrona, l'evento la precede e sovrascrive la posizione con zero.
  useLayoutEffect(() => {
    const key = location.key;
    // La mappa e' la stessa per tutta la vita del componente: catturarla qui evita di
    // leggere il ref dentro la pulizia, dove il suo valore potrebbe in teoria essere
    // gia' cambiato.
    const store = positions.current;
    let flushTimer = 0;

    const save = () => {
      store[key] = window.scrollY;
      debugLog('salvo', key, window.scrollY);
      // L'archiviazione si aggiorna al massimo ogni duecento millisecondi: scriverla a
      // ogni evento di scorrimento costerebbe piu' dell'effetto che si vuole ottenere.
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = 0;
          writeStored(store);
        }, 200);
      }
    };

    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      if (flushTimer) clearTimeout(flushTimer);
      writeStored(store);
    };
  }, [location.key]);

  useEffect(() => {
    const target = navigationType === 'POP' ? (positions.current[location.key] ?? 0) : 0;
    debugLog('ripristino', { key: location.key, navigationType, target, noti: Object.keys(positions.current) });

    if (target === 0) {
      jumpTo(0);
      return undefined;
    }

    let frame = 0;
    let stopped = false;
    const startedAt = performance.now();

    const stop = () => { stopped = true; };
    USER_INTENT.forEach((event) => window.addEventListener(event, stop, { passive: true, once: true }));

    const enforce = () => {
      if (stopped) return;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      // Finche' la pagina e' troppo corta non si puo' arrivare a destinazione: si aspetta
      // che il contenuto finisca di arrivare invece di atterrare in un punto sbagliato.
      if (maxScroll >= target && Math.abs(window.scrollY - target) > TOLERANCE_PX) {
        jumpTo(target);
      }

      if (performance.now() - startedAt < ENFORCE_MS) {
        frame = requestAnimationFrame(enforce);
      } else if (maxScroll < target) {
        // Il contenuto non e' mai cresciuto abbastanza: meglio il punto piu' basso
        // raggiungibile che restare in cima.
        jumpTo(Math.max(0, maxScroll));
      }
    };

    frame = requestAnimationFrame(enforce);

    return () => {
      cancelAnimationFrame(frame);
      USER_INTENT.forEach((event) => window.removeEventListener(event, stop));
    };
  }, [location.key, navigationType]);
}
