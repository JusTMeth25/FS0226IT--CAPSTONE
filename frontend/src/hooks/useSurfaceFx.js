import { useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion.js';

const PANEL_SELECTOR = '.glass-panel';
const REVEALED = 'fx-revealed';

/**
 * Aggiunge due effetti a tutti i pannelli di vetro dell'applicazione:
 *
 *   - un alone che segue il puntatore sulla superficie del pannello
 *   - una comparsa dal basso quando il pannello entra nello schermo
 *
 * Vive in un hook globale invece che dentro un componente involucro perche' i pannelli sono
 * sparsi in quattordici pagine: avvolgerli uno per uno significherebbe toccare ogni file, e
 * ogni pannello aggiunto in futuro andrebbe ricordato. Cosi' l'effetto si applica da solo.
 *
 * L'alone usa un solo ascoltatore delegato sul contenitore, non uno per pannello: con molti
 * pannelli visibili la differenza si sente.
 *
 * @param {import('react').RefObject<HTMLElement>} containerRef contenitore da osservare
 * @param {string} routeKey cambia a ogni navigazione, per riesaminare la pagina nuova
 */
export function useSurfaceFx(containerRef, routeKey) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // ---- Comparsa allo scroll -------------------------------------------

    let observer = null;

    if (!reduced && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add(REVEALED);
            // Una volta comparso resta comparso: rianimarlo a ogni passaggio
            // renderebbe lo scorrimento nervoso.
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
      );
    }

    const enhance = () => {
      container.querySelectorAll(PANEL_SELECTOR).forEach((panel, index) => {
        if (panel.dataset.fx === '1') return;
        panel.dataset.fx = '1';

        if (!reduced && observer) {
          // Piccolo sfalsamento fra pannelli vicini: entrano a cascata invece che in blocco.
          panel.style.setProperty('--fx-delay', `${Math.min(index, 6) * 60}ms`);
          panel.classList.add('fx-reveal');
          observer.observe(panel);
        }
      });
    };

    enhance();

    // I pannelli compaiono anche dopo il primo render, quando arrivano i dati dal server.
    const mutations = new MutationObserver(enhance);
    mutations.observe(container, { childList: true, subtree: true });

    // ---- Alone che segue il puntatore -----------------------------------

    let pending = null;
    let lastPanel = null;

    const applyGlow = (panel, x, y) => {
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty('--fx-x', `${x - rect.left}px`);
      panel.style.setProperty('--fx-y', `${y - rect.top}px`);
      panel.classList.add('fx-glow');
    };

    const onPointerMove = (event) => {
      const panel = event.target.closest ? event.target.closest(PANEL_SELECTOR) : null;

      if (lastPanel && lastPanel !== panel) {
        lastPanel.classList.remove('fx-glow');
      }
      lastPanel = panel;
      if (!panel) return;

      // Una sola scrittura di stile per fotogramma: il puntatore genera molti piu' eventi
      // di quanti il browser possa disegnare.
      if (pending) cancelAnimationFrame(pending);
      const { clientX, clientY } = event;
      pending = requestAnimationFrame(() => applyGlow(panel, clientX, clientY));
    };

    const onPointerLeave = () => {
      if (lastPanel) lastPanel.classList.remove('fx-glow');
      lastPanel = null;
    };

    // Solo dispositivi con un puntatore vero: su touch l'alone resterebbe acceso
    // dove si e' toccato l'ultima volta.
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (finePointer) {
      container.addEventListener('pointermove', onPointerMove);
      container.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      if (pending) cancelAnimationFrame(pending);
      mutations.disconnect();
      if (observer) observer.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [containerRef, routeKey, reduced]);
}
