/**
 * Palazzi del Quartiere: ogni lotto "building" (4x3, la facciata guarda il viale) mostra fuori la
 * stanza pubblica che gli tocca, con un esterno che dice cosa c'e' dentro: lo stadio con gli
 * spalti e i riflettori, il cinema con l'insegna a lampadine, la piscina con l'acqua, il casino
 * dorato, la pizzeria col forno... Il nome lo scrive il motore sull'insegna.
 *
 * Le stanze nuove senza un tema loro hanno un palazzo generico con i colori ricavati dal nome.
 */

const FACE = 2.86;

/** Palma: tronco e ciuffo di foglie. */
function palmTree(c, palm, u, v, h) {
  c({ u, v, r: 0.05, z0: 0, z1: h, color: '#8b5a2b', tex: 'wood' });
  palm({ u, v, z: h, length: 34, color: '#16a34a', seed: Math.round(u * 10 + v) });
}

/** Tema per stanza pubblica (id): aspetto del palazzo e colore dell'insegna. */
export const ROOM_THEMES = {
  '00000000-0000-0000-0000-00000000a001': 'hotel',
  '00000000-0000-0000-0000-00000000a002': 'arena',
  '00000000-0000-0000-0000-00000000a003': 'spa',
  '00000000-0000-0000-0000-00000000a004': 'pool',
  '00000000-0000-0000-0000-00000000a005': 'neonbar',
  '00000000-0000-0000-0000-00000000a006': 'greenhouse',
  '00000000-0000-0000-0000-00000000a007': 'pizzeria',
  '00000000-0000-0000-0000-00000000a008': 'arcade',
  '00000000-0000-0000-0000-00000000a009': 'library',
  '00000000-0000-0000-0000-00000000a00a': 'tower',
  '00000000-0000-0000-0000-00000000a00b': 'beach',
  '00000000-0000-0000-0000-00000000a00c': 'kiosk',
  '00000000-0000-0000-0000-00000000a00d': 'cinema',
  '00000000-0000-0000-0000-00000000a00e': 'gym',
  '00000000-0000-0000-0000-00000000a00f': 'stadium',
  '00000000-0000-0000-0000-00000000a010': 'bowling',
  '00000000-0000-0000-0000-00000000a011': 'minigolf',
  '00000000-0000-0000-0000-00000000a012': 'court',
  '00000000-0000-0000-0000-00000000a013': 'kart',
  '00000000-0000-0000-0000-00000000a014': 'disco',
  '00000000-0000-0000-0000-00000000a016': 'atelier',
  '00000000-0000-0000-0000-00000000a017': 'jeweler',
  '00000000-0000-0000-0000-00000000a018': 'skate',
  '00000000-0000-0000-0000-00000000a019': 'bikes',
  '00000000-0000-0000-0000-00000000a01a': 'cars',
  '00000000-0000-0000-0000-00000000a01b': 'cafe',
  '00000000-0000-0000-0000-00000000a01c': 'ice',
  '00000000-0000-0000-0000-00000000a01d': 'basketarena',
  '00000000-0000-0000-0000-00000000a01e': 'rockclub',
  '00000000-0000-0000-0000-00000000a01f': 'rockstore',
  '00000000-0000-0000-0000-00000000a020': 'casino',
  '00000000-0000-0000-0000-00000000a021': 'tobacco',
  '00000000-0000-0000-0000-00000000a022': 'greenshop',
  '00000000-0000-0000-0000-00000000a024': 'wallstreet'
};

/** Colore della scritta sull'insegna, per tema. */
export const SIGN_COLORS = {
  hotel: '#fde68a', arena: '#fca5a5', spa: '#bbf7d0', pool: '#e0f2fe', neonbar: '#f0abfc', greenhouse: '#dcfce7', pizzeria: '#fef3c7',
  arcade: '#a5f3fc', library: '#fde68a', tower: '#e0f2fe', beach: '#fef08a', kiosk: '#ffffff', cinema: '#fde047', gym: '#ffffff',
  stadium: '#ffffff', bowling: '#fecaca', minigolf: '#ffffff', court: '#fed7aa', kart: '#ffffff', disco: '#f9a8d4', atelier: '#f3ead8',
  jeweler: '#fcd34d', skate: '#ffffff', bikes: '#ffffff', cars: '#ffffff', cafe: '#fef3c7', ice: '#e0f2fe', basketarena: '#fed7aa',
  rockclub: '#fb923c', rockstore: '#fde68a', casino: '#fde047', tobacco: '#ffffff', greenshop: '#bef264', wallstreet: '#4ade80', generic: '#ffffff'
};

