/**
 * Raccoglitori a tema, uno per gioco: colori, materiale della copertina e un motivo disegnato qui
 * (niente loghi ufficiali: solo forme e colori che ricordano il gioco). Le stesse funzioni
 * disegnano la copertina e le pagine sia per il libro 3D (texture) sia per la vista 2D (immagini).
 */

const TAU = Math.PI * 2;

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function star(ctx, x, y, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 ? r * inner : r;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function frame(ctx, w, h, color, width = 18, inset = 34) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
}

function leather(ctx, w, h, base, seed = 7) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const r = rand(seed);
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
  }
}

/** Motivi delle copertine, uno per gioco. */
const COVERS = {
  original(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2a1455');
    g.addColorStop(1, '#0d0620');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let r = 40; r < 330; r += 9) {
      ctx.strokeStyle = r % 27 === 4 ? 'rgba(236,72,153,.55)' : 'rgba(255,255,255,.07)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.46, r, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.46, 70, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0d0620';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.46, 14, 0, TAU);
    ctx.fill();
    frame(ctx, w, h, t.accent, 10);
  },
  pokemon(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1d4ed8');
    g.addColorStop(1, '#0b2a6f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rand(3);
    ctx.fillStyle = 'rgba(253,224,71,.16)';
    for (let i = 0; i < 26; i += 1) {
      const x = r() * w;
      const y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40, y + 10);
      ctx.lineTo(x + 18, y + 48);
      ctx.lineTo(x + 58, y + 58);
      ctx.lineTo(x + 8, y + 120);
      ctx.lineTo(x + 20, y + 66);
      ctx.lineTo(x - 18, y + 58);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.22);
    ctx.lineTo(w * 0.36, h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.42, h * 0.72);
    ctx.lineTo(w * 0.66, h * 0.42);
    ctx.lineTo(w * 0.52, h * 0.42);
    ctx.lineTo(w * 0.6, h * 0.22);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    frame(ctx, w, h, '#fde047', 14);
  },
  yugioh(ctx, w, h) {
    leather(ctx, w, h, '#3b2412', 11);
    ctx.strokeStyle = '#d4a93b';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.22);
    ctx.lineTo(w * 0.24, h * 0.66);
    ctx.lineTo(w * 0.76, h * 0.66);
    ctx.closePath();
    ctx.stroke();
    // Occhio stilizzato al centro del triangolo.
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.52, 74, 34, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#d4a93b';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, 18, 0, TAU);
    ctx.fill();
    // Fregi a geroglifici lungo i bordi.
    for (let i = 0; i < 18; i += 1) {
      const x = 70 + i * ((w - 140) / 17);
      ctx.fillRect(x - 6, 70, 12, 26 + (i % 3) * 8);
      ctx.fillRect(x - 6, h - 96 - (i % 3) * 8, 12, 26 + (i % 3) * 8);
    }
    frame(ctx, w, h, '#d4a93b', 8, 50);
  },
  scryfall(ctx, w, h) {
    leather(ctx, w, h, '#15120f', 5);
    const colors = ['#f8f4e3', '#3b82f6', '#27272a', '#dc2626', '#16a34a'];
    colors.forEach((c, i) => {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.fillStyle = c;
      ctx.strokeStyle = '#c9a44c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * 150, h * 0.46 + Math.sin(a) * 150, 56, 0, TAU);
      ctx.fill();
      ctx.stroke();
    });
    ctx.strokeStyle = '#c9a44c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.46, 230, 0, TAU);
    ctx.stroke();
    frame(ctx, w, h, '#c9a44c', 6, 40);
    frame(ctx, w, h, '#c9a44c', 2, 58);
  },
  onepiece(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0c4a6e');
    g.addColorStop(1, '#082f49');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(186,230,253,.25)';
    ctx.lineWidth = 6;
    for (let y = h * 0.7; y < h; y += 44) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + Math.sin(x / 40 + y) * 10);
      ctx.stroke();
    }
    // Rosa dei venti.
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      const r = i % 2 ? 90 : 180;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.42);
      ctx.lineTo(w / 2 + Math.cos(a + 0.12) * 40, h * 0.42 + Math.sin(a + 0.12) * 40);
      ctx.lineTo(w / 2 + Math.cos(a) * r, h * 0.42 + Math.sin(a) * r);
      ctx.lineTo(w / 2 + Math.cos(a - 0.12) * 40, h * 0.42 + Math.sin(a - 0.12) * 40);
      ctx.closePath();
      ctx.fill();
    }
    // Bordo di corda.
    ctx.strokeStyle = '#d6b37a';
    ctx.lineWidth = 16;
    ctx.setLineDash([24, 10]);
    ctx.strokeRect(36, 36, w - 72, h - 72);
    ctx.setLineDash([]);
  },
  digimon(ctx, w, h) {
    ctx.fillStyle = '#062a4a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56,189,248,.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 52) {
      for (let x = (y / 52) % 2 ? 30 : 0; x < w; x += 60) {
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU;
          ctx.lineTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(125,211,252,.5)';
    ctx.font = '22px monospace';
    const r = rand(9);
    for (let i = 0; i < 40; i += 1) ctx.fillText(r() > 0.5 ? '1' : '0', r() * w, r() * h);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.45, 120, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#062a4a';
    ctx.fillRect(w / 2 - 60, h * 0.45 - 60, 120, 120);
    frame(ctx, w, h, '#38bdf8', 8);
  },
  dragonball(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.45, h * 0.8);
    g.addColorStop(0, '#fb923c');
    g.addColorStop(1, '#9a3412');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 8;
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.45);
      ctx.lineTo(w / 2 + Math.cos(a) * 900, h * 0.45 + Math.sin(a) * 900);
      ctx.stroke();
    }
    const ball = ctx.createRadialGradient(w / 2 - 50, h * 0.4, 20, w / 2, h * 0.45, 200);
    ball.addColorStop(0, '#fff7cc');
    ball.addColorStop(0.3, '#fdba74');
    ball.addColorStop(1, '#ea580c');
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.45, 190, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    [[0, -60], [-60, 30], [60, 30], [0, 90]].forEach(([dx, dy]) => {
      star(ctx, w / 2 + dx, h * 0.45 + dy, 34);
      ctx.fill();
    });
    frame(ctx, w, h, '#fed7aa', 10);
  },
  lorcana(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3b0764');
    g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(250,204,21,.45)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * 0.1 + i * 150 + Math.sin(x / 70 + i) * 40);
      ctx.stroke();
    }
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + Math.PI / 6;
      ctx.lineTo(w / 2 + Math.cos(a) * 130, h * 0.46 + Math.sin(a) * 130);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + Math.PI / 6;
      ctx.lineTo(w / 2 + Math.cos(a) * 90, h * 0.46 + Math.sin(a) * 90);
    }
    ctx.closePath();
    ctx.fill();
    frame(ctx, w, h, '#facc15', 8);
  },
  gundam(ctx, w, h) {
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(30,41,59,.35)';
    ctx.lineWidth = 4;
    const r = rand(21);
    for (let i = 0; i < 22; i += 1) {
      const x = r() * w;
      const y = r() * h;
      ctx.strokeRect(x, y, 80 + r() * 160, 40 + r() * 120);
    }
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, h * 0.62, w, 110);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, h * 0.62 + 110, w, 40);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.2);
    ctx.lineTo(w / 2 - 200, h * 0.38);
    ctx.lineTo(w / 2 - 170, h * 0.42);
    ctx.lineTo(w / 2, h * 0.3);
    ctx.lineTo(w / 2 + 170, h * 0.42);
    ctx.lineTo(w / 2 + 200, h * 0.38);
    ctx.closePath();
    ctx.fill();
    frame(ctx, w, h, '#1e293b', 8);
  },
  riftbound(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 30, w / 2, h * 0.45, h * 0.7);
    g.addColorStop(0, '#1e3a8a');
    g.addColorStop(1, '#020617');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#cbb26a';
    ctx.lineWidth = 6;
    [120, 170, 230].forEach((r) => {
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.45, r, 0, TAU);
      ctx.stroke();
    });
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 170, h * 0.45 + Math.sin(a) * 170);
      ctx.lineTo(w / 2 + Math.cos(a) * 230, h * 0.45 + Math.sin(a) * 230);
      ctx.stroke();
    }
    frame(ctx, w, h, '#cbb26a', 6, 40);
  },
  fc27(ctx, w, h) {
    for (let x = 0; x < w; x += 64) {
      ctx.fillStyle = (x / 64) % 2 ? '#15803d' : '#16a34a';
      ctx.fillRect(x, 0, 64, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 8;
    ctx.strokeRect(70, 70, w - 140, h - 140);
    ctx.beginPath();
    ctx.moveTo(70, h / 2);
    ctx.lineTo(w - 70, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 130, 0, TAU);
    ctx.stroke();
    ctx.strokeRect(w / 2 - 220, 70, 440, 220);
    ctx.strokeRect(w / 2 - 220, h - 290, 440, 220);
    frame(ctx, w, h, '#e3b341', 16, 20);
  }
};

export const BINDER_THEMES = {
  original: { title: 'Raccoglitore VinylDex', accent: '#ec4899', page: '#1c1234', pocket: 'rgba(236,72,153,.5)', text: '#fdf4ff' },
  pokemon: { title: 'Raccoglitore Pokémon', accent: '#fde047', page: '#15306e', pocket: 'rgba(253,224,71,.55)', text: '#fef9c3' },
  yugioh: { title: 'Raccoglitore Yu-Gi-Oh!', accent: '#d4a93b', page: '#2b1a0d', pocket: 'rgba(212,169,59,.55)', text: '#fde68a' },
  scryfall: { title: 'Raccoglitore Magic', accent: '#c9a44c', page: '#1b1814', pocket: 'rgba(201,164,76,.5)', text: '#f5ecd3' },
  onepiece: { title: 'Raccoglitore One Piece', accent: '#fbbf24', page: '#0b3954', pocket: 'rgba(214,179,122,.6)', text: '#fef3c7' },
  digimon: { title: 'Raccoglitore Digimon', accent: '#38bdf8', page: '#07233d', pocket: 'rgba(56,189,248,.55)', text: '#e0f2fe' },
  dragonball: { title: 'Raccoglitore Dragon Ball', accent: '#fed7aa', page: '#6b240b', pocket: 'rgba(254,215,170,.55)', text: '#ffedd5' },
  lorcana: { title: 'Raccoglitore Lorcana', accent: '#facc15', page: '#2a0f4f', pocket: 'rgba(250,204,21,.5)', text: '#fef9c3' },
  gundam: { title: 'Raccoglitore Gundam', accent: '#1d4ed8', page: '#dfe6ef', pocket: 'rgba(30,41,59,.4)', text: '#0f172a' },
  riftbound: { title: 'Raccoglitore Riftbound', accent: '#cbb26a', page: '#0b1733', pocket: 'rgba(203,178,106,.5)', text: '#fef3c7' },
  fc27: { title: 'Raccoglitore FC 27 Ultimate Team', accent: '#e3b341', page: '#0f4d2b', pocket: 'rgba(227,179,65,.55)', text: '#fef9c3' }
};

export function themeFor(source) {
  return BINDER_THEMES[source] ? { key: source, ...BINDER_THEMES[source] } : { key: 'original', ...BINDER_THEMES.original };
}

/** Copertina del raccoglitore (1024x1400) con il motivo del gioco e il titolo. */
export function drawCover(canvas, theme) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  (COVERS[theme.key] || COVERS.original)(ctx, w, h, theme);
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(80, h * 0.78, w - 160, 150);
  ctx.fillStyle = theme.key === 'gundam' ? '#f8fafc' : theme.text;
  ctx.textAlign = 'center';
  ctx.font = 'bold 60px "Segoe UI", Arial, sans-serif';
  const words = theme.title.split(' ');
  ctx.fillText(words.slice(0, 1).join(' ').toUpperCase(), w / 2, h * 0.78 + 62);
  ctx.font = 'bold 46px "Segoe UI", Arial, sans-serif';
  ctx.fillText(words.slice(1).join(' '), w / 2, h * 0.78 + 122);
  return canvas;
}

/** Fondo di una pagina: carta del colore del gioco con una trama leggera. */
export function drawPageBackground(ctx, w, h, theme) {
  ctx.fillStyle = theme.page;
  ctx.fillRect(0, 0, w, h);
  const r = rand(theme.key.length * 31 + 5);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.05)';
    ctx.fillRect(r() * w, r() * h, 3, 3);
  }
  ctx.strokeStyle = theme.pocket;
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, w - 28, h - 28);
}

const coverCache = new Map();

/** Copertina come immagine (per la vista 2D), una per gioco. */
export function coverImage(theme) {
  if (!coverCache.has(theme.key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    ctx.scale(0.5, 0.5);
    const big = document.createElement('canvas');
    big.width = 1024;
    big.height = 1400;
    drawCover(big, theme);
    ctx.drawImage(big, 0, 0);
    coverCache.set(theme.key, canvas.toDataURL('image/jpeg', 0.85));
  }
  return coverCache.get(theme.key);
}
