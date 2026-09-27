/**
 * Meteo e stagioni nell'hotel.
 *
 * Il server manda stagione, condizione del cielo, temperatura e feste (HotelWeather.java), uguali
 * per tutti. Qui si decide come si vedono:
 * - nelle stanze all'aperto (giardino, terrazza, spiaggia, stadio, minigolf) pioggia, neve, vento,
 *   nebbia, sole e caldo si disegnano sopra la stanza, con una tinta per la luce;
 * - in tutte le stanze ci sono le decorazioni della stagione: foglie in autunno, petali in
 *   primavera, neve d'inverno all'aperto, zucche ad Halloween, albero e regali a Natale, e un
 *   festone lungo le pareti.
 * Le decorazioni sono solo grafica: non occupano caselle e non si cliccano.
 */

/** Pareti delle stanze all'aperto. */
// Stanze all'aperto: meteo e luce del giorno.
const OUTDOOR_WALLS = new Set(['hedge', 'skyline', 'seaside', 'stadium', 'street']);

export function isOutdoor(room) {
  return !!room && OUTDOOR_WALLS.has(room.wallStyle);
}

/** Icona Phosphor per la condizione del cielo. */
export const WEATHER_ICONS = {
  sunny: 'ph-sun', hot: 'ph-thermometer-hot', cloudy: 'ph-cloud', rain: 'ph-cloud-rain', storm: 'ph-cloud-lightning',
  wind: 'ph-wind', fog: 'ph-cloud-fog', cold: 'ph-thermometer-cold', snow: 'ph-snowflake'
};

// ------------------------------------------------------------------ decorazioni

/** Regole dei mobili finti delle decorazioni, come quelle del catalogo. */
export const DECOR_DEFS = {
  decor_leaves: { width: 1, length: 1, wall: false, walkable: true, sitDir: -1 },
  decor_petals: { width: 1, length: 1, wall: false, walkable: true, sitDir: -1 },
  decor_snow: { width: 1, length: 1, wall: false, walkable: true, sitDir: -1 },
  decor_pumpkin: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 },
  decor_tree: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 },
  decor_gifts: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 },
  decor_snowman: { width: 1, length: 1, wall: false, walkable: false, sitDir: -1 }
};

function noise(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Decorazioni della stanza: mobili finti su caselle libere, sempre gli stessi per la stessa
 * stanza e la stessa stagione. Quelli "in piedi" (zucche, albero) vanno accanto alle pareti, dove
 * si passa meno.
 */
export function seasonDecor(layout, items, footprintOf, door, room, weather) {
  if (!layout || !weather) return [];
  const taken = new Set();
  items.forEach((item) => {
    const { fx, fy } = footprintOf(item);
    for (let dx = 0; dx < fx; dx += 1) for (let dy = 0; dy < fy; dy += 1) taken.add(`${item.x + dx},${item.y + dy}`);
  });
  const nearDoor = (x, y) => door && Math.max(Math.abs(x - door.x), Math.abs(y - door.y)) <= 2;
  const free = [];
  const walls = [];
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (!layout.isTile(x, y) || taken.has(`${x},${y}`) || nearDoor(x, y)) continue;
      free.push({ x, y, z: Math.max(0, layout.heightAt(x, y)) });
      if (!layout.isTile(x - 1, y) || !layout.isTile(x, y - 1)) walls.push({ x, y, z: Math.max(0, layout.heightAt(x, y)) });
    }
  }
  const outdoor = isOutdoor(room);
  const seed = [...(room?.id || 'room')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const decor = [];
  // Tappeto di foglie, petali o neve: piu' fitto all'aperto.
  const carpet = weather.season === 'autumn' ? 'decor_leaves'
    : weather.season === 'spring' && outdoor ? 'decor_petals'
      : (weather.condition === 'snow' || (weather.season === 'winter' && outdoor)) && outdoor ? 'decor_snow' : null;
  if (carpet) {
    const density = outdoor ? (carpet === 'decor_snow' ? 0.55 : 0.22) : 0.06;
    free.forEach((t) => {
      if (noise(t.x, t.y, seed) < density) decor.push({ id: `decor-${t.x}-${t.y}`, type: carpet, x: t.x, y: t.y, z: t.z, rot: 0 });
    });
  }
  // Oggetti in piedi lungo le pareti: zucche, albero di Natale con i regali, pupazzo di neve.
  const standing = [];
  if (weather.holiday === 'halloween') standing.push('decor_pumpkin', 'decor_pumpkin', 'decor_pumpkin');
  if (weather.holiday === 'christmas') standing.push('decor_tree', 'decor_gifts', 'decor_gifts');
  if (outdoor && (weather.condition === 'snow' || weather.season === 'winter')) standing.push('decor_snowman');
  const spots = walls.map((t) => ({ ...t, k: noise(t.x, t.y, seed + 7) })).sort((a, b) => a.k - b.k);
  const used = new Set();
  standing.forEach((type) => {
    const spot = spots.find((t) => !used.has(`${t.x},${t.y}`) && ![...used].some((u) => {
      const [ux, uy] = u.split(',').map(Number);
      return Math.abs(ux - t.x) + Math.abs(uy - t.y) < 4;
    }));
    if (!spot) return;
    used.add(`${spot.x},${spot.y}`);
    decor.push({ id: `decor-${type}-${spot.x}-${spot.y}`, type, x: spot.x, y: spot.y, z: spot.z, rot: 0 });
  });
  return decor;
}

