import { Component, Suspense } from 'react';
import { useThreeEnabled } from './useThreeEnabled.js';

/**
 * Isola i crash della scena 3D: se WebGL cade (contesto perso, shader non compilato,
 * texture rifiutata) torna la versione CSS invece della schermata d'errore della pagina.
 */
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('Scena 3D non disponibile, torno agli effetti CSS:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Cancello davanti alle scene three.js.
 *
 * I figli sono componenti caricati in lazy: three e le librerie collegate pesano parecchio e
 * vengono scaricati solo quando una di queste scene viene davvero mostrata. Finche' il codice
 * arriva, e ogni volta che la scena non puo' partire, si vede `fallback` (l'effetto CSS di oggi).
 */
export default function ThreeGate({ fallback, loading, children }) {
  const enabled = useThreeEnabled();
  if (!enabled) return fallback;

  // `loading`, se c'e', occupa lo stesso spazio della scena mentre il codice arriva: la pagina
  // non salta quando la scena compare.
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={loading ?? fallback}>{children}</Suspense>
    </SceneBoundary>
  );
}
