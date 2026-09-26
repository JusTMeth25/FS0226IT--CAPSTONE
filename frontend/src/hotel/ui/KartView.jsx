import { useLayoutEffect, useRef } from 'react';
import { A, B, HALF, SCALE, TRACK, VIEW_H, VIEW_W, WALL, WORLD_H, WORLD_W, WORLD_X0, WORLD_Y0, clamp, pointAt } from './kartWorld.js';

/** Pista del go-kart vista dall'alto, con la telecamera che segue il kart (canvas). */

// ------------------------------------------------------------------ disegno della pista (una volta)

let trackImage = null;

function strokeTrack(ctx) {
  ctx.beginPath();
  TRACK.forEach((p, i) => {
    const x = (p.x - WORLD_X0) * SCALE;
    const y = (p.y - WORLD_Y0) * SCALE;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
}

function buildTrack() {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WORLD_W * SCALE);
  canvas.height = Math.round(WORLD_H * SCALE);
  const ctx = canvas.getContext('2d');
  // Prato tagliato a strisce.
  for (let x = 0; x < canvas.width; x += 24) {
    ctx.fillStyle = Math.floor(x / 24) % 2 ? '#3d8f3c' : '#45a043';
    ctx.fillRect(x, 0, 24, canvas.height);
  }
  ctx.lineJoin = 'round';
  // Via di fuga di ghiaia, cordoli bianchi e rossi, asfalto.
  ctx.strokeStyle = '#c9b48a';
  ctx.lineWidth = (WALL + 20) * 2 * SCALE;
  strokeTrack(ctx);
  ctx.lineWidth = (HALF + 9) * 2 * SCALE;
  ctx.strokeStyle = '#f4f4f5';
  strokeTrack(ctx);
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#dc2626';
  strokeTrack(ctx);
  ctx.setLineDash([]);
  ctx.lineWidth = HALF * 2 * SCALE;
  ctx.strokeStyle = '#3f3f46';
  strokeTrack(ctx);
  // Grana dell'asfalto.
  for (let i = 0; i < 2600; i += 1) {
    const p = pointAt(Math.random(), (Math.random() * 2 - 1) * HALF * 0.95);
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect((p.x - WORLD_X0) * SCALE, (p.y - WORLD_Y0) * SCALE, 1.5, 1.5);
  }
  // Linea di mezzeria tratteggiata.
  ctx.setLineDash([8, 12]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  strokeTrack(ctx);
  ctx.setLineDash([]);
  // Linea di partenza a scacchi.
  const start = pointAt(0);
  ctx.save();
  ctx.translate((start.x - WORLD_X0) * SCALE, (start.y - WORLD_Y0) * SCALE);
  ctx.rotate(start.angle);
  const cell = 6;
  for (let r = 0; r < 2; r += 1) {
    for (let c = -Math.ceil(HALF * SCALE / cell); c < Math.ceil(HALF * SCALE / cell); c += 1) {
      ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
      ctx.fillRect(r * cell - cell, c * cell, cell, cell);
    }
  }
  ctx.restore();
  // Pile di gomme all'esterno delle curve.
  [0.125, 0.375, 0.625, 0.875].forEach((u) => {
    for (let k = -3; k <= 3; k += 1) {
      const p = pointAt(u + k * 0.012, -(WALL + 12));
      const x = (p.x - WORLD_X0) * SCALE;
      const y = (p.y - WORLD_Y0) * SCALE;
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = k % 2 ? '#ef4444' : '#f4f4f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  // Scritta nel prato in mezzo.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VINYLDEX', -WORLD_X0 * SCALE, -WORLD_Y0 * SCALE + 16);
  return canvas;
}

function drawKart(ctx, x, y, angle, body, helmet) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-12, -7, 26, 16);
  ctx.fillStyle = '#111827';
  [[-11, -9], [5, -9], [-11, 6], [5, 6]].forEach(([wx, wy]) => ctx.fillRect(wx, wy, 7, 4));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.lineTo(8, -5);
  ctx.lineTo(14, 0);
  ctx.lineTo(8, 5);
  ctx.lineTo(-12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(10, -3, 4, 6);
  ctx.fillStyle = helmet;
  ctx.beginPath();
  ctx.arc(-3, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.fillRect(-1, -2.5, 3, 5);
  ctx.restore();
}

const RIVAL_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

export default function KartView({ s, rivals }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!trackImage) trackImage = buildTrack();
    const ctx = canvas.getContext('2d');
    const camX = clamp((s.x - WORLD_X0) * SCALE - VIEW_W / 2, 0, trackImage.width - VIEW_W);
    const camY = clamp((s.y - WORLD_Y0) * SCALE - VIEW_H / 2, 0, trackImage.height - VIEW_H);
    ctx.drawImage(trackImage, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    const toView = (wx, wy) => ({ x: (wx - WORLD_X0) * SCALE - camX, y: (wy - WORLD_Y0) * SCALE - camY });
    // Segni delle gomme e polvere.
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    s.skids.forEach((m) => {
      const p = toView(m.x, m.y);
      ctx.fillRect(p.x - 1, p.y - 1, 2.5, 2.5);
    });
    s.dust.forEach((d) => {
      const p = toView(d.x, d.y);
      ctx.fillStyle = `rgba(214, 196, 150, ${Math.max(0, d.life / 600) * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + (600 - d.life) / 120, 0, Math.PI * 2);
      ctx.fill();
    });
    // Avversari, dalla loro posizione in pista.
    (rivals || []).forEach((r, i) => {
      const p = pointAt(r.u, ((i % 3) - 1) * 26);
      const v = toView(p.x, p.y);
      drawKart(ctx, v.x, v.y, p.angle, RIVAL_COLORS[i % RIVAL_COLORS.length], '#f8fafc');
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(r.name, v.x, v.y - 14);
      ctx.fillText(r.name, v.x, v.y - 14);
    });
    const me = toView(s.x, s.y);
    drawKart(ctx, me.x, me.y, s.heading, s.spin > 0 ? '#f97316' : '#dc2626', '#fde047');
    // Minimappa in alto a destra.
    const mw = 110;
    const mh = 68;
    const mx = VIEW_W - mw - 8;
    const my = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    TRACK.forEach((p, i) => {
      const x = mx + mw / 2 + (p.x / A) * (mw / 2 - 6);
      const y = my + mh / 2 + (p.y / B) * (mh / 2 - 6);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    const dot = (px, py, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + mw / 2 + (px / A) * (mw / 2 - 6), my + mh / 2 + (py / B) * (mh / 2 - 6), 3.5, 0, Math.PI * 2);
      ctx.fill();
    };
    (rivals || []).forEach((r, i) => {
      const p = pointAt(r.u);
      dot(p.x, p.y, RIVAL_COLORS[i % RIVAL_COLORS.length]);
    });
    dot(s.x, s.y, '#ef4444');
    // Semaforo di partenza.
    if (s.wait > 0) {
      const lit = s.wait > 3000 ? 0 : Math.min(5, Math.floor((3000 - s.wait) / 600) + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(VIEW_W / 2 - 90, 40, 180, 46);
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = i < lit ? '#ef4444' : '#3f3f46';
        ctx.beginPath();
        ctx.arc(VIEW_W / 2 - 64 + i * 32, 63, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.wait > 3000) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Si parte fra ${Math.ceil(s.wait / 1000)}s: aspetta gli altri piloti`, VIEW_W / 2, 110);
      }
    } else if (s.elapsed < 900) {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VIA!', VIEW_W / 2, 90);
    }
  });
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} className="mg-kart-canvas" aria-label="Pista del go-kart" />;
}

