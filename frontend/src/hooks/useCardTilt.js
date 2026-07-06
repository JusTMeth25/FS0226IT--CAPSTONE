import { useCallback, useMemo, useRef, useState } from 'react';

function neutralStyle() {
  return {
    '--x': '50%',
    '--y': '50%',
    '--holo-opacity': 0,
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  };
}

/**
 * Tilt 3D + coordinate del puntatore (per l'effetto holo) su un elemento carta.
 * Aggiorna solo custom property CSS + transform (nessun reflow), quindi resta fluido
 * anche con più istanze a schermo. Supporta mouse e touch (trascinamento sulla carta).
 * `scale` controlla l'intensità del "pop" al passaggio del puntatore.
 */
export function useCardTilt({ maxTilt = 12, scale = 1.03 } = {}) {
  const ref = useRef(null);
  const [style, setStyle] = useState(neutralStyle);
  const [active, setActive] = useState(false);
  const neutral = useMemo(() => neutralStyle(), []);

  const applyFromPoint = useCallback((clientX, clientY) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    const rotateY = ((x - 50) / 50) * maxTilt;
    const rotateX = ((y - 50) / 50) * -maxTilt;

    setStyle({
      '--x': `${x}%`,
      '--y': `${y}%`,
      '--holo-opacity': 1,
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`
    });
  }, [maxTilt, scale]);

  const onMouseMove = useCallback((e) => applyFromPoint(e.clientX, e.clientY), [applyFromPoint]);
  const onMouseEnter = useCallback(() => setActive(true), []);
  const onMouseLeave = useCallback(() => { setActive(false); setStyle(neutral); }, [neutral]);

  const onTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    if (touch) { setActive(true); applyFromPoint(touch.clientX, touch.clientY); }
  }, [applyFromPoint]);
  const onTouchEnd = useCallback(() => { setActive(false); setStyle(neutral); }, [neutral]);

  return {
    ref,
    style,
    active,
    handlers: { onMouseMove, onMouseEnter, onMouseLeave, onTouchMove, onTouchEnd }
  };
}
