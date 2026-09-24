import { STEP_MS, directionBetween, insideDiamond, parseLayout, tileCenter, tileTop, viewForDirection } from './iso.js';
import { AVATAR_FOOT_X, AVATAR_FOOT_Y, AVATAR_H, AVATAR_W, avatarSprite } from './sprites/avatar.js';
import { hoverTileSprite, renderRoom } from './sprites/room.js';
import { furniSprite, isAnimated } from './sprites/furni.js';

/** Mobili piatti: si disegnano sotto a tutto, come parte del pavimento. */
const FLAT_TYPES = new Set(['rug_vinyl', 'dance_tile']);

/** Di quanti pixel base si alza chi e' seduto su una sedia o un divano, rispetto al pavimento. */
const SEAT_LIFT = 7;

/** Colori delle bibite del bancone (nomi come in RoomInstance.DRINKS). */
const DRINK_COLORS = { cola: '#5b2a0e', juice: '#f97316', coffee: '#f5f5f5', bubble: '#ec4899' };
const HEART_MS = 2_200;

const BUBBLE_H = 20;
const BUBBLE_GAP = 3;
const BUBBLE_DRIFT_MS = 4_000;
const BUBBLE_TOP_MARGIN = 40;
const WAVE_MS = 2_500;

/**
 * Motore grafico di una stanza dell'hotel.
 *
 * Vive fuori da React: riceve i messaggi del server, tiene lo stato che cambia a ogni
 * fotogramma (posizioni interpolate, fumetti) e disegna su un canvas. React gestisce solo i
 * pannelli intorno. Passare ogni passo di un avatar dallo stato di React vorrebbe dire
 * ridisegnare l'albero dei componenti sessanta volte al secondo.
 *
 * Il mondo si disegna a risoluzione base su un canvas piccolo e poi viene ingrandito senza
 * smussature. Testi e fumetti invece si disegnano a piena risoluzione, per restare leggibili.
 */
