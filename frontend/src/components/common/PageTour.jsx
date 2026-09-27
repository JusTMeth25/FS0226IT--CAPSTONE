import { useEffect, useState } from 'react';

/**
 * Giro guidato delle pagine principali alla prima visita (l'hotel ha il suo tutorial).
 * Ogni passo evidenzia un pezzo della pagina con un anello e spiega a cosa serve.
 * Visto una volta, non si ripresenta (localStorage, per browser).
 */
const TOURS = {
  '/packs': [
    { target: '.gold-display', title: 'I tuoi gold', text: 'Con i gold compri i pacchetti. Li guadagni con missioni, battaglie, minigiochi e vendendo carte.' },
    { target: '.pity-bar', title: 'Leggendaria garantita', text: 'Ogni pacchetto senza leggendaria riempie questa barra: dal 20° la probabilità sale, al 40° la leggendaria è sicura.' },
    { target: '.packs-grid .pack-card', title: 'Scegli un pacchetto', text: 'Il Pacchetto Base è gratis ogni 4 ore. Gli altri costano gold: più carte e rarità garantite.' }
  ],
  '/collection': [
    { target: '.collection-stats', title: 'La tua collezione', text: 'Carte uniche, completamento dell\'album e valore stimato ai prezzi di mercato.' },
    { target: '.collection-filters', title: 'Filtri', text: 'Filtra per classe, rarità e gioco e ordina come preferisci. I filtri restano anche tornando indietro.' },
    { target: '.collection-grid', title: 'Le carte', text: 'Clicca una carta per vederla in 3D, farla valutare dal perito o metterla nei desideri.' }
  ],
  '/battle': [
    { target: '.battle-team-slots', title: 'La squadra', text: 'Scegli tre carte: ogni round si sfidano su una statistica (Fans, Style, Influence, Energy).' },
    { target: '.battle-available-grid', title: 'Le tue carte', text: 'Clicca una carta per metterla nello slot evidenziato. Con tre carte puoi salvare la squadra con un nome.' },
    { target: '.battle-mode-actions', title: 'Si parte', text: 'Battaglia singola o torneo contro tre avversari sempre più forti, con premi in gold ed esperienza.' }
  ],
  '/binder': [
    { target: '.binder-controls', title: 'Un raccoglitore per gioco', text: 'Scegli il gioco o un set: ogni raccoglitore ha la sua copertina.' },
    { target: '.binder-3d-wrap, .binder', title: 'Sfoglia', text: 'Trascina di lato, usa le frecce della tastiera o i bottoni sotto per girare pagina. Le carte che mancano sono in ombra.' },
    { target: '.binder-nav', title: 'Pagine', text: 'Qui vedi a che pagina sei. Clicca una carta per aprirne il dettaglio, anche se non ce l\'hai.' }
  ]
};

const seenKey = (path) => `vinyldex_tour_${path.replace('/', '')}`;

function seen(path) {
  try {
    return localStorage.getItem(seenKey(path)) === '1';
  } catch {
    return true;
  }
}

function markSeen(path) {
  try {
    localStorage.setItem(seenKey(path), '1');
  } catch {
    // niente: il giro si ripresentera'
  }
}

export default function PageTour({ path }) {
  const steps = TOURS[path];
  const [state, setState] = useState({ path: null, step: 0, rect: null });
  const active = state.path === path && steps;

  // Alla prima visita di una pagina con un giro, si aspetta che il primo pezzo sia sullo schermo.
  useEffect(() => {
    if (!steps || seen(path)) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const el = document.querySelector(steps[0].target);
      if (el || tries > 30) {
        clearInterval(timer);
        if (el) setState({ path, step: 0, rect: null });
      }
    }, 300);
    return () => clearInterval(timer);
  }, [path, steps]);

  // Posizione del pezzo evidenziato, aggiornata allo scroll e al ridimensionamento.
  useEffect(() => {
    if (!active) return undefined;
    const el = document.querySelector(steps[state.step].target);
    if (!el) return undefined;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const update = () => setState((s) => ({ ...s, rect: el.getBoundingClientRect() }));
    const timer = setTimeout(update, 350);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { clearTimeout(timer); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [active, state.step, steps]);

  if (!active) return null;
  const close = () => { markSeen(path); setState({ path: null, step: 0, rect: null }); };
  const next = () => (state.step + 1 >= steps.length ? close() : setState((s) => ({ ...s, step: s.step + 1, rect: null })));
  const current = steps[state.step];
  const rect = state.rect;
  const pad = 8;
  const below = rect ? rect.bottom + 180 < window.innerHeight : true;
  const tipStyle = rect
    ? { top: below ? rect.bottom + pad + 10 : Math.max(12, rect.top - pad - 170), left: Math.min(Math.max(12, rect.left), window.innerWidth - 332) }
    : { top: '40%', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div className="page-tour" role="dialog" aria-label={`Guida: ${current.title}`}>
      {rect && (
        <div className="page-tour-ring" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: Math.min(rect.height + pad * 2, window.innerHeight) }} />
      )}
      <div className="page-tour-tip glass-panel" style={tipStyle}>
        <span className="page-tour-step">{state.step + 1} / {steps.length}</span>
        <strong>{current.title}</strong>
        <p>{current.text}</p>
        <div className="page-tour-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={close}>Salta</button>
          <button type="button" className="btn btn-primary btn-small" onClick={next}>{state.step + 1 >= steps.length ? 'Fine' : 'Avanti'}</button>
        </div>
      </div>
    </div>
  );
}
