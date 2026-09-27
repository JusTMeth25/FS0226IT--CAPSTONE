import { useEffect, useRef } from 'react';

/**
 * Tavolo da ping pong visto dall'alto, in orizzontale: tutto il campo sta nel pannello.
 * A sinistra il giocatore, a destra Paddle (il robot della sala giochi): impugnano la racchetta,
 * si spostano lungo il fondo del tavolo seguendo la pallina e fanno lo swing quando la colpiscono.
 * La pallina ha la sua ombra e fa due rimbalzi per scambio, uno per meta' campo.
 *
 * La fisica e' quella di arcadeGames.jsx: y va da 0 (lato di Paddle) a 100 (lato tuo), x attraversa
 * il tavolo. Qui si disegna soltanto.
 */
const W = 440;
const H = 250;
const TABLE = { x: 88, y: 46, w: 264, h: 158 };


/** Da coordinate di gioco a pixel: il tuo lato e' a sinistra. */
const toX = (y) => TABLE.x + (1 - y / 100) * TABLE.w;
const toY = (x) => TABLE.y + (x / 100) * TABLE.h;

function drawFloor(ctx) {
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#34211a';
  for (let i = 0; i < W; i += 22) ctx.fillRect(i, 0, 2, H);
  // Luce della sala sopra il tavolo.
  const light = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 240);
  light.addColorStop(0, 'rgba(255, 236, 200, 0.18)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
}

function drawTable(ctx) {
  const { x, y, w, h } = TABLE;
  // Gambe e ombra.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(x + 6, y + 8, w, h);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  // Rete con i paletti.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(x + w / 2 + 2, y - 6, 4, h + 12);
  ctx.fillStyle = '#e5e7eb';
  for (let i = y - 6; i < y + h + 6; i += 4) ctx.fillRect(x + w / 2 - 2, i, 4, 2);
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + w / 2 - 3, y - 10, 6, 6);
  ctx.fillRect(x + w / 2 - 3, y + h + 4, 6, 6);
}

/**
 * Un giocatore al fondo del tavolo: corpo, testa, braccio teso con la racchetta al bordo.
 * `side` -1 = a sinistra (tu), 1 = a destra (Paddle). `swing` da 0 a 1 subito dopo un colpo.
 */
function drawPlayer(ctx, { side, py, walking, swing, robot, now }) {
  const tableEdge = side < 0 ? TABLE.x : TABLE.x + TABLE.w;
  const bodyX = tableEdge + side * 38;
  const step = walking ? Math.sin(now / 70) : 0;
  const bob = walking ? Math.abs(step) * 1.5 : 0;

  // Ombra.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(bodyX, py + 20, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gambe (viste dall'alto: due piedi che si alternano quando cammina).
  ctx.fillStyle = robot ? '#4b5563' : '#1f2937';
  ctx.fillRect(bodyX - 8 + step * 3 * side, py + 8, 6, 12);
  ctx.fillRect(bodyX + 2 - step * 3 * side, py + 8, 6, 12);

  // Busto.
  ctx.fillStyle = robot ? '#9ca3af' : '#ef4444';
  ctx.fillRect(bodyX - 11, py - 12 - bob, 22, 24);
  ctx.fillStyle = robot ? '#6b7280' : '#b91c1c';
  ctx.fillRect(bodyX - 11, py + 8 - bob, 22, 4);

  // Braccio con la racchetta: teso verso il tavolo, ruota in avanti quando colpisce.
  const reach = 22 + swing * 10;
  const angle = side < 0 ? -0.35 + swing * 0.9 : Math.PI + 0.35 - swing * 0.9;
  const shoulderX = bodyX - side * 9;
  const shoulderY = py - 4 - bob;
  const handX = shoulderX + Math.cos(angle) * reach;
  const handY = shoulderY + Math.sin(angle) * reach;
  ctx.strokeStyle = robot ? '#9ca3af' : '#f1c27d';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  // Manico e piatto della racchetta.
  const padX = handX + Math.cos(angle) * 9;
  const padY = handY + Math.sin(angle) * 9;
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(padX, padY);
  ctx.stroke();
  ctx.fillStyle = robot ? '#111827' : '#dc2626';
  ctx.strokeStyle = '#0b0b0b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(padX + Math.cos(angle) * 5, padY + Math.sin(angle) * 5, 8, 10, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // L'altro braccio lungo il fianco.
  ctx.strokeStyle = robot ? '#9ca3af' : '#f1c27d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(bodyX + side * 9, py - 4 - bob);
  ctx.lineTo(bodyX + side * 13, py + 8 - bob);
  ctx.stroke();

  // Testa.
  if (robot) {
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(bodyX - 10, py - 32 - bob, 20, 18);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(bodyX - 6, py - 26 - bob, 4, 4);
    ctx.fillRect(bodyX + 2, py - 26 - bob, 4, 4);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(bodyX - 1, py - 40 - bob, 2, 8);
    ctx.fillStyle = Math.floor(now / 300) % 2 ? '#f43f5e' : '#fde047';
    ctx.fillRect(bodyX - 2, py - 43 - bob, 4, 4);
  } else {
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(bodyX, py - 22 - bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2314';
    ctx.beginPath();
    ctx.arc(bodyX, py - 25 - bob, 10, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.fillRect(bodyX + side * -4 - 1, py - 22 - bob, 2, 3);
  }
}

function drawBall(ctx, ball, now) {
  const bx = toX(ball.y);
  const by = toY(ball.x);
  // Due rimbalzi per scambio: la pallina sale e scende una volta per ogni meta' campo.
  const t = Math.max(0, Math.min(1, (ball.y - 8) / 84));
  const height = Math.abs(Math.sin(t * Math.PI * 2)) * 16 + 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(bx + 3, by + 3, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(bx, by - height, 5 + height / 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 146, 60, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (Math.floor(now / 90) % 2 === 0 && height < 4) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export default function PongCanvas({ s }) {
  const ref = useRef(null);
  // Lo stato arriva a ogni fotogramma del gioco; il disegno ha un suo ciclo legato allo schermo,
  // cosi' resta fluido anche quando React salta un aggiornamento.
  const latest = useRef(s);
  useEffect(() => {
    latest.current = s;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    // Fondo e tavolo non cambiano mai: si disegnano una volta in un canvas a parte.
    const backdrop = document.createElement('canvas');
    backdrop.width = W * dpr;
    backdrop.height = H * dpr;
    const bctx = backdrop.getContext('2d');
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFloor(bctx);
    drawTable(bctx);
    bctx.font = 'bold 11px "Segoe UI", sans-serif';
    bctx.fillStyle = '#fde68a';
    bctx.textAlign = 'center';
    bctx.fillText('Tu', 40, H - 8);
    bctx.fillText('Paddle', W - 40, H - 8);

    let raf = 0;
    const draw = () => {
      const st = latest.current;
      const now = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(backdrop, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPlayer(ctx, { side: 1, py: toY(st.ai), walking: st.aiMove !== 0, swing: Math.max(0, (st.aiFlash || 0) / 180), robot: true, now });
      drawBall(ctx, st.ball, now);
      drawPlayer(ctx, { side: -1, py: toY(st.me), walking: st.meMove !== 0, swing: Math.max(0, (st.flash || 0) / 150), robot: false, now });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="mg-pong-canvas" style={{ width: '100%', maxWidth: W, aspectRatio: `${W} / ${H}` }} aria-label="Tavolo da ping pong" />;
}
