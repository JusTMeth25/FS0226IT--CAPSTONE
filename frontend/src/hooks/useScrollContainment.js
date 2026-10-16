import { useEffect } from 'react';

/** Il primo elemento fra target e root che puo' ancora scorrere in quella direzione, o null. */
function scrollableAncestor(target, root, deltaX, deltaY) {
  for (let el = target; el && el !== root.parentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    const canY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const canX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (canY && deltaY !== 0) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return el;
    }
    if (canX && deltaX !== 0) {
      const atLeft = el.scrollLeft <= 0;
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((deltaX < 0 && !atLeft) || (deltaX > 0 && !atRight)) return el;
    }
    if (el === root) break;
  }
  return null;
}

/**
 * Dentro l'area (l'hotel) la rotella del mouse e il dito non fanno scorrere la pagina: scorrono
 * solo i pannelli che hanno ancora qualcosa da mostrare in quella direzione (liste, chat,
 * negozi); arrivati in fondo si fermano li', senza trascinare il sito. Lo zoom della stanza con
 * la rotella e con due dita resta del canvas.
 *
 * I listener sono "non passivi": quelli di React (onWheel, onTouchMove) non possono bloccare lo
 * scorrimento della pagina.
 */
export function useScrollContainment(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let lastTouch = null;

    // Cursori, campi di testo e menu gestiscono da soli il dito e la rotella.
    const isControl = (target) => target instanceof Element && target.closest('input, textarea, select');

    const onWheel = (event) => {
      if (isControl(event.target)) return;
      if (event.ctrlKey) return; // Zoom del browser (o pizzico sul touchpad): non si tocca.
      if (!scrollableAncestor(event.target, root, event.deltaX, event.deltaY)) event.preventDefault();
    };
    const onTouchStart = (event) => {
      const t = event.touches[0];
      lastTouch = t ? { x: t.clientX, y: t.clientY } : null;
    };
    const onTouchMove = (event) => {
      if (isControl(event.target)) return;
      // Due dita: pizzico per lo zoom della stanza, la pagina non deve muoversi.
      if (event.touches.length > 1) {
        event.preventDefault();
        return;
      }
      const t = event.touches[0];
      if (!t || !lastTouch) return;
      // Il dito che sale fa scorrere il contenuto in giu': delta opposto al movimento.
      const deltaX = lastTouch.x - t.clientX;
      const deltaY = lastTouch.y - t.clientY;
      lastTouch = { x: t.clientX, y: t.clientY };
      if (!scrollableAncestor(event.target, root, deltaX, deltaY)) event.preventDefault();
    };

    // Safari (iPhone, iPad, Mac col trackpad) zooma tutta la pagina con questi eventi suoi.
    const onGesture = (event) => event.preventDefault();

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('gesturestart', onGesture, { passive: false });
    root.addEventListener('gesturechange', onGesture, { passive: false });
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('gesturestart', onGesture);
      root.removeEventListener('gesturechange', onGesture);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
    };
  }, [ref]);
}
