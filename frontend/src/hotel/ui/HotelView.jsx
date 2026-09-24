import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { HotelViewScene } from '../sprites/hotelView.js';

/** Ogni pixel della scena diventa un quadrato di 2-4 pixel sullo schermo, in base all'altezza. */
function pickScale(height) {
  return Math.max(2, Math.min(4, Math.round(height / 280)));
}

/**
 * Schermata d'ingresso dell'hotel, prima di entrare in una stanza. La scena si ricostruisce
 * quando cambia la dimensione del riquadro e si anima a circa 20 fotogrammi al secondo;
 * con "riduci animazioni" resta un'immagine ferma.
 */
export default function HotelView() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let scene = null;
    let raf = 0;
    let last = 0;

    const build = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (!width || !height) return;
      const scale = pickScale(height);
      const w = Math.ceil(width / scale);
      const h = Math.ceil(height / scale);
      if (scene && scene.w === w && scene.h === h) return;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w * scale}px`;
      canvas.style.height = `${h * scale}px`;
      scene = new HotelViewScene(w, h);
      scene.render(ctx, !reducedMotion);
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!scene || now - last < 50) return;
      const dt = last ? Math.min(now - last, 200) : 50;
      last = now;
      scene.update(dt);
      scene.render(ctx, true);
    };

    const observer = new ResizeObserver(build);
    observer.observe(wrap);
    build();
    if (!reducedMotion) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [reducedMotion]);

  return (
    <div className="hotel-view" ref={wrapRef}>
      <canvas ref={canvasRef} className="hotel-view-canvas" aria-hidden="true" />
      <div className="hotel-view-hint">
        <strong>Benvenuto al VinylDex Hotel</strong>
        <span>Apri <i className="ph-fill ph-compass" /> Stanze per scegliere dove entrare.</span>
      </div>
    </div>
  );
}
