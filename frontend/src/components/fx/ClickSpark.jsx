import { useEffect } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

const RAYS = 8;
const DURATION = 420;
const LENGTH = 18;

/**
 * Scintilla che parte da ogni clic.
 *
 * Non avvolge i figli: sta in ascolto sul documento in fase di cattura, cosi' funziona su
 * qualunque elemento senza doverlo modificare, e un handler che ferma la propagazione non
 * la spegne.
 *
 * Le scintille finiscono in un contenitore fisso con pointer-events: none, quindi non
 * intercettano mai un clic successivo.
 */
export default function ClickSpark({ color = '#8B5CF6' }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;

    const layer = document.createElement('div');
    layer.className = 'fx-spark-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    const onPointerDown = (event) => {
      // Solo il tasto principale: il menu contestuale non deve produrre scintille.
      if (event.button !== 0) return;

      const spark = document.createElement('span');
      spark.className = 'fx-spark';
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;

      for (let i = 0; i < RAYS; i++) {
        const ray = document.createElement('i');
        ray.style.setProperty('--angle', `${(360 / RAYS) * i}deg`);
        ray.style.setProperty('--length', `${LENGTH + Math.random() * 10}px`);
        ray.style.background = color;
        spark.appendChild(ray);
      }

      layer.appendChild(spark);
      // Rimozione a tempo invece che su animationend: se la scheda passa in secondo piano
      // l'evento di fine animazione puo' non arrivare mai e il nodo resterebbe appeso.
      setTimeout(() => spark.remove(), DURATION + 60);
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      layer.remove();
    };
  }, [color, reduced]);

  return null;
}
