import { DETAIL, HALF_W, STEP_MS, TILE_H, TILE_W, directionBetween, insideDiamond, parseLayout, tileCenter, tileTop, viewForDirection } from './iso.js';
import { AVATAR_FOOT_X, AVATAR_FOOT_Y, AVATAR_H, AVATAR_SCALE, AVATAR_W, avatarSprite } from './sprites/avatar.js';
import { hoverTileSprite, renderRoom } from './sprites/room.js';
import { animationState, footprintOf, furniSprite, isFlat } from './sprites/furni.js';
import { isSolid } from './sprites/pixel.js';
import { GEM_H, GEM_W, drawSparkle, gemSprite } from './sprites/gem.js';
import { getRarityColor } from '../utils/cardUtils.js';

/** Di quanti pixel base si alza chi e' seduto su una sedia o un divano, rispetto al pavimento. */
const SEAT_LIFT = 7 * DETAIL;

/** Colori delle bibite del bancone (nomi come in RoomInstance.DRINKS). */
const DRINK_COLORS = {
  cola: '#5b2a0e', juice: '#f97316', coffee: '#6b3e1f', bubble: '#ec4899', cocktail: '#22d3ee', tea: '#b45309', gelato: '#f9a8d4',
  pizza: '#fbbf24', book: '#8b5cf6'
};