/** Altezza (in pixel dello sprite) sopra il lotto: serve al motore per la tela e l'insegna. */
export const BUILDING_HEIGHT = {
  tower: 250, wallstreet: 280, hotel: 200, library: 150, casino: 170, stadium: 120, arena: 130, cinema: 150, disco: 140
};

export function signHeight(theme) {
  const h = BUILDING_HEIGHT[theme] || 120;
  return Math.min(h - 26, 92);
}

function hashColor(text) {
  let h = 0;
  for (const ch of text || '') h = (h * 31 + ch.charCodeAt(0)) | 0;
  const palette = ['#7c3aed', '#0e7490', '#b45309', '#be123c', '#15803d', '#1d4ed8', '#a21caf', '#4d7c0f'];
  return palette[Math.abs(h) % palette.length];
}

/**
 * Corpo base: muri, cornice, finestre dei piani alti, piano terra con vetrina e porta,
 * tendone e pannello dell'insegna. Le opzioni cambiano colori e altezza.
 */
function body(b, d, front, o) {
  const h = o.h;
  b({ u0: 0.05, v0: 0.1, u1: 3.95, v1: FACE, z1: h, color: o.wall, tex: o.tex || 'stone' });
  b({ u0: 0, v0: 0.05, u1: 4, v1: FACE + 0.05, z0: h, z1: h + 6, color: o.trim });
  // Tetto: guaina scura dentro la cornice, un condizionatore e il comignolo dell'ascensore.
  if (o.roof !== false) {
    b({ u0: 0.2, v0: 0.25, u1: 3.8, v1: FACE - 0.15, z0: h + 6, z1: h + 7, color: o.roof || '#475569', tex: 'fabric' });
    b({ u0: 0.4, v0: 0.4, u1: 0.9, v1: 0.8, z0: h + 7, z1: h + 15, color: '#9ca3af', tex: 'metal' });
    d(0.65, 0.8, h + 11, '#374151', 6, 4);
    b({ u0: 3.0, v0: 0.4, u1: 3.5, v1: 0.9, z0: h + 7, z1: h + 19, color: '#64748b', tex: 'stone' });
  }
  front(() => {
    // Finestre dei piani alti.
    if (o.windows !== false) {
      for (let z = 66; z < h - 16; z += 22) {
        for (let u = 0.35; u < 3.7; u += 0.62) {
          b({ u0: u, v0: FACE, u1: u + 0.36, v1: FACE + 0.03, z0: z, z1: z + 12, color: o.window || '#1e293b', left: o.window || '#1e293b' });
          d(u + 0.06, FACE + 0.03, z + 10, 'rgba(255, 255, 255, 0.35)', 3, 1);
          if (o.lit) d(u + 0.18, FACE + 0.03, z + 4, o.lit, 4, 4);
        }
      }
    }
    // Pannello dell'insegna (il testo lo scrive il motore).
    b({ u0: 0.3, v0: FACE, u1: 3.7, v1: FACE + 0.05, z0: 44, z1: 60, color: o.sign || '#111827', left: o.sign || '#111827' });
    // Piano terra: vetrina, porta, maniglia.
    b({ u0: 0.25, v0: FACE, u1: 2.55, v1: FACE + 0.04, z0: 4, z1: 38, color: o.glass || '#1f2a3a', left: o.glass || '#1f2a3a' });
    o.goods?.(d);
    for (let i = 0; i < 10; i += 1) d(0.35 + i * 0.06, FACE + 0.04, 34 - i * 3, 'rgba(255, 255, 255, 0.3)', 2, 1);
    b({ u0: 2.8, v0: FACE, u1: 3.5, v1: FACE + 0.05, z0: 0, z1: 40, color: o.door || '#3b2414', left: o.door || '#3b2414' });
    d(3.42, FACE + 0.06, 20, '#fbbf24', 2, 3);
    if (o.awning) {
      for (let i = 0; i < 13; i += 1) {
        b({ u0: 0.2 + i * 0.28, v0: FACE, u1: 0.2 + (i + 1) * 0.28, v1: FACE + 0.32, z0: 38, z1: 43, color: o.awning[i % 2] });
      }
    }
  });
}

