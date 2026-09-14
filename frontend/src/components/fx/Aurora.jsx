import { useReducedMotion } from '../../hooks/useReducedMotion.js';

/**
 * Aurora boreale di sfondo, fissa dietro a tutta l'applicazione.
 *
 * Sono tre macchie di gradiente sfocate che si muovono lentamente. L'animazione e' solo CSS
 * su transform e opacity, quindi resta sul compositor e non fa ridisegnare il layout.
 *
 * Con "riduci animazioni" attivo le macchie restano ferme invece di sparire: il colore di
 * fondo fa comunque parte dell'identita' visiva, e' il movimento a essere di troppo.
 */
export default function Aurora() {
  const reduced = useReducedMotion();

  return (
    <div className={`aurora${reduced ? ' aurora-still' : ''}`} aria-hidden="true">
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
      <span className="aurora-grid" />
      <span className="aurora-vignette" />
    </div>
  );
}