/** Di quanto scende in acqua chi nuota: resta fuori dalla vita in su, come su Habbo. */
const SWIM_SINK = 30;
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
    /** Modalita' arredo: il clic prende prima i mobili, anche se c'e' un avatar seduto sopra. */
    this.buildMode = false;
    /** Il jukebox suona: la pista si accende e chi ci sta sopra balla. */
    this.jukeboxOn = false;
    /** Cuori del rispetto che salgono sopra la testa di chi lo riceve. */
    this.hearts = [];
    this.sips = [];
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
      case 'hand_item': this.setHandItem(message.id, message.item, message.left); break;
      case 'consume': this.setConsume(message.id, message.item, message.left, now); break;
      case 'user_away': {
        const user = this.users.get(message.id);
        if (user) user.away = message.away;
        break;
      }
      case 'jukebox': this.jukeboxOn = message.track >= 0; break;
      case 'room_updated': this.updateRoom(message.room); break;
      case 'respect': this.hearts.push({ userId: message.to, born: now }); break;
      default: break;
    }
  }

  /** Il proprietario ha cambiato pavimento o pareti: si ridisegna la stanza, il resto resta. */
  updateRoom(changes) {
    if (!this.room) return;
    const restyle = (changes.floorStyle && changes.floorStyle !== this.room.floorStyle)
      || (changes.wallStyle && changes.wallStyle !== this.room.wallStyle);
    this.room = { ...this.room, ...changes };
    if (restyle) this.roomImage = renderRoom(this.layout, this.room.floorStyle, this.room.door, this.room.wallStyle);
  }

  loadRoom(message, now) {
    this.room = message.room;
    this.meId = message.you;
    this.layout = parseLayout(message.room.layout);
    this.roomImage = renderRoom(this.layout, message.room.floorStyle, message.room.door, message.room.wallStyle);
    this.users.clear();
    this.bubbles = [];
    this.items = new Map((message.items || []).map((item) => [item.id, item]));
    this.jukeboxOn = (message.jukebox?.track ?? -1) >= 0;
    this.hearts = [];
    this.sips = [];
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
    if (existing) Object.assign(existing, { username: user.username, look: user.look, level: user.level, bestCard: user.bestCard });
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

  setHandItem(id, item, left) {
    const user = this.users.get(id);
    if (!user) return;
    user.handItem = item;
    user.handLeft = left ?? 3;
  }

  /** Un sorso o un morso: il braccio va alla bocca e sale una scritta, visibili a tutti. */
  setConsume(id, item, left, now) {
    const user = this.users.get(id);
    if (!user) return;
    user.handLeft = left;
    user.sipUntil = now + 900;
    this.sips.push({ userId: id, text: item === 'book' ? 'sfoglia' : ['pizza', 'gelato'].includes(item) ? 'gnam!' : 'glu glu', born: now });
    if (this.sips.length > 20) this.sips.shift();
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
      const sx = Math.floor((world.x - left) / AVATAR_SCALE);
      const sy = Math.floor((world.y - top) / AVATAR_SCALE);
      if (sx < 0 || sy < 0 || sx >= AVATAR_W || sy >= AVATAR_H) continue;
      if (isSolid(sprite, sx, sy)) return user;
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
    if (this.buildMode) {
      const target = this.itemAt(cssX, cssY);
      if (target) {
        this.onItemClick?.(target, this.tileAt(cssX, cssY));
        return;
      }
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
      if (isSolid(sprite, sx, sy)) return item;
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

  /** L'avatar e' nell'acqua della piscina? */
  inWater(at) {
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    for (const item of this.items.values()) {
      if (item.type === 'pool_water' && item.x === x && item.y === y) return true;
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
    return footprintOf(this.catalog.get(item.type), item.rot);
  }

  /** Profondita' del mobile: la sua casella piu' vicina a chi guarda. */
  itemDepth(item) {
    const { fx, fy } = this.footprint(item);
    const def = this.catalog.get(item.type);
    if (def?.wall) return -1000 + item.x + item.y;
    // I mobili a terra si disegnano sotto a tutto, come parte del pavimento.
    if (isFlat(def)) return -500 + item.x + item.y;
    return item.x + fx - 1 + item.y + fy - 1 - 0.01;
  }

  /**
   * Sprite del mobile, in cache. I mobili animati (luci del jukebox, pista) hanno una chiave
   * che cambia ogni 250 ms: si rigenerano solo quando il loro fotogramma cambia davvero.
   */
  itemSprite(item, now) {
    const def = this.catalog.get(item.type);
    const playing = item.type === 'dance_tile' ? this.jukeboxOn : !!item.playing;
    const anim = animationState(item, now, { playing, still: this.reducedMotion });
    // Chiave per aspetto, non per mobile: stesse sedie o stesse piastrelle condividono lo sprite.
    const key = `${item.type}|${item.rot}|${item.card?.id || ''}|${playing ? 1 : 0}|${anim.key}`;
    let cached = this.spriteCache.get(key);
    if (!cached) {
      cached = furniSprite({ ...item, playing, colorIndex: anim.colorIndex }, def, {
        now: anim.now,
        // Quando arriva l'immagine della carta, lo sprite in cache non la contiene: via.
        onImageLoad: () => this.clearCardCache(item.card?.id)
      });
      if (this.spriteCache.size > 600) this.spriteCache.clear();
      this.spriteCache.set(key, cached);
    }
    const t = tileTop(item.x, item.y, item.z);
    return { sprite: cached.canvas, left: t.x - cached.anchorX, top: t.y - cached.anchorY };
  }

  clearCardCache(cardId) {
    if (!cardId) return;
    [...this.spriteCache.keys()].forEach((key) => {
      if (key.includes(`|${cardId}|`)) this.spriteCache.delete(key);
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
          const otherDef = this.catalog.get(other.type);
          if (other.id === this.placement.itemId || otherDef?.wall) continue;
          // Un mobile a terra e uno sopra possono stare sulla stessa casella.
          if (isFlat(otherDef) !== isFlat(def)) continue;
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
    return { sprite, left: center.x - AVATAR_FOOT_X * AVATAR_SCALE, top: center.y - AVATAR_FOOT_Y * AVATAR_SCALE, center };
  }

  loop(now) {
    if (!this.running) return;
    this.draw(now);
    this.frame = requestAnimationFrame(this.loop);
  }

  draw(now) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Zoom indietro: meta' dei pixel, con lo smussamento per non perdere le righe sottili.
    ctx.imageSmoothingEnabled = this.zoom < 1;
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
      const p = toScreen(t.x - HALF_W, t.y);
      ctx.drawImage(hoverTileSprite(), p.x, p.y, TILE_W * scale, TILE_H * scale);
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
      const swimming = user.status !== 'sit' && this.inWater(user.drawn || user.pos);
      const sink = swimming ? SWIM_SINK : 0;
      const shadow = toScreen(center.x, center.y);
      if (!swimming) {
        // Ombra ovale sotto i piedi.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(shadow.x, shadow.y, 8 * DETAIL * scale, 3 * DETAIL * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const p = toScreen(left, top + sink);
      const width = AVATAR_W * AVATAR_SCALE * scale;
      const height = AVATAR_H * AVATAR_SCALE * scale;
      // Chi e' su un'altra pagina del sito resta nella stanza, ma sbiadito.
      if (user.away) ctx.globalAlpha = 0.45;
      if (swimming) {
        // In acqua si vede solo la parte sopra la superficie, con le onde attorno alla vita.
        const surface = shadow.y - 4 * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x - 4, p.y - 4, width + 8, surface - p.y + 4);
        ctx.clip();
        ctx.drawImage(sprite, p.x, p.y, width, height);
        ctx.restore();
        const wave = this.reducedMotion ? 0 : Math.sin(now / 300 + user.x) * 2 * scale;
        ctx.strokeStyle = 'rgba(214, 244, 255, 0.85)';
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath();
        ctx.ellipse(shadow.x, surface, (14 + Math.abs(wave)) * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.drawImage(sprite, p.x, p.y, width, height);
      }
      ctx.globalAlpha = 1;
      if (user.handItem) drawDrink(ctx, user, p, scale * AVATAR_SCALE, viewForDirection(user.dir ?? 2), now < (user.sipUntil || 0));
      const head = toScreen(center.x, top + sink);
      user.headY = head.y;
      user.screenX = head.x;
      if (user.typing) labels.push({ kind: 'typing', x: head.x, y: head.y - 6 });
      const labelY = head.y - (user.typing ? 22 : 6);
      const hovered = user.id === this.hoverUserId;
      if (user.npc && hovered) {
        // Personale e ospiti dell'hotel: nome e mestiere su una targhetta dorata.
        labels.push({ kind: 'name', x: head.x, y: labelY, text: `${user.username} · ${user.npc.title}`, npc: true });
      } else if (user.npc) {
        labels.push({ kind: 'staff', x: head.x, y: labelY });
      } else if (hovered || user.id === this.meId || user.away) {
        const text = user.away ? `${user.username} (assente)` : user.username;
        labels.push({
          kind: 'name', x: head.x, y: labelY, text, me: user.id === this.meId,
          gem: user.bestCard?.rarity, card: hovered ? user.bestCard : null
        });
      } else if (user.bestCard) {
        // Distintivo della carta migliore: una gemma che galleggia sopra la testa.
        labels.push({ kind: 'gem', x: head.x, y: labelY, rarity: user.bestCard.rarity, seed: phaseOf(user.id) });
      }
    });

    this.drawPlacement(ctx, now, toScreen, scale);
    this.drawHearts(ctx, now);
    this.drawSips(ctx, now);
    const animate = !this.reducedMotion;
    // La gemma resta leggibile anche con lo zoom indietro.
    const gemScale = Math.max(1, Math.round(scale * 2));
    labels.forEach((label) => {
      if (label.kind === 'typing') drawTyping(ctx, label);
      else if (label.kind === 'staff') drawStaffTag(ctx, label, gemScale);
      else if (label.kind === 'gem') {
        const bob = animate ? Math.round(Math.sin(now / 450 + label.seed)) * gemScale : 0;
        drawGem(ctx, label.x - (GEM_W * gemScale) / 2, label.y + bob, label.rarity, gemScale, now, animate);
      } else drawName(ctx, label, gemScale, now, animate);
    });
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

  /** Scritte dei sorsi e dei morsi ("glu glu", "gnam!") che salgono sopra chi consuma. */
  drawSips(ctx, now) {
    this.sips = this.sips.filter((s) => now - s.born < 1_200);
    this.sips.forEach((sip) => {
      const user = this.users.get(sip.userId);
      if (!user || user.screenX === undefined) return;
      const t = (now - sip.born) / 1_200;
      ctx.globalAlpha = 1 - t * t;
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1030';
      ctx.fillText(sip.text, user.screenX + 21, (user.headY ?? 0) - 9 - t * 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sip.text, user.screenX + 20, (user.headY ?? 0) - 10 - t * 26);
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

/**
 * Oggetto in mano all'avatar: bicchiere, tazza, cocktail o cono gelato, nella mano verso chi
 * guarda (che cambia lato se lo sprite e' specchiato).
 */
function drawDrink(ctx, user, p, scale, view, sipping) {
  const color = DRINK_COLORS[user.handItem] || '#22d3ee';
  // Mentre beve o mangia, l'oggetto sale alla bocca.
  const x = p.x + (sipping ? (view.flip ? 12 : 30) : (view.flip ? 6 : 36)) * scale;
  const y = p.y + (sipping ? 30 : 55) * scale;
  // Quanto ne resta, da 3 a 1: la bevanda cala, il cibo si accorcia.
  const left = Math.max(1, Math.min(3, user.handLeft ?? 3));
  const s = scale;
  const rect = (dx, dy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + dx * s, y + dy * s, w * s, h * s);
  };
  switch (user.handItem) {
    case 'pizza': {
      const w = 3 + left * 2;
      rect(-1, 0, w + 2, 8, '#1a1030');
      rect(0, 1, w, 6, '#e8b45a');
      rect(1, 1, w - 2, 4, '#ef4444');
      rect(2, 2, 2, 1, '#fde68a');
      if (left > 1) rect(5, 3, 2, 1, '#fde68a');
      rect(3, 4, 1, 1, '#16a34a');
      break;
    }
    case 'book':
      rect(-1, -1, 9, 11, '#1a1030');
      rect(0, 0, 7, 9, color);
      rect(0, 0, 1, 9, '#5b21b6');
      rect(2, 2, 4, 1, '#fde68a');
      rect(6, 1, 1, 7, '#f5f5f5');
      break;
    case 'gelato':
      rect(1, 2, 6, 10, '#1a1030');
      rect(2, 3, 4, 8, '#d9a066');
      rect(3, 5, 2, 1, '#b07a45');
      rect(0, -4, 8, 7, '#1a1030');
      rect(1, -3 + (3 - left), 6, 5 - (3 - left), color);
      rect(2, -3 + (3 - left), 2, 1, '#ffe4f1');
      if (left === 3) rect(3, -5, 2, 2, '#ef4444');
      break;
    case 'cocktail':
      rect(-1, -1, 10, 5, '#1a1030');
      rect(0, 3 - left, 8, left, color);
      rect(3, 3, 2, 5, '#1a1030');
      rect(1, 7, 6, 2, '#1a1030');
      rect(5, -5, 1, 5, '#ec4899');
      rect(4, -6, 4, 2, '#fbbf24');
      break;
    case 'coffee':
    case 'tea':
      rect(-1, 1, 9, 8, '#1a1030');
      rect(0, 2, 7, 6, '#f5f5f5');
      rect(0, 2 + (3 - left), 7, 1 + Math.min(1, left - 1), color);
      rect(7, 3, 2, 3, '#f5f5f5');
      rect(2, -2, 1, 2, 'rgba(255, 255, 255, 0.5)');
      rect(4, -3, 1, 2, 'rgba(255, 255, 255, 0.5)');
      break;
    default:
      rect(-1, -1, 8, 11, '#1a1030');
      rect(0, 0, 6, 9, '#e5e7eb');
      rect(0, 9 - left * 2 - 1, 6, left * 2 + 1, color);
      rect(1, 3, 1, 4, 'rgba(255, 255, 255, 0.6)');
  }
}

/** Piccola stella dorata sopra la testa degli NPC: si capisce subito chi lavora nell'hotel. */
const STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#'];

function drawStaffTag(ctx, { x, y }, scale) {
  const s = scale;
  const left = Math.round(x - 2.5 * s);
  const top = Math.round(y - 8 * s);
  const cells = [];
  STAR.forEach((row, r) => [...row].forEach((c, col) => { if (c === '#') cells.push([col, r]); }));
  ctx.fillStyle = '#1a1030';
  cells.forEach(([col, r]) => ctx.fillRect(left + (col - 1) * s, top + (r - 1) * s, 3 * s, 3 * s));
  ctx.fillStyle = '#ffd700';
  cells.forEach(([col, r]) => ctx.fillRect(left + col * s, top + r * s, s, s));
  ctx.fillStyle = '#fff7cc';
  ctx.fillRect(left + 2 * s, top + 2 * s, s, s);
}

function drawName(ctx, { x, y, text, me, gem, card, npc }, scale, now, animate) {
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  const width = ctx.measureText(text).width + 10;
  ctx.fillStyle = npc ? 'rgba(180, 120, 0, 0.95)' : me ? 'rgba(139, 92, 246, 0.9)' : 'rgba(10, 16, 36, 0.85)';
  roundRect(ctx, x - width / 2, y - 14, width, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 7);
  // La gemma sta a sinistra del nome, centrata in altezza sull'etichetta.
  if (gem) drawGem(ctx, x - width / 2 - GEM_W * scale - 2, y - 7 + (GEM_H * scale) / 2, gem, scale, now, animate);
  if (card) {
    ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
    const label = `Carta migliore: ${card.name}`;
    const cardWidth = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(10, 7, 22, 0.9)';
    roundRect(ctx, x - cardWidth / 2, y - 30, cardWidth, 13, 4);
    ctx.fill();
    ctx.fillStyle = getRarityColor(card.rarity);
    ctx.fillText(label, x, y - 23.5);
  }
}

/** Sfasamento stabile per utente, cosi' le gemme non ondeggiano tutte insieme. */
function phaseOf(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 7;
}

/** Gemma della carta migliore con il fondo in (x, bottom); le leggendarie scintillano. */
function drawGem(ctx, x, bottom, rarity, scale, now, animate) {
  const left = Math.round(x);
  const top = Math.round(bottom - GEM_H * scale);
  ctx.drawImage(gemSprite(rarity), left, top, GEM_W * scale, GEM_H * scale);
  if (rarity === 'legendary' && (!animate || Math.floor(now / 220) % 7 < 2)) {
    drawSparkle(ctx, left + 7 * scale, top + scale, scale);
  }
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

