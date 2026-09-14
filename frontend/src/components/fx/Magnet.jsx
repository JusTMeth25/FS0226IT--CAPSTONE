import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

/**
 * Il contenuto si sposta verso il puntatore quando gli passa vicino, e torna al suo posto
 * quando si allontana.
 *
 * Solo su dispositivi con un puntatore vero: su touch non esiste un "vicino" prima del
 * contatto, quindi l'effetto non avrebbe modo di manifestarsi.
 *
 * Il contenuto si sposta ma il contenitore resta fermo, cosi' lo spostamento non muove
 * nulla intorno.
 *
 * @param {number} radius quanti pixel oltre il bordo dell'elemento arriva l'attrazione
 * @param {number} strength quanto segue il puntatore, da 0 a 1
 * @param {number} maxOffset spostamento massimo in pixel
 */
export default function Magnet({ children, radius = 70, strength = 0.28, maxOffset = 14, className = '' }) {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return undefined;

    let frame = 0;

    const onMove = (event) => {
      if (frame) cancelAnimationFrame(frame);
      const { clientX, clientY } = event;

      frame = requestAnimationFrame(() => {
        const rect = wrapper.getBoundingClientRect();

        // Distanza dal BORDO dell'elemento, non dal centro. Misurarla dal centro
        // renderebbe la zona di attrazione grande quanto meta' elemento piu' il raggio:
        // su un pulsante largo l'effetto si attiverebbe da mezzo schermo di distanza.
        // Dentro l'elemento entrambe le componenti valgono 0, quindi la distanza e' 0.
        const outsideX = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const outsideY = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        const distance = Math.hypot(outsideX, outsideY);

        if (distance > radius) {
          inner.style.transform = '';
          return;
        }

        // L'attrazione svanisce gradualmente verso il bordo della zona: senza questo
        // il contenuto scatterebbe di colpo appena il puntatore entra nel raggio.
        const falloff = 1 - distance / radius;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clamp = (v) => Math.max(-maxOffset, Math.min(maxOffset, v));
        const offsetX = clamp((clientX - centerX) * strength * falloff);
        const offsetY = clamp((clientY - centerY) * strength * falloff);

        inner.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });
    };

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      inner.style.transform = '';
    };

    // L'ascolto e' sulla finestra e non sull'elemento: l'attrazione deve iniziare prima
    // che il puntatore arrivi sopra al pulsante. Il costo e' contenuto perche' ogni
    // evento si limita a una misura e a una scrittura di stile per fotogramma.
    window.addEventListener('pointermove', onMove, { passive: true });
    // Se il puntatore esce dalla finestra non arrivano piu' eventi: senza questi due
    // il contenuto resterebbe spostato nell'ultima posizione vista.
    document.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);

    return () => {
      reset();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
    };
  }, [radius, strength, maxOffset, reduced]);

  return (
    <span ref={wrapperRef} className={`magnet ${className}`}>
      <span ref={innerRef} className="magnet-inner">{children}</span>
    </span>
  );
}
