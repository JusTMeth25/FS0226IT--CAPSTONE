import { useEffect, useRef } from 'react';
import { BLOCKS, HALF, LAPS, TRACK, TRACK_LENGTH, pointAtDistance } from './streetWorld.js';

/** Gara in citta' vista dall'alto: la telecamera segue l'auto, palazzi, strada, avversari. */
const W = 560;
const H = 340;
const SCALE = 0.42;

function car(ctx, x, y, angle, color, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const l = 58 * scale;
  const w = 28 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-l / 2 + 3, -w / 2 + 3, l, w);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-l / 2, -w / 2, l, w, 6 * scale);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 30, 50, 0.85)';
  ctx.fillRect(-l * 0.05, -w * 0.38, l * 0.22, w * 0.76);
  ctx.fillRect(-l * 0.38, -w * 0.34, l * 0.12, w * 0.68);
  ctx.fillStyle = '#fff7c2';
  ctx.fillRect(l / 2 - 3 * scale, -w * 0.4, 3 * scale, w * 0.22);
  ctx.fillRect(l / 2 - 3 * scale, w * 0.18, 3 * scale, w * 0.22);
  ctx.restore();
}

function formatTime(ms) {
  const sec = ms / 1000;
  return `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
}

export default function StreetRaceView({ s, color = '#e11d48' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-s.x, -s.y);
    // Marciapiede e asfalto: due tratti larghi lungo la pista.
    const path = () => {
      ctx.beginPath();
      TRACK.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    path();
    ctx.strokeStyle = '#b9b4aa';
    ctx.lineWidth = (HALF + 26) * 2;
    ctx.stroke();
    path();
    ctx.strokeStyle = '#34363d';
    ctx.lineWidth = HALF * 2;
    ctx.stroke();
    path();
    ctx.setLineDash([40, 40]);
    ctx.strokeStyle = 'rgba(242, 194, 48, 0.8)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.setLineDash([]);
    // Linea del traguardo a scacchi.
    const finish = pointAtDistance(0);
    ctx.save();
    ctx.translate(finish.x, finish.y);
    ctx.rotate(finish.angle);
    for (let i = -5; i < 5; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        ctx.fillRect(j * 12 - 12, i * (HALF / 5), 12, HALF / 5);
      }
    }
    ctx.restore();
    // Frenate e palazzi.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    s.skids.forEach((p) => ctx.fillRect(p.x - 3, p.y - 3, 6, 6));
    BLOCKS.forEach((b) => {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 14, b.y + 14, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 217, 138, 0.55)';
      for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 22) {
        for (let wy = b.y + 12; wy < b.y + b.h - 12; wy += 22) {
          if ((wx * 7 + wy * 13 + b.lit * 100) % 3 < 1.2) ctx.fillRect(wx, wy, 8, 8);
        }
      }
    });
    s.rivals.forEach((r) => {
      const p = pointAtDistance(r.s, r.lane);
      car(ctx, p.x, p.y, p.angle, r.color, 1 / SCALE * 0.9);
    });
    car(ctx, s.x, s.y, s.heading, color, 1 / SCALE * 0.9);
    ctx.restore();

    // Semaforo di partenza, giri, tempo, posizione.
    const lap = Math.min(LAPS, Math.max(1, Math.floor(s.progress / TRACK_LENGTH) + 1));
    const ahead = s.rivals.filter((r) => r.s > s.progress).length;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 8, 190, 50);
    ctx.fillStyle = '#fff';
    ctx.font = '800 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Giro ${lap}/${LAPS} · ${ahead + 1}° posto`, 16, 28);
    ctx.font = '600 13px "Trebuchet MS", sans-serif';
    ctx.fillText(`${formatTime(s.elapsed)} · ${Math.round(Math.abs(s.speed) * 0.5)} km/h`, 16, 48);
    if (s.wait > 0) {
      const lights = Math.min(3, Math.floor((3200 - s.wait) / 800) + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(W / 2 - 70, 20, 140, 46);
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(W / 2 - 40 + i * 40, 43, 14, 0, Math.PI * 2);
        ctx.fillStyle = i < lights ? '#ef4444' : '#3f3f46';
        ctx.fill();
      }
    } else if (s.elapsed < 800) {
      ctx.font = '900 44px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('VIA!', W / 2, 70);
    }
    if (s.finished) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(W / 2 - 150, H / 2 - 40, 300, 80);
      ctx.fillStyle = '#fde047';
      ctx.font = '900 28px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.place}° posto!`, W / 2, H / 2);
      ctx.font = '600 14px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Tempo ${formatTime(s.elapsed)}`, W / 2, H / 2 + 24);
    }
  });
  return <canvas ref={ref} className="rock-canvas" style={{ aspectRatio: `${W} / ${H}` }} aria-label="Gara in citta'" />;
}
