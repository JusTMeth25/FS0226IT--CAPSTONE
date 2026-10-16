import { useState } from 'react';
import { m, useReducedMotion } from 'motion/react';

/**
 * Tendina diagonale al cambio di pagina, come le transizioni dei menu di P5: una scheggia
 * magenta e una nera attraversano lo schermo in un lampo. Solo decorativa (non blocca i clic) e
 * spenta con "riduci animazioni". Non parte al primo caricamento.
 */
export default function PageWipe({ path }) {
  const reduce = useReducedMotion();
  const [prevPath, setPrevPath] = useState(path);
  const [run, setRun] = useState(0);

  // Cambio di pagina: si aggiorna lo stato durante il render (niente effetto in piu').
  if (path !== prevPath) {
    setPrevPath(path);
    if (!reduce) setRun((n) => n + 1);
  }

  if (!run) return null;
  return (
    <div className="p5-wipe" aria-hidden="true" key={run}>
      <m.span
        className="p5-wipe-red"
        initial={{ x: '-110%' }}
        animate={{ x: '110%' }}
        transition={{ duration: 0.42, ease: [0.7, 0, 0.3, 1] }}
        onAnimationComplete={() => setRun(0)}
      />
      <m.span
        className="p5-wipe-ink"
        initial={{ x: '-120%' }}
        animate={{ x: '120%' }}
        transition={{ duration: 0.42, delay: 0.05, ease: [0.7, 0, 0.3, 1] }}
      />
    </div>
  );
}