/**
 * Festone lungo la cima delle pareti, per stagione: lucine a Natale, foglie in autunno, fiori in
 * primavera, bandierine d'estate. Riceve la colonna lungo il muro e l'altezza; null se li' non c'e'.
 */
export function garlandPaint(weather) {
  if (!weather) return null;
  const palettes = {
    christmas: ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#f472b6'],
    halloween: ['#f97316', '#1f1f1f', '#a855f7'],
    autumn: ['#b45309', '#d97706', '#dc2626', '#a16207'],
    spring: ['#f9a8d4', '#fde68a', '#c4b5fd', '#86efac'],
    summer: ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f97316'],
    winter: ['#e0f2fe', '#bae6fd', '#ffffff']
  };
  const key = weather.holiday || weather.season;
  const colors = palettes[key] || palettes.summer;
  const lights = key === 'christmas' || key === 'winter';
  return (col, h, height) => {
    // Filo che scende a festoni ogni 48 pixel.
    const phase = (col % 48) / 48;
    const sag = Math.round(Math.sin(phase * Math.PI) * 8);
    const wire = height - 22 - sag;
    if (h === wire) return '#374151';
    const index = Math.floor(col / 12);
    const color = colors[index % colors.length];
    if (lights) {
      // Lucine tonde appese al filo.
      const cx = index * 12 + 6;
      const bulbTop = height - 22 - Math.round(Math.sin(((cx % 48) / 48) * Math.PI) * 8);
      return Math.abs(col - cx) <= 1 && h < bulbTop && h >= bulbTop - 3 ? color : null;
    }
    // Bandierine triangolari o foglie: triangolo sotto il filo.
    const inFlag = col % 12;
    const depth = h < wire ? wire - h : -1;
    if (inFlag >= 2 && inFlag <= 10 && depth > 0 && depth <= 7 - Math.abs(inFlag - 6)) return color;
    return null;
  };
}

// ------------------------------------------------------------------ effetti all'aperto

/** Particelle del meteo, create una volta per stanza e fatte scorrere a ogni fotogramma. */
export function createWeatherState() {
  return { drops: [], flakes: [], leaves: [], lastFlash: 0, flashUntil: 0, lastNow: 0 };
}

function fill(list, count, make) {
  while (list.length < count) list.push(make());
  list.length = count;
}

/**
 * Disegna il meteo sopra la stanza (coordinate dello schermo). `reduced` riduce il movimento:
 * resta solo la tinta, senza particelle.
 */