export class HotelEngine {
  constructor(canvas, { onTileClick, onAvatarClick, onItemClick, onPlace, reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onTileClick = onTileClick;
    this.onAvatarClick = onAvatarClick;
    this.onItemClick = onItemClick;
    this.onPlace = onPlace;

    /** Catalogo dei mobili (type -> regole), arriva da GET /api/furni/catalog. */
    this.catalog = new Map();
    this.items = new Map();
    this.spriteCache = new Map();
    /** Posizionamento in corso: { itemId, type, rot } oppure null. */
    this.placement = null;
    /** Il jukebox suona: la pista si accende e chi ci sta sopra balla. */
    this.jukeboxOn = false;
    /** Cuori del rispetto che salgono sopra la testa di chi lo riceve. */
    this.hearts = [];
    this.reducedMotion = reducedMotion;

    this.zoom = 2;
    this.camera = { x: 0, y: 0 };
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 1;

    this.room = null;
    this.layout = null;
    this.roomImage = null;
    this.users = new Map();
    this.meId = null;
    this.bubbles = [];
    this.lastBubbleDrift = 0;
    this.hoverTile = null;
    this.hoverUserId = null;

    this.frame = 0;
    this.running = false;
    this.loop = this.loop.bind(this);
  }

  // ------------------------------------------------------------------ ciclo di vita

  start() {
    if (this.running) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  resize(cssWidth, cssHeight, dpr) {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.centerCamera();
  }

  setZoom(zoom) {
    this.zoom = zoom;
    this.centerCamera();
  }

  /** Centra la stanza nel riquadro visibile. */
  centerCamera() {
    if (!this.roomImage) return;
    const { canvas } = this.roomImage;
    this.camera.x = Math.round((this.cssWidth - canvas.width * this.zoom) / 2);
    this.camera.y = Math.round((this.cssHeight - canvas.height * this.zoom) / 2 + 20);
  }

  pan(dx, dy) {
    this.camera.x += dx;
    this.camera.y += dy;
  }

  // ------------------------------------------------------------------ messaggi del server

  handle(message, now = performance.now()) {
    switch (message.type) {
      case 'room_state': this.loadRoom(message, now); break;
      case 'user_joined': this.addUser(message.user, now); break;
      case 'user_left': this.users.delete(message.id); break;
      case 'user_path': this.setPath(message.id, message.from, message.path, now); break;
      case 'user_status': this.setStatus(message.id, message.status, message.dir); break;
      case 'user_update': this.updateUser(message.user); break;
      case 'emote': this.setEmote(message.id, message.emote, now); break;
      case 'typing': this.setTyping(message.id, message.on); break;
      case 'chat': this.addBubble(message, now); break;
      case 'item_added':
      case 'item_updated': this.items.set(message.item.id, message.item); break;
      case 'item_removed': this.items.delete(message.id); break;
      case 'hand_item': this.setHandItem(message.id, message.item); break;
      case 'jukebox': this.jukeboxOn = message.track >= 0; break;
      case 'respect': this.hearts.push({ userId: message.to, born: now }); break;
      default: break;
    }
  }

  loadRoom(message, now) {
    this.room = message.room;
    this.meId = message.you;
    this.layout = parseLayout(message.room.layout);
    this.roomImage = renderRoom(this.layout, message.room.floorStyle, message.room.door);
    this.users.clear();
    this.bubbles = [];
    this.items = new Map((message.items || []).map((item) => [item.id, item]));
    this.jukeboxOn = (message.jukebox?.track ?? -1) >= 0;
    this.hearts = [];
    message.users.forEach((user) => this.addUser(user, now));
    this.centerCamera();
  }

  addUser(user, now) {
    this.users.set(user.id, {
      ...user,
      pos: { x: user.x, y: user.y, z: user.z },
      steps: [],
      stepStart: now,
      emote: null,
      emoteUntil: 0,
      typing: false
    });
    if (user.path?.length) this.setPath(user.id, [user.x, user.y, user.z], user.path, now);
  }

  updateUser(user) {
    const existing = this.users.get(user.id);
    if (existing) Object.assign(existing, { username: user.username, look: user.look, level: user.level });
  }

  setPath(id, from, path, now) {
    const user = this.users.get(id);
    if (!user) return;
    user.pos = { x: from[0], y: from[1], z: from[2] };
    user.steps = path.map(([x, y, z]) => ({ x, y, z }));
    user.stepStart = now;
    user.status = 'idle';
  }

  setStatus(id, status, dir) {
    const user = this.users.get(id);
    if (!user) return;
    user.status = status;
    if (typeof dir === 'number') user.dir = dir;
  }

  setEmote(id, emote, now) {
    const user = this.users.get(id);
    if (!user) return;
    user.emote = emote;
    user.emoteUntil = now + WAVE_MS;
  }

  setHandItem(id, item) {
    const user = this.users.get(id);
    if (user) user.handItem = item;
  }

  setTyping(id, on) {
    const user = this.users.get(id);
    if (user) user.typing = on;
  }

  /**
   * Fumetto di chat come su Habbo: nasce sopra chi parla, in una riga in alto, e spinge in su
   * quelli piu' vecchi. Ogni pochi secondi tutti salgono ancora, finche' escono dallo schermo.
   */
  addBubble(message, now) {
    const user = this.users.get(message.id);
    if (!user) return;
    user.typing = false;
    this.bubbles.forEach((b) => { b.row += 1; });
    this.bubbles.push({
      id: `${now}-${Math.random()}`,
      userId: message.id,
      username: user.username,
      text: message.text,
      style: message.style,
      to: message.to,
      anchorX: null,
      row: 0,
      born: now
    });
    this.lastBubbleDrift = now;
    if (this.bubbles.length > 30) this.bubbles.shift();
  }

  // ------------------------------------------------------------------ input

  /** Converte coordinate del riquadro (pixel CSS) in coordinate base del mondo. */
  toWorld(cssX, cssY) {
    if (!this.roomImage) return null;
    return {
      x: (cssX - this.camera.x) / this.zoom - this.roomImage.originX,
      y: (cssY - this.camera.y) / this.zoom - this.roomImage.originY
    };
  }

  /** Avatar sotto il puntatore, controllando la sagoma al pixel, il piu' vicino per primo. */
  avatarAt(cssX, cssY) {
    const world = this.toWorld(cssX, cssY);
    if (!world) return null;
    const drawn = [...this.users.values()].sort((a, b) => this.userDepth(b) - this.userDepth(a));
    for (const user of drawn) {
      const { sprite, left, top } = this.spriteFor(user, performance.now());
      const sx = Math.floor(world.x - left);
      const sy = Math.floor(world.y - top);
      if (sx < 0 || sy < 0 || sx >= AVATAR_W || sy >= AVATAR_H) continue;
      const alpha = sprite.getContext('2d').getImageData(sx, sy, 1, 1).data[3];
      if (alpha > 0) return user;
    }
    return null;
  }

  /** Casella sotto il puntatore, tenendo conto delle altezze: vince quella piu' in primo piano. */
  tileAt(cssX, cssY) {
    const world = this.toWorld(cssX, cssY);
    if (!world || !this.layout) return null;
    let best = null;
    for (let y = 0; y < this.layout.height; y += 1) {
      for (let x = 0; x < this.layout.width; x += 1) {
        const z = this.layout.heightAt(x, y);
        if (z < 0) continue;
        const t = tileTop(x, y, z);
        if (insideDiamond(Math.floor(world.x), Math.floor(world.y), t.x, t.y)) {
          if (!best || x + y > best.x + best.y) best = { x, y, z };
        }
      }
    }
    return best;
  }

  pointerMove(cssX, cssY) {
    if (this.placement) {
      this.hoverUserId = null;
      this.hoverTile = this.tileAt(cssX, cssY);
      return;
    }
    this.hoverUserId = this.avatarAt(cssX, cssY)?.id || null;
    this.hoverTile = this.hoverUserId ? null : this.tileAt(cssX, cssY);
  }

  click(cssX, cssY) {
    if (this.placement) {
      const tile = this.tileAt(cssX, cssY);
      if (tile) this.onPlace?.(tile, this.placement);
      return;
    }
    const user = this.avatarAt(cssX, cssY);
    if (user) {
      this.onAvatarClick?.(user);
      return;
    }
    const item = this.itemAt(cssX, cssY);
    if (item) {
      this.onItemClick?.(item, this.tileAt(cssX, cssY));
      return;
    }
    const tile = this.tileAt(cssX, cssY);
    if (tile) this.onTileClick?.(tile);
  }

  /** Mobile sotto il puntatore, al pixel, il piu' in primo piano per primo. */
  itemAt(cssX, cssY) {
    const world = this.toWorld(cssX, cssY);
    if (!world) return null;
    const now = performance.now();
    const list = [...this.items.values()]
      .filter((item) => this.catalog.has(item.type))
      .sort((a, b) => this.itemDepth(b) - this.itemDepth(a));
    for (const item of list) {
      const { sprite, left, top } = this.itemSprite(item, now);
      const sx = Math.floor(world.x - left);
      const sy = Math.floor(world.y - top);
      if (sx < 0 || sy < 0 || sx >= sprite.width || sy >= sprite.height) continue;
      if (sprite.getContext('2d').getImageData(sx, sy, 1, 1).data[3] > 0) return item;
    }
    return null;
  }

  /** L'avatar e' su una piastrella della pista? */
  onDanceFloor(at) {
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    for (const item of this.items.values()) {
      if (item.type === 'dance_tile' && item.x === x && item.y === y) return true;
    }
    return false;
  }

  /** Sedia o divano sotto l'avatar seduto, se c'e'. */
  seatUnder(user) {
    if (user.status !== 'sit') return null;
    const at = user.drawn || user.pos;
    for (const item of this.items.values()) {
      const def = this.catalog.get(item.type);
      if (!def || def.sitDir < 0) continue;
      const { fx, fy } = this.footprint(item);
      if (at.x >= item.x && at.x < item.x + fx && at.y >= item.y && at.y < item.y + fy) return item;
    }
    return null;
  }

  /** Profondita' di un avatar: chi e' seduto va disegnato subito dopo la sua seduta, sopra di essa. */
  userDepth(user) {
    const seat = this.seatUnder(user);
    return seat ? this.itemDepth(seat) + 0.02 : depth(user);
  }

  footprint(item) {
    const def = this.catalog.get(item.type);
    if (!def || def.wall) return { fx: 1, fy: 1 };
    return item.rot === 2 ? { fx: def.length, fy: def.width } : { fx: def.width, fy: def.length };
  }

  /** Profondita' del mobile: la sua casella piu' vicina a chi guarda. */
  itemDepth(item) {
    const { fx, fy } = this.footprint(item);
    const def = this.catalog.get(item.type);
    if (def?.wall) return -1000 + item.x + item.y;
    if (FLAT_TYPES.has(item.type)) return -500 + item.x + item.y;
    return item.x + fx - 1 + item.y + fy - 1 - 0.01;
  }

  /**
   * Sprite del mobile, in cache. I mobili animati (luci del jukebox, pista) hanno una chiave
   * che cambia ogni 250 ms: si rigenerano solo quando il loro fotogramma cambia davvero.
   */
  itemSprite(item, now) {
    const def = this.catalog.get(item.type);
    const frame = isAnimated(item.type) && !this.reducedMotion ? Math.floor(now / 250) : 0;
    const playing = item.type === 'dance_tile' ? this.jukeboxOn : !!item.playing;
    const key = `${item.id}|${item.type}|${item.rot}|${item.card?.id || ''}|${playing ? 1 : 0}|${frame}`;
    let cached = this.spriteCache.get(key);
    if (!cached) {
      const sprite = furniSprite({ ...item, playing }, def, {
        now: frame * 250,
        // Quando arriva l'immagine della carta, lo sprite in cache non la contiene: via.
        onImageLoad: () => this.clearItemCache(item.id)
      });
      cached = sprite;
      if (this.spriteCache.size > 600) this.spriteCache.clear();
      this.spriteCache.set(key, cached);
    }
    const t = tileTop(item.x, item.y, item.z);
    return { sprite: cached.canvas, left: t.x - cached.anchorX, top: t.y - cached.anchorY };
  }

  clearItemCache(itemId) {
    [...this.spriteCache.keys()].forEach((key) => {
      if (key.startsWith(`${itemId}|`)) this.spriteCache.delete(key);
    });
  }

  /** Il mobile in posizionamento starebbe in questa casella? Stesse regole del server, in anticipo. */
  canPlaceHere(tile) {
    if (!this.placement || !tile || !this.layout) return false;
    const def = this.catalog.get(this.placement.type);
    if (!def) return false;
    const door = this.room?.door;
    const rot = this.placement.rot;
    if (def.wall) {
      const wx = rot === 2 ? tile.x - 1 : tile.x;
      const wy = rot === 2 ? tile.y : tile.y - 1;
      const isDoorTile = (x, y) => door && door.x === x && door.y === y;
      return !isDoorTile(tile.x, tile.y) && !this.layout.isTile(wx, wy) && !isDoorTile(wx, wy);
    }
    const probe = { type: this.placement.type, rot, x: tile.x, y: tile.y };
    const { fx, fy } = this.footprint(probe);
    for (let dx = 0; dx < fx; dx += 1) {
      for (let dy = 0; dy < fy; dy += 1) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (this.layout.heightAt(x, y) !== tile.z) return false;
        if (door && door.x === x && door.y === y) return false;
        for (const other of this.items.values()) {
          if (other.id === this.placement.itemId || this.catalog.get(other.type)?.wall) continue;
          const f = this.footprint(other);
          if (x >= other.x && x < other.x + f.fx && y >= other.y && y < other.y + f.fy) return false;
        }
      }
    }
    return true;
  }

  // ------------------------------------------------------------------ disegno

  /** Avanza lungo il percorso: una casella ogni STEP_MS, come il tick del server. */
  advance(user, now) {
    while (user.steps.length && now - user.stepStart >= STEP_MS) {
      const next = user.steps.shift();
      user.dir = directionBetween(user.pos.x, user.pos.y, next.x, next.y, user.dir);
      user.pos = next;
      user.stepStart += STEP_MS;
    }
    if (!user.steps.length) {
      user.stepStart = now;
      return { ...user.pos, walking: false };
    }
    const next = user.steps[0];
    const t = (now - user.stepStart) / STEP_MS;
    user.dir = directionBetween(user.pos.x, user.pos.y, next.x, next.y, user.dir);
    return {
      x: user.pos.x + (next.x - user.pos.x) * t,
      y: user.pos.y + (next.y - user.pos.y) * t,
      z: user.pos.z + (next.z - user.pos.z) * t,
      walking: true
    };
  }

  spriteFor(user, now) {
    const at = user.drawn || { ...user.pos, walking: false };
    const view = viewForDirection(user.dir ?? 2);
    let pose = 'stand';
    let frame = 0;
    const animate = !this.reducedMotion;
    if (at.walking) {
      pose = 'walk';
      frame = Math.floor(now / 125) % 4;
    } else if (user.status === 'sit') {
      pose = 'sit';
    } else if (user.status === 'dance' || (this.jukeboxOn && user.status !== 'sit' && this.onDanceFloor(at))) {
      pose = 'dance';
      frame = animate ? Math.floor(now / 180) % 4 : 0;
    } else if (user.emote === 'wave' && now < user.emoteUntil) {
      pose = 'wave';
      frame = animate ? Math.floor(now / 250) % 2 : 0;
    }
    const sprite = avatarSprite(user.look, { ...view, pose, frame });
    const center = tileCenter(at.x, at.y, at.z);
    if (pose === 'sit' && this.seatUnder(user)) center.y -= SEAT_LIFT;
    return { sprite, left: center.x - AVATAR_FOOT_X, top: center.y - AVATAR_FOOT_Y, center };
  }

  loop(now) {
    if (!this.running) return;
    this.draw(now);
    this.frame = requestAnimationFrame(this.loop);
  }

  draw(now) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    if (!this.roomImage) return;

    const { canvas: roomCanvas, originX, originY } = this.roomImage;
    const scale = this.zoom;
    const toScreen = (bx, by) => ({
      x: this.camera.x + (originX + bx) * scale,
      y: this.camera.y + (originY + by) * scale
    });

    ctx.drawImage(roomCanvas, this.camera.x, this.camera.y, roomCanvas.width * scale, roomCanvas.height * scale);

    const drawItem = (item) => {
      const { sprite, left, top } = this.itemSprite(item, now);
      const p = toScreen(left, top);
      ctx.drawImage(sprite, p.x, p.y, sprite.width * scale, sprite.height * scale);
    };
    const items = [...this.items.values()].filter((item) => this.catalog.has(item.type));
    const backItems = items.filter((item) => this.itemDepth(item) < -100).sort((a, b) => this.itemDepth(a) - this.itemDepth(b));
    backItems.forEach(drawItem);

    if (this.hoverTile) {
      const t = tileTop(this.hoverTile.x, this.hoverTile.y, this.hoverTile.z);
      const p = toScreen(t.x - 16, t.y);
      ctx.drawImage(hoverTileSprite(), p.x, p.y, 32 * scale, 16 * scale);
    }

    // Avatar e mobili in ordine di profondita': chi e' piu' in basso sullo schermo copre chi sta dietro.
    const users = [...this.users.values()];
    users.forEach((u) => { u.drawn = this.advance(u, now); });
    const scene = [
      ...users.map((user) => ({ kind: 'user', user, depth: this.userDepth(user) })),
      ...items.filter((item) => this.itemDepth(item) >= -100).map((item) => ({ kind: 'item', item, depth: this.itemDepth(item) }))
    ].sort((a, b) => a.depth - b.depth);

    const labels = [];
    scene.forEach((entry) => {
      if (entry.kind === 'item') {
        drawItem(entry.item);
        return;
      }
      const { user } = entry;
      const { sprite, left, top, center } = this.spriteFor(user, now);
      // Ombra ovale sotto i piedi.
      const shadow = toScreen(center.x, center.y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, 8 * scale, 3 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      const p = toScreen(left, top);
      ctx.drawImage(sprite, p.x, p.y, AVATAR_W * scale, AVATAR_H * scale);
      if (user.handItem) drawDrink(ctx, user, p, scale, viewForDirection(user.dir ?? 2));
      const head = toScreen(center.x, top);
      user.headY = head.y;
      user.screenX = head.x;
      if (user.typing) labels.push({ kind: 'typing', x: head.x, y: head.y - 6 });
      if (user.id === this.hoverUserId || user.id === this.meId) {
        labels.push({ kind: 'name', x: head.x, y: head.y - (user.typing ? 22 : 6), text: user.username, me: user.id === this.meId });
      }
    });

    this.drawPlacement(ctx, now, toScreen, scale);
    this.drawHearts(ctx, now);
    labels.forEach((label) => (label.kind === 'typing' ? drawTyping(ctx, label) : drawName(ctx, label)));
    this.drawBubbles(ctx, now);
  }

  /** Cuore che sale sopra chi ha ricevuto rispetto, con la scritta "+1". */
  drawHearts(ctx, now) {
    this.hearts = this.hearts.filter((h) => now - h.born < HEART_MS);
    this.hearts.forEach((heart) => {
      const user = this.users.get(heart.userId);
      if (!user || user.screenX === undefined) return;
      const t = (now - heart.born) / HEART_MS;
      const x = user.screenX;
      const y = (user.headY ?? 0) - 20 - t * 40;
      ctx.globalAlpha = 1 - t * t;
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ec4899';
      ctx.fillText('\u2764', x - 10, y);
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('+1', x + 10, y);
      ctx.globalAlpha = 1;
    });
  }

  /** Anteprima del mobile che si sta posizionando: trasparente, rossa se non ci sta. */
  drawPlacement(ctx, now, toScreen, scale) {
    if (!this.placement || !this.hoverTile) return;
    const ghost = { id: 'ghost', ...this.placement, x: this.hoverTile.x, y: this.hoverTile.y, z: this.hoverTile.z };
    const { sprite, left, top } = this.itemSprite(ghost, now);
    const p = toScreen(left, top);
    const ok = this.canPlaceHere(this.hoverTile);
    ctx.globalAlpha = 0.65;
    ctx.drawImage(sprite, p.x, p.y, sprite.width * scale, sprite.height * scale);
    if (!ok) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.fillRect(p.x, p.y, sprite.width * scale, sprite.height * scale);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  drawBubbles(ctx, now) {
    if (this.bubbles.length && now - this.lastBubbleDrift > BUBBLE_DRIFT_MS) {
      this.bubbles.forEach((b) => { b.row += 1; });
      this.lastBubbleDrift = now;
    }
    const baseY = Math.max(BUBBLE_TOP_MARGIN, this.camera.y + 40);
    this.bubbles = this.bubbles.filter((b) => baseY - b.row * (BUBBLE_H + BUBBLE_GAP) > -BUBBLE_H);

    this.bubbles.forEach((bubble) => {
      // La coda del fumetto resta sopra la posizione di chi ha parlato quando l'ha detto.
      if (bubble.anchorX === null) {
        bubble.anchorX = this.users.get(bubble.userId)?.screenX ?? this.cssWidth / 2;
      }
      drawBubble(ctx, bubble, baseY - bubble.row * (BUBBLE_H + BUBBLE_GAP), this.cssWidth);
    });
  }
}

function depth(user) {
  const at = user.drawn || user.pos;
  return at.x + at.y + at.z * 0.01;
}

/** Bicchiere in mano all'avatar: nella mano verso chi guarda, che cambia lato se lo sprite e' specchiato. */
function drawDrink(ctx, user, p, scale, view) {
  const color = DRINK_COLORS[user.handItem] || '#22d3ee';
  const handX = view.flip ? 2 : 17;
  const handY = 26;
  const x = p.x + handX * scale;
  const y = p.y + handY * scale;
  ctx.fillStyle = '#140d24';
  ctx.fillRect(x - scale, y - scale, 5 * scale, 6 * scale);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x, y, 3 * scale, 4 * scale);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + scale, 3 * scale, 3 * scale);
}

