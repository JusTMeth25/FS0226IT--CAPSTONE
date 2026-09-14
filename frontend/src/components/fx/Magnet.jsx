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
 * @param {number} radius distanza in pixel entro cui l'attrazione si fa sentire
 * @param {number} strength quanto segue il puntatore, da 0 a 1
 */
export default function Magnet({ children, radius = 90, strength = 0.35, className = '' }) {
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
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;

        if (Math.hypot(dx, dy) > radius + Math.max(rect.width, rect.height) / 2) {
          inner.style.transform = '';
          return;
        }
        inner.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
    };

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      inner.style.transform = '';
    };

    // L'ascolto e' sulla finestra e non sull'elemento: l'attrazione deve iniziare
    // prima che il puntatore arrivi sopra al pulsante.
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      inner.style.transform = '';
    };
  }, [radius, strength, reduced]);

  return (
    <span ref={wrapperRef} className={`magnet ${className}`}>
      <span ref={innerRef} className="magnet-inner">{children}</span>
    </span>
  );
}