export function drawWeather(ctx, weather, state, width, height, now, reduced) {
  if (!weather) return;
  const dt = Math.min(64, now - (state.lastNow || now));
  state.lastNow = now;
  const c = weather.condition;
  const wind = (weather.wind || 10) / 60;

  // Tinta della luce.
  const tints = {
    sunny: 'rgba(255, 214, 120, 0.08)', hot: 'rgba(255, 140, 60, 0.14)', cloudy: 'rgba(90, 100, 120, 0.16)',
    rain: 'rgba(40, 60, 100, 0.2)', storm: 'rgba(20, 25, 60, 0.3)', wind: 'rgba(120, 140, 150, 0.08)',
    fog: 'rgba(210, 215, 225, 0.28)', cold: 'rgba(150, 200, 255, 0.14)', snow: 'rgba(200, 225, 255, 0.16)'
  };
  ctx.fillStyle = tints[c] || 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, width, height);

  if (c === 'sunny' || c === 'hot') {
    // Raggi di sole dall'angolo in alto a destra.
    const grad = ctx.createRadialGradient(width * 0.9, -40, 20, width * 0.9, -40, height * 0.9);
    grad.addColorStop(0, c === 'hot' ? 'rgba(255, 190, 90, 0.35)' : 'rgba(255, 240, 180, 0.3)');
    grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  if (c === 'fog') {
    const grad = ctx.createLinearGradient(0, height, 0, height * 0.3);
    grad.addColorStop(0, 'rgba(230, 232, 240, 0.35)');
    grad.addColorStop(1, 'rgba(230, 232, 240, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  if (c === 'cold' || c === 'snow') {
    // Brina ai bordi.
    const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.7);
    grad.addColorStop(0, 'rgba(220, 240, 255, 0)');
    grad.addColorStop(1, 'rgba(220, 240, 255, 0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  if (reduced) return;

  const area = (width * height) / 10_000;
  if (c === 'rain' || c === 'storm') {
    fill(state.drops, Math.round(area * (c === 'storm' ? 9 : 6)), () => ({ x: Math.random() * width, y: Math.random() * height, s: 0.7 + Math.random() * 0.5 }));
    ctx.strokeStyle = 'rgba(190, 215, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const slant = 0.25 + wind * 0.4;
    state.drops.forEach((d) => {
      d.y += dt * 0.9 * d.s;
      d.x += dt * 0.9 * d.s * slant;
      if (d.y > height) { d.y = -10; d.x = Math.random() * width; }
      if (d.x > width) d.x -= width;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 10 * slant, d.y - 10);
    });
    ctx.stroke();
    if (c === 'storm') {
      // Lampo ogni tanto: tutto bianco per un attimo.
      if (now - state.lastFlash > 6_000 && Math.random() < dt / 4_000) {
        state.lastFlash = now;
        state.flashUntil = now + 140;
      }
      if (now < state.flashUntil) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(0, 0, width, height);
      }
    }
  }
  if (c === 'snow') {
    fill(state.flakes, Math.round(area * 4), () => ({ x: Math.random() * width, y: Math.random() * height, r: 1 + Math.random() * 2.2, p: Math.random() * 6 }));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    state.flakes.forEach((f) => {
      f.y += dt * 0.04 * f.r;
      f.x += Math.sin(now / 900 + f.p) * 0.3 + wind * dt * 0.02;
      if (f.y > height) { f.y = -4; f.x = Math.random() * width; }
      if (f.x > width) f.x -= width;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (c === 'wind' || (weather.season === 'autumn' && (c === 'cloudy' || c === 'rain'))) {
    // Foglie e folate che attraversano lo schermo.
    const colors = weather.season === 'spring' ? ['#f9a8d4', '#fde68a', '#86efac'] : ['#b45309', '#d97706', '#dc2626', '#65a30d'];
    fill(state.leaves, Math.round(area * (c === 'wind' ? 1.4 : 0.5)), () => ({
      x: Math.random() * width, y: Math.random() * height, p: Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)]
    }));
    state.leaves.forEach((l) => {
      l.x += dt * (0.12 + wind * 0.35);
      l.y += Math.sin(now / 400 + l.p) * 0.6 + dt * 0.02;
      if (l.x > width + 10) { l.x = -10; l.y = Math.random() * height; }
      if (l.y > height) l.y = 0;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(now / 300 + l.p);
      ctx.fillStyle = l.color;
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    });
    if (c === 'wind') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i += 1) {
        const y = ((i * 97 + now * 0.05) % height);
        const x = ((now * 0.6 + i * 211) % (width + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 40, y - 6, x + 90, y);
        ctx.stroke();
      }
    }
  }
  if (c === 'hot') {
    // Aria che tremola per il caldo, in basso.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 12; i += 1) {
      const y = height - 30 - i * 12 + Math.sin(now / 200 + i) * 3;
      ctx.fillRect(0, y, width, 2);
    }
  }
}