function drawName(ctx, { x, y, text, me }) {
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  const width = ctx.measureText(text).width + 10;
  ctx.fillStyle = me ? 'rgba(139, 92, 246, 0.9)' : 'rgba(10, 16, 36, 0.85)';
  roundRect(ctx, x - width / 2, y - 14, width, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 7);
}

function drawTyping(ctx, { x, y }) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 12, y - 14, 24, 13, 6);
  ctx.fill();
  ctx.fillStyle = '#0a1024';
  [-6, 0, 6].forEach((dx, i) => {
    ctx.globalAlpha = 0.4 + 0.6 * ((Math.floor(performance.now() / 300) + i) % 3 === 0 ? 1 : 0);
    ctx.fillRect(x + dx - 1.5, y - 9, 3, 3);
  });
  ctx.globalAlpha = 1;
}

function drawBubble(ctx, bubble, y, maxWidth) {
  const shout = bubble.style === 'shout';
  const whisper = bubble.style === 'whisper';
  const nameFont = 'bold 12px "Segoe UI", system-ui, sans-serif';
  const textFont = `${shout ? 'bold ' : ''}${whisper ? 'italic ' : ''}12px "Segoe UI", system-ui, sans-serif`;
  const name = whisper && bubble.to ? `${bubble.username} → ${bubble.to}: ` : `${bubble.username}: `;
  const text = shout ? bubble.text.toUpperCase() : bubble.text;

  ctx.font = nameFont;
  const nameWidth = ctx.measureText(name).width;
  ctx.font = textFont;
  const width = Math.min(nameWidth + ctx.measureText(text).width + 16, maxWidth - 8);
  const x = Math.max(4, Math.min(bubble.anchorX - width / 2, maxWidth - width - 4));

  ctx.fillStyle = whisper ? '#d8dcef' : shout ? '#fff4d6' : '#ffffff';
  ctx.strokeStyle = '#0a1024';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, width, BUBBLE_H, 6);
  ctx.fill();
  ctx.stroke();
  if (bubble.row === 0) {
    ctx.beginPath();
    ctx.moveTo(bubble.anchorX - 5, y + BUBBLE_H);
    ctx.lineTo(bubble.anchorX, y + BUBBLE_H + 6);
    ctx.lineTo(bubble.anchorX + 5, y + BUBBLE_H);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0a1024';
  ctx.font = nameFont;
  ctx.fillText(name, x + 8, y + BUBBLE_H / 2 + 1, width - 16);
  ctx.font = textFont;
  ctx.fillText(text, x + 8 + nameWidth, y + BUBBLE_H / 2 + 1, Math.max(0, width - 16 - nameWidth));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

