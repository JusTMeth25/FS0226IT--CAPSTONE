import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { isLiteDevice } from '../../utils/perfMode.js';

/** Colori delle particelle: gli stessi neon del design system. */
const COLORS = ['139, 92, 246', '236, 72, 153', '34, 211, 238'];

/**
 * Pulviscolo luminoso che sale lentamente dietro all'interfaccia.
 *
 * Disegnato su canvas e non con elementi DOM: cinquanta nodi animati costringerebbero il
 * browser a ricalcolare stile e layer a ogni fotogramma, il canvas invece e' un solo elemento.
 *
 * L'animazione si ferma quando la scheda non e' visibile: un'app di gioco resta aperta a
 * lungo in secondo piano e continuare a disegnare consumerebbe batteria per nulla. Si ferma
 * anche mentre si scorre la pagina (il browser ha gia' abbastanza da fare) e gira a 30
 * fotogrammi al secondo, che per un pulviscolo lento bastano. Su telefoni e computer poco
 * potenti (modalita' leggera) i puntini sono meno della meta'.
 */
export default function Particles({ count = 46 }) {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let particles = [];
    let frame = 0;
    let lastDraw = 0;
    let scrollTimer = 0;
    const amount = isLiteDevice() ? Math.round(count * 0.4) : count;

    // Il canvas viene disegnato alla densita' reale dello schermo, altrimenti su display
    // ad alta risoluzione i puntini risultano sfocati.
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const spawn = (atBottom) => ({
      x: Math.random() * width,
      y: atBottom ? height + Math.random() * 40 : Math.random() * height,
      radius: 0.6 + Math.random() * 1.8,
      speed: 0.12 + Math.random() * 0.38,
      drift: (Math.random() - 0.5) * 0.25,
      alpha: 0.15 + Math.random() * 0.45,
      // La pulsazione parte da una fase casuale, altrimenti tutte le particelle
      // brillerebbero all'unisono e si vedrebbe il trucco.
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    });

    const build = () => {
      particles = Array.from({ length: amount }, () => spawn(false));
    };

    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      // 30 fotogrammi al secondo: i puntini si muovono del doppio per fotogramma.
      if (now - lastDraw < 32) return;
      lastDraw = now;
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y -= p.speed * 2;
        p.x += p.drift * 2;
        p.phase += 0.04;

        if (p.y < -10) Object.assign(p, spawn(true));
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const twinkle = 0.65 + Math.sin(p.phase) * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha * twinkle})`;
        ctx.fill();
      });
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    // Durante lo scorrimento si sta fermi; si riparte poco dopo che la pagina si e' fermata.
    const onScroll = () => {
      stop();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { if (!document.hidden) start(); }, 220);
    };

    resize();
    build();
    start();

    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      clearTimeout(scrollTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count, reduced]);

  if (reduced) return null;

  return <canvas ref={canvasRef} className="fx-particles" aria-hidden="true" />;
}
