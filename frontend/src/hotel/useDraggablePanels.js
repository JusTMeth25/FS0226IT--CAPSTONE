import { useEffect } from 'react';

/**
 * Pannelli dell'hotel trascinabili: si prendono per la testata (.hotel-panel-header, o quella del
 * casino) e si spostano col mouse o col dito, cosi' non coprono l'avatar o la parte di stanza che interessa.
 *
 * Un solo ascoltatore per tutta la pagina: vale per ogni pannello, anche quelli aperti dopo.
 * Lo spostamento usa la proprieta' CSS `translate`, che si somma al `transform` con cui i
 * pannelli sono centrati; resta finche' il pannello e' aperto e non esce dal riquadro della pagina.
 */
export default function useDraggablePanels(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let drag = null;

    const onDown = (event) => {
      const header = event.target.closest?.('.hotel-panel-header, .casino-header');
      if (!header || event.button > 0) return;
      // I pulsanti della testata (chiudi, schede) restano cliccabili.
      if (event.target.closest('button, a, input, select, textarea')) return;
      const panel = header.closest('.hotel-panel');
      if (!panel) return;
      const [tx = 0, ty = 0] = (panel.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
      drag = { panel, startX: event.clientX, startY: event.clientY, tx, ty, rect: panel.getBoundingClientRect(), bounds: root.getBoundingClientRect() };
      header.setPointerCapture?.(event.pointerId);
      panel.classList.add('is-dragging');
      event.preventDefault();
    };

    const onMove = (event) => {
      if (!drag) return;
      const { rect, bounds } = drag;
      // Il pannello resta dentro la pagina: almeno 60 pixel della testata sempre visibili.
      const dx = Math.max(bounds.left - rect.right + 60, Math.min(bounds.right - rect.left - 60, event.clientX - drag.startX));
      const dy = Math.max(bounds.top - rect.top, Math.min(bounds.bottom - rect.top - 40, event.clientY - drag.startY));
      drag.panel.style.translate = `${Math.round(drag.tx + dx)}px ${Math.round(drag.ty + dy)}px`;
    };

    const onUp = () => {
      if (!drag) return;
      drag.panel.classList.remove('is-dragging');
      drag = null;
    };

    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [rootRef]);
}
