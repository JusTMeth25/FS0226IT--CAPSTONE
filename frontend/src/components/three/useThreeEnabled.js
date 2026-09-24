import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

let webglSupport = null;

/**
 * Verifica una sola volta che il dispositivo sappia creare un contesto WebGL2.
 *
 * Il risultato resta in memoria: creare un contesto costa, e su alcuni WebView Android i
 * contesti disponibili sono pochi. Quello di prova viene rilasciato subito.
 */
export function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webglSupport = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/**
 * Dice se le scene three.js possono partire: servono WebGL e nessuna richiesta di
 * "riduci animazioni". Altrimenti le pagine restano sugli effetti CSS.
 */
export function useThreeEnabled() {
  const reduced = useReducedMotion();
  return !reduced && hasWebGL();
}

/**
 * Segue la visibilita' della scheda: le scene passano a frameloop "never" quando l'app
 * e' in secondo piano, per non consumare batteria disegnando fotogrammi che nessuno vede.
 */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}