/** Lampadine tutto intorno a un rettangolo della facciata (cinema, casino, bowling). */
function bulbs(d, u0, u1, z0, z1, color, now) {
  const on = Math.floor((now || 0) / 300) % 2;
  let k = 0;
  for (let u = u0; u <= u1; u += 0.18) {
    d(u, FACE + 0.06, z1, (k++ + on) % 2 ? color : '#fff7d6', 2, 2);
    d(u, FACE + 0.06, z0, (k + on) % 2 ? color : '#fff7d6', 2, 2);
  }
}

const THEMES = {
  hotel(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 196, wall: '#f5ecd8', trim: '#c9a24a', window: '#334155', lit: 'rgba(253, 230, 138, 0.6)', sign: '#7f1d1d', awning: ['#7f1d1d', '#c9a24a'], door: '#c9a24a', glass: '#3b2a1a' });
    [0.6, 2, 3.4].forEach((u, i) => {
      c({ u, v: 0.4, r: 0.02, z0: 202, z1: 236, color: '#e5e7eb' });
      for (let k = 0; k < 7; k += 1) d(u + 0.02, 0.4, 234 - k, ['#7c3aed', '#c9a24a', '#ec4899'][i], 12 - k, 1);
    });
    b({ u0: 1.4, v0: 0.6, u1: 2.6, v1: 1.6, z0: 202, z1: 214, color: '#c9a24a' });
  },
  arena(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 120, wall: '#d6c3a5', trim: '#a16207', windows: false, sign: '#7f1d1d', door: '#7f1d1d' });
    front(() => {
      // Archi del colosseo su due piani.
      for (let row = 0; row < 2; row += 1) {
        for (let u = 0.3; u < 3.7; u += 0.55) b({ u0: u, v0: FACE, u1: u + 0.32, v1: FACE + 0.03, z0: 64 + row * 26, z1: 82 + row * 26, color: '#3f2a14', left: '#3f2a14' });
      }
    });
    [0.4, 3.6].forEach((u) => b({ u0: u - 0.15, v0: 0.3, u1: u + 0.15, v1: 0.6, z0: 120, z1: 132, color: '#dc2626' }));
  },
  spa(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 104, wall: '#e7dcc8', trim: '#6b4f2a', tex: 'wood', window: '#14532d', sign: '#14532d', awning: ['#166534', '#f0fdf4'], door: '#6b4f2a' });
    palmTree(c, palm, 0.25, FACE + 0.1, 120);
    c({ u: 3.7, v: 0.6, r: 0.25, z0: 104, z1: 112, color: '#bae6fd', top: '#7dd3fc' });
  },
  pool(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 92, wall: '#f8fafc', trim: '#0ea5e9', window: '#0369a1', sign: '#0c4a6e', awning: ['#0ea5e9', '#ffffff'], door: '#0369a1', glass: '#0e7490' });
    // Trampolino e scivolo sul tetto, l'acqua che si vede.
    b({ u0: 0.4, v0: 0.4, u1: 2.6, v1: 2.2, z0: 92, z1: 94, color: '#38bdf8' });
    b({ u0: 2.9, v0: 0.6, u1: 3.6, v1: 0.8, z0: 92, z1: 128, color: '#f97316' });
    c({ u: 3.3, v: 2.4, r: 0.25, z0: 92, z1: 96, color: '#ef4444', top: '#fecaca' });
  },
  neonbar(b, c, d, leaves, palm, front, now) {
    const blink = Math.floor((now || 0) / 400) % 2;
    body(b, d, front, { h: 120, wall: '#111827', trim: '#ec4899', window: '#312e81', lit: blink ? 'rgba(236, 72, 153, 0.7)' : 'rgba(34, 211, 238, 0.7)', sign: '#0f172a', door: '#ec4899', glass: '#4c1d95' });
    front(() => {
      b({ u0: 0.2, v0: FACE, u1: 3.8, v1: FACE + 0.04, z0: 112, z1: 115, color: blink ? '#22d3ee' : '#f0abfc' });
      b({ u0: 0.2, v0: FACE, u1: 3.8, v1: FACE + 0.04, z0: 62, z1: 64, color: blink ? '#f0abfc' : '#22d3ee' });
    });
  },
  greenhouse(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 70, wall: '#a3b18a', trim: '#3f6212', windows: false, sign: '#14532d', awning: ['#3f6212', '#ecfccb'], door: '#3f6212', glass: '#365314' });
    c({ u: 2, v: 1.4, r: 1.1, z0: 70, z1: 120, color: 'rgba(187, 247, 208, 0.45)', top: 'rgba(220, 252, 231, 0.6)' });
    leaves({ u: 1.6, v: 1.3, z: 90, r: 0.45, color: '#16a34a' });
    leaves({ u: 2.5, v: 1.6, z: 86, r: 0.4, color: '#22c55e' });
  },
  pizzeria(b, c, d, leaves, palm, front, now) {
    body(b, d, front, { h: 112, wall: '#b45309', trim: '#f5f5f4', tex: 'stone', window: '#451a03', lit: 'rgba(253, 186, 116, 0.6)', sign: '#14532d', awning: ['#dc2626', '#f5f5f4'], door: '#166534' });
    b({ u0: 3.2, v0: 0.4, u1: 3.6, v1: 0.8, z0: 112, z1: 150, color: '#7c2d12', tex: 'stone' });
    const puff = Math.floor((now || 0) / 500) % 3;
    d(3.4, 0.6, 156 + puff * 4, 'rgba(229, 231, 235, 0.7)', 6, 5);
  },
  arcade(b, c, d, leaves, palm, front, now) {
    const step = Math.floor((now || 0) / 250) % 4;
    body(b, d, front, { h: 118, wall: '#4c1d95', trim: '#22d3ee', window: '#1e1b4b', lit: ['#f472b6', '#22d3ee', '#facc15', '#4ade80'][step], sign: '#0f172a', door: '#22d3ee', glass: '#312e81' });
    // Joystick gigante sul tetto.
    b({ u0: 1.6, v0: 1, u1: 2.4, v1: 1.6, z0: 118, z1: 126, color: '#111827' });
    c({ u: 2, v: 1.3, r: 0.05, z0: 126, z1: 150, color: '#9ca3af' });
    c({ u: 2, v: 1.3, r: 0.16, z0: 148, z1: 160, color: '#ef4444', top: '#fca5a5' });
  },
  library(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 148, wall: '#e7e5e4', trim: '#78716c', window: '#292524', lit: 'rgba(253, 230, 138, 0.5)', sign: '#1c1917', door: '#78350f', glass: '#44403c',
      goods: (dd) => ['#7f1d1d', '#1e3a8a', '#14532d', '#a16207', '#4c1d95'].forEach((col, i) => dd(0.4 + i * 0.4, FACE + 0.04, 16, col, 4, 14)) });
    front(() => [0.3, 1.25, 2.2, 3.15].forEach((u) => c({ u: u + 0.25, v: FACE + 0.12, r: 0.08, z0: 0, z1: 140, color: '#f5f5f4', top: '#e7e5e4' })));
    b({ u0: 0.2, v0: 0.3, u1: 3.8, v1: FACE, z0: 148, z1: 160, color: '#a8a29e' });
  },
  tower(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 244, wall: '#334155', trim: '#94a3b8', tex: 'metal', window: '#38bdf8', lit: 'rgba(224, 242, 254, 0.5)', sign: '#0f172a', door: '#94a3b8', glass: '#0c4a6e' });
    leaves({ u: 1, v: 1, z: 253, r: 0.35, color: '#16a34a' });
    leaves({ u: 3, v: 1.5, z: 251, r: 0.3, color: '#22c55e' });
    c({ u: 2, v: 1.2, r: 0.3, z0: 244, z1: 250, color: '#f59e0b', top: '#fde68a' });
  },
  beach(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 84, wall: '#fde68a', trim: '#0ea5e9', tex: 'wood', windows: false, sign: '#0369a1', awning: ['#0ea5e9', '#ffffff'], door: '#0ea5e9', glass: '#7dd3fc' });
    palmTree(c, palm, 0.2, FACE + 0.15, 130);
    palmTree(c, palm, 3.8, 0.4, 120);
    [1.2, 2.6].forEach((u, i) => b({ u0: u, v0: 0.4, u1: u + 0.18, v1: 0.5, z0: 84, z1: 120, color: i ? '#ef4444' : '#22c55e' }));
  },
  kiosk(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 96, wall: '#166534', trim: '#facc15', window: '#052e16', sign: '#052e16', door: '#facc15', glass: '#14532d',
      goods: (dd) => ['#ef4444', '#3b82f6', '#facc15', '#a855f7', '#22c55e', '#f97316'].forEach((col, i) => dd(0.35 + i * 0.35, FACE + 0.04, 12, col, 7, 16)) });
  },
  cinema(b, c, d, leaves, palm, front, now) {
    body(b, d, front, { h: 150, wall: '#7f1d1d', trim: '#fbbf24', window: '#450a0a', sign: '#111827', door: '#fbbf24', glass: '#1f2937',
      goods: (dd) => [0.4, 1.3].forEach((u) => { dd(u, FACE + 0.04, 8, '#fde047', 14, 24); dd(u + 0.04, FACE + 0.05, 12, '#1e3a8a', 10, 14); }) });
    front(() => {
      b({ u0: 0.1, v0: FACE, u1: 3.9, v1: FACE + 0.45, z0: 62, z1: 70, color: '#111827' });
      bulbs(d, 0.2, 3.8, 63, 69, '#fde047', now);
    });
  },
  gym(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 116, wall: '#9ca3af', trim: '#111827', tex: 'stone', window: '#0f172a', sign: '#dc2626', door: '#111827', glass: '#1f2937' });
    // Manubrio gigante sul tetto.
    b({ u0: 1.3, v0: 1.25, u1: 2.7, v1: 1.35, z0: 128, z1: 132, color: '#d1d5db' });
    [1.3, 2.6].forEach((u) => b({ u0: u - 0.05, v0: 1.05, u1: u + 0.15, v1: 1.55, z0: 120, z1: 140, color: '#111827' }));
  },
  stadium(b, c, d, leaves, palm, front) {
    // Stadio: muro curvo basso, spalti che salgono, quattro torri dei riflettori.
    body(b, d, front, { h: 70, wall: '#e5e7eb', trim: '#16a34a', windows: false, sign: '#14532d', door: '#16a34a', glass: '#334155' });
    for (let k = 0; k < 4; k += 1) b({ u0: 0.2 + k * 0.15, v0: 0.2 + k * 0.1, u1: 3.8 - k * 0.15, v1: 1.2 - k * 0.05, z0: 70 + k * 10, z1: 80 + k * 10, color: k % 2 ? '#ef4444' : '#3b82f6' });
    b({ u0: 0.6, v0: 1.2, u1: 3.4, v1: 2.4, z0: 70, z1: 71, color: '#16a34a', tex: 'fabric' });
    [[0.15, 0.15], [3.85, 0.15], [0.15, 2.6], [3.85, 2.6]].forEach(([u, v]) => {
      c({ u, v, r: 0.04, z0: 0, z1: 128, color: '#6b7280' });
      b({ u0: u - 0.14, v0: v - 0.05, u1: u + 0.14, v1: v + 0.05, z0: 128, z1: 138, color: '#f8fafc' });
    });
  },
  bowling(b, c, d, leaves, palm, front, now) {
    body(b, d, front, { h: 104, wall: '#fef2f2', trim: '#dc2626', window: '#0f172a', sign: '#dc2626', awning: ['#dc2626', '#fef2f2'], door: '#0f172a', glass: '#1e3a8a' });
    // Birillo gigante sul tetto.
    c({ u: 2, v: 1.3, r: 0.22, z0: 104, z1: 140, color: '#ffffff', top: '#f8fafc' });
    c({ u: 2, v: 1.3, r: 0.14, z0: 140, z1: 160, color: '#ffffff', top: '#ffffff' });
    b({ u0: 1.85, v0: 1.15, u1: 2.15, v1: 1.45, z0: 136, z1: 140, color: '#dc2626' });
    front(() => bulbs(d, 0.3, 3.7, 62, 61, '#f87171', now));
  },
  minigolf(b, c, d, leaves, palm, front, now) {
    body(b, d, front, { h: 62, wall: '#bbf7d0', trim: '#15803d', windows: false, sign: '#14532d', door: '#15803d', glass: '#166534' });
    b({ u0: 0.3, v0: 0.3, u1: 3.7, v1: 2.4, z0: 62, z1: 64, color: '#22c55e', tex: 'fabric' });
    // Mulino a vento con le pale che girano.
    b({ u0: 2.6, v0: 0.6, u1: 3.3, v1: 1.3, z0: 64, z1: 110, color: '#b91c1c', tex: 'wood' });
    const a = ((now || 0) / 600) % (Math.PI * 2);
    for (let k = 0; k < 4; k += 1) {
      const ang = a + (k * Math.PI) / 2;
      for (let r = 0; r < 8; r += 1) d(2.95 + Math.cos(ang) * r * 0.06, 1.32, 104 + Math.sin(ang) * r * 4, '#f8fafc', 3, 3);
    }
    c({ u: 1, v: 1.2, r: 0.02, z0: 64, z1: 96, color: '#e5e7eb' });
    d(1.04, 1.2, 92, '#ef4444', 10, 6);
  },
  court(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 110, wall: '#f97316', trim: '#7c2d12', tex: 'stone', window: '#431407', sign: '#431407', door: '#7c2d12', glass: '#7c2d12' });
    front(() => {
      // Canestro sulla facciata.
      b({ u0: 1.6, v0: FACE, u1: 2.4, v1: FACE + 0.04, z0: 76, z1: 100, color: '#ffffff', left: '#ffffff' });
      c({ u: 2, v: FACE + 0.22, r: 0.16, z0: 74, z1: 76, color: '#ea580c', top: 'rgba(0,0,0,0)' });
    });
  },
  kart(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 96, wall: '#1f2937', trim: '#facc15', tex: 'metal', window: '#111827', sign: '#111827', door: '#facc15', glass: '#374151' });
    front(() => {
      for (let i = 0; i < 16; i += 1) d(0.2 + i * 0.23, FACE + 0.05, 90, i % 2 ? '#ffffff' : '#111827', 6, 6);
      [0.5, 1.1].forEach((u) => c({ u, v: FACE + 0.3, r: 0.18, z0: 0, z1: 10, color: '#111827', top: '#374151' }));
    });
  },
  disco(b, c, d, leaves, palm, front, now) {
    const step = Math.floor((now || 0) / 200) % 6;
    const colors = ['#f472b6', '#22d3ee', '#facc15', '#a78bfa', '#4ade80', '#fb923c'];
    body(b, d, front, { h: 128, wall: '#0f0f1a', trim: colors[step], window: '#1e1b4b', lit: colors[(step + 2) % 6], sign: '#0f0f1a', door: colors[(step + 4) % 6], glass: '#312e81' });
    c({ u: 2, v: 1.3, r: 0.4, z0: 132, z1: 166, color: '#cbd5e1', top: '#f1f5f9', tex: 'metal' });
    for (let k = 0; k < 6; k += 1) d(1.8 + (k % 3) * 0.15, 1.6, 140 + Math.floor(k / 3) * 12, colors[(k + step) % 6], 3, 3);
  },
  atelier(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 128, wall: '#efe6d4', trim: '#c9a24a', window: '#2b3a4a', sign: '#111114', awning: ['#111114', '#f3ead8'], door: '#111114', glass: '#2b3a4a',
      goods: (dd) => ['#1e2a4a', '#b3122e', '#c19a6b'].forEach((col, i) => dd(0.6 + i * 0.5, FACE + 0.04, 6, col, 6, 22)) });
  },
  jeweler(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 132, wall: '#1f2937', trim: '#d4a017', window: '#111827', sign: '#0b3d2e', awning: ['#0b3d2e', '#d4a017'], door: '#d4a017', glass: '#1c2733',
      goods: (dd) => ['#d4a017', '#1e3a8a', '#15803d', '#e8a488'].forEach((col, i) => { dd(0.5 + i * 0.45, FACE + 0.04, 16, '#e5e7eb', 5, 5); dd(0.52 + i * 0.45, FACE + 0.05, 17, col, 3, 3); }) });
  },
  skate(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 104, wall: '#374151', trim: '#facc15', tex: 'stone', window: '#111827', sign: '#111827', door: '#facc15', glass: '#1f2937',
      goods: (dd) => ['#ef4444', '#22c55e', '#3b82f6'].forEach((col, i) => dd(0.5 + i * 0.6, FACE + 0.04, 6, col, 4, 26)) });
    front(() => {
      // Graffiti colorati sul muro.
      ['#f472b6', '#22d3ee', '#a3e635'].forEach((col, i) => d(0.5 + i * 1.1, FACE + 0.04, 80 + i * 6, col, 20, 8));
    });
  },
  bikes(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 100, wall: '#ecfeff', trim: '#0e7490', window: '#164e63', sign: '#0e7490', awning: ['#0e7490', '#ecfeff'], door: '#0e7490', glass: '#155e75' });
    front(() => [0.4, 1.4].forEach((u) => { c({ u, v: FACE + 0.3, r: 0.16, z0: 6, z1: 8, color: '#111827', top: 'rgba(0,0,0,0)' }); c({ u: u + 0.45, v: FACE + 0.3, r: 0.16, z0: 6, z1: 8, color: '#111827', top: 'rgba(0,0,0,0)' }); }));
  },
  cars(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 112, wall: '#f8fafc', trim: '#dc2626', tex: 'metal', window: '#0f172a', sign: '#0f172a', door: '#dc2626', glass: '#1e293b',
      goods: (dd) => { dd(0.5, FACE + 0.04, 6, '#dc2626', 30, 10); dd(0.65, FACE + 0.05, 14, '#7f1d1d', 18, 6); } });
  },
  cafe(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 110, wall: '#f5e6d3', trim: '#6b4423', tex: 'stone', window: '#3f2a14', lit: 'rgba(253, 230, 138, 0.6)', sign: '#3f2a14', awning: ['#14532d', '#f5e6d3'], door: '#6b4423', glass: '#3f2a14' });
    front(() => [0.6, 1.8].forEach((u) => { c({ u, v: FACE + 0.6, r: 0.18, z0: 14, z1: 16, color: '#f5f5f4' }); c({ u, v: FACE + 0.6, r: 0.03, z0: 0, z1: 14, color: '#3f2a14' }); }));
  },
  ice(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 100, wall: '#e0f2fe', trim: '#0369a1', tex: 'metal', window: '#0c4a6e', sign: '#0c4a6e', door: '#0369a1', glass: '#075985' });
    c({ u: 2, v: 1.3, r: 1.3, z0: 100, z1: 126, color: '#bae6fd', top: '#f0f9ff' });
  },
  basketarena(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 104, wall: '#7c2d12', trim: '#f97316', tex: 'metal', window: '#431407', sign: '#431407', door: '#f97316', glass: '#431407' });
    c({ u: 2, v: 1.3, r: 1.2, z0: 104, z1: 126, color: '#f97316', top: '#fdba74' });
    for (let k = 0; k < 5; k += 1) d(1.5 + k * 0.25, 1.3, 126, '#111827', 2, 2);
  },
  rockclub(b, c, d, leaves, palm, front, now) {
    const flame = Math.floor((now || 0) / 150) % 3;
    body(b, d, front, { h: 122, wall: '#0a0a0a', trim: '#f97316', tex: 'stone', window: '#1c1917', lit: 'rgba(249, 115, 22, 0.5)', sign: '#0a0a0a', door: '#7f1d1d', glass: '#1c1917' });
    front(() => {
      for (let i = 0; i < 12; i += 1) d(0.3 + i * 0.3, FACE + 0.04, 6 + ((i + flame) % 3) * 4, i % 2 ? '#f97316' : '#facc15', 5, 10);
    });
  },
  rockstore(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 110, wall: '#292524', trim: '#fde68a', tex: 'stone', window: '#1c1917', sign: '#7f1d1d', door: '#fde68a', glass: '#1c1917',
      goods: (dd) => ['#dc2626', '#facc15', '#111827', '#3b82f6'].forEach((col, i) => { dd(0.45 + i * 0.5, FACE + 0.04, 8, col, 6, 16); dd(0.47 + i * 0.5, FACE + 0.04, 24, '#78350f', 2, 10); }) });
  },
  casino(b, c, d, leaves, palm, front, now) {
    body(b, d, front, { h: 168, wall: '#7f1d1d', trim: '#d4a537', window: '#450a0a', lit: 'rgba(253, 224, 71, 0.6)', sign: '#1a0d06', awning: ['#d4a537', '#7f1d1d'], door: '#d4a537', glass: '#1a0d06' });
    front(() => {
      bulbs(d, 0.2, 3.8, 42, 62, '#fde047', now);
      // Carte e fiches giganti in facciata.
      ['#f8fafc', '#f8fafc'].forEach((col, i) => { d(0.9 + i * 1.6, FACE + 0.05, 130, col, 14, 20); d(0.95 + i * 1.6, FACE + 0.06, 138, i ? '#111827' : '#dc2626', 6, 6); });
    });
    c({ u: 2, v: 1.3, r: 0.7, z0: 174, z1: 196, color: '#d4a537', top: '#fde68a', tex: 'metal' });
    palmTree(c, palm, 0.1, FACE + 0.2, 110);
    palmTree(c, palm, 3.9, FACE + 0.2, 110);
  },
  tobacco(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 106, wall: '#e7e5e4', trim: '#1e3a8a', window: '#1c1917', sign: '#1e3a8a', awning: ['#1e3a8a', '#e7e5e4'], door: '#3b2414', glass: '#1c1917',
      goods: (dd) => ['#dc2626', '#f8fafc', '#facc15', '#2563eb', '#16a34a'].forEach((col, i) => dd(0.4 + i * 0.4, FACE + 0.04, 16, col, 5, 7)) });
    front(() => {
      // La "T" bianca su fondo blu dei tabacchi, sporgente.
      b({ u0: 3.55, v0: FACE, u1: 3.9, v1: FACE + 0.3, z0: 70, z1: 96, color: '#1e3a8a', left: '#1e40af' });
      d(3.72, FACE + 0.3, 92, '#ffffff', 8, 3);
      d(3.72, FACE + 0.3, 88, '#ffffff', 3, 14);
    });
  },
  greenshop(b, c, d, leaves, palm, front) {
    body(b, d, front, { h: 104, wall: '#14532d', trim: '#facc15', tex: 'stone', window: '#052e16', lit: 'rgba(163, 230, 53, 0.5)', sign: '#052e16', awning: ['#16a34a', '#facc15'], door: '#dc2626', glass: '#052e16' });
    front(() => {
      ['#16a34a', '#facc15', '#dc2626'].forEach((col, i) => b({ u0: 0.1, v0: FACE, u1: 3.9, v1: FACE + 0.03, z0: 64 + i * 4, z1: 67 + i * 4, color: col }));
      for (let k = 0; k < 7; k += 1) {
        const a = (k / 7) * Math.PI * 2;
        d(2 + Math.cos(a) * 0.25, FACE + 0.05, 90 + Math.sin(a) * 9, '#4ade80', 4, 4);
      }
    });
  },
  wallstreet(b, c, d, leaves, palm, front, now) {
    // Grattacielo della borsa: vetro blu altissimo, colonne all'ingresso, nastro luminoso delle
    // quotazioni a meta' e l'antenna con la luce rossa in cima.
    const step = Math.floor((now || 0) / 300) % 10;
    body(b, d, front, { h: 250, wall: '#1e3a5f', trim: '#cbd5e1', tex: 'metal', window: '#7dd3fc', lit: 'rgba(224, 242, 254, 0.55)', sign: '#0b1020', door: '#d4a537', glass: '#0c4a6e', roof: '#334155' });
    front(() => {
      b({ u0: 0.1, v0: FACE, u1: 3.9, v1: FACE + 0.04, z0: 120, z1: 132, color: '#0b1020' });
      for (let k = 0; k < 16; k += 1) d(0.2 + ((k * 0.24 + step * 0.06) % 3.6), FACE + 0.05, 129, k % 3 ? '#4ade80' : '#f87171', 6, 5);
      [0.4, 1.2, 2.0].forEach((u) => c({ u: u + 0.15, v: FACE + 0.2, r: 0.07, z0: 0, z1: 40, color: '#e5e7eb', top: '#f8fafc' }));
    });
    c({ u: 2, v: 1.4, r: 0.04, z0: 258, z1: 276, color: '#9ca3af' });
    d(2.02, 1.4, 278, step % 2 ? '#ef4444' : '#7f1d1d', 3, 3);
  },
  generic(b, c, d, leaves, palm, front, now, item) {
    const color = hashColor(item?.plot?.name || item?.id || '');
    body(b, d, front, { h: 120, wall: color, trim: '#f8fafc', window: '#0f172a', lit: 'rgba(253, 230, 138, 0.4)', sign: '#0f172a', awning: [color, '#f8fafc'], door: '#f8fafc' });
  },
  // Lotto ancora libero: cantiere con la gru, per le stanze che verranno.
  empty(b, c) {
    b({ u0: 0.1, v0: 0.1, u1: 3.9, v1: FACE, z1: 4, color: '#a8a29e', tex: 'stone' });
    for (let u = 0.1; u < 3.9; u += 0.5) b({ u0: u, v0: FACE - 0.04, u1: u + 0.25, v1: FACE, z0: 4, z1: 34, color: u % 1 < 0.5 ? '#f59e0b' : '#111827' });
    c({ u: 3.3, v: 0.6, r: 0.06, z0: 4, z1: 150, color: '#f59e0b' });
    b({ u0: 1, v0: 0.55, u1: 3.6, v1: 0.65, z0: 146, z1: 152, color: '#f59e0b' });
    b({ u0: 1.4, v0: 0.6, u1: 1.6, v1: 0.8, z0: 100, z1: 146, color: '#9ca3af' });
  }
};

/** Disegno del lotto: il tema glielo da' il motore (item.theme), dalla stanza assegnata. */
export function drawBuilding(b, { c, d, leaves, palm, front, now, item }) {
  const draw = THEMES[item?.theme] || THEMES.empty;
  draw(b, c, d, leaves, palm, front, now, item);
}

export function themeOf(room) {
  if (!room) return 'empty';
  return ROOM_THEMES[room.id] || 'generic';
}
