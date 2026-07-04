import { useEffect, useRef } from 'react';

function easeOutQuad(t) {
  return t * (2 - t);
}

/**
 * Overlay canvas che spara un'unica esplosione di scintille dal centro verso l'esterno
 * al momento del mount. Va inserito come figlio di un contenitore con position:relative
 * (es. una carta appena rivelata nell'apertura pacchetto).
 */
export default function RevealSpark({ color = '#fff', count = 8, radius = 40, size = 8, duration = 500 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const { width, height } = parent.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const cy = height / 2;

    const sparks = Array.from({ length: count }, (_, i) => (2 * Math.PI * i) / count + Math.random() * 0.3);
    const start = performance.now();
    let frameId;

    const draw = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutQuad(progress);
      ctx.clearRect(0, 0, width, height);

      if (progress < 1) {
        sparks.forEach((angle) => {
          const distance = eased * radius;
          const lineLength = size * (1 - eased);
          const x1 = cx + distance * Math.cos(angle);
          const y1 = cy + distance * Math.sin(angle);
          const x2 = cx + (distance + lineLength) * Math.cos(angle);
          const y2 = cy + (distance + lineLength) * Math.sin(angle);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });
        frameId = requestAnimationFrame(draw);
      }
    };
    frameId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frameId);
  }, [color, count, radius, size, duration]);

  return <canvas ref={canvasRef} className="reveal-spark-canvas" />;
}
