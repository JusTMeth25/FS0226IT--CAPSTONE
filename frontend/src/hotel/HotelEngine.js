import { DETAIL, HALF_W, STEP_MS, TILE_H, TILE_W, directionBetween, insideDiamond, parseLayout, tileCenter, tileTop, viewForDirection } from './iso.js';
import { AVATAR_FOOT_X, AVATAR_FOOT_Y, AVATAR_H, AVATAR_SCALE, AVATAR_W, avatarSprite } from './sprites/avatar.js';
import { hoverTileSprite, kartPoint, kartTrack, renderRoom } from './sprites/room.js';
import { lapDelta } from './kartTrack.js';
import { animationState, cardImage, footprintOf, furniSprite, isFlat } from './sprites/furni.js';
import { isSolid } from './sprites/pixel.js';
import { GEM_H, GEM_W, drawSparkle, gemSprite } from './sprites/gem.js';
import { getRarityColor } from '../utils/cardUtils.js';
import { DECOR_DEFS, createWeatherState, drawWeather, isOutdoor, seasonDecor } from './weather.js';
import { BALL_COLORS } from './ui/billiards.jsx';
import { playSfx, volumeAt } from './sfx.js';
import { PET_H, PET_SOUND, PET_W, petSprite } from './sprites/pet.js';
import { BADGE_H, BADGE_W, drawBadge } from './sprites/badge.js';

/** Di quanti pixel base si alza chi e' seduto su una sedia o un divano, rispetto al pavimento. */
const SEAT_LIFT = 7 * DETAIL;

/** Colori delle bibite del bancone (nomi come in RoomInstance.DRINKS). */
const DRINK_COLORS = {
  cola: '#5b2a0e', juice: '#f97316', coffee: '#6b3e1f', bubble: '#ec4899', cocktail: '#22d3ee', tea: '#b45309', gelato: '#f9a8d4',
  pizza: '#fbbf24', book: '#8b5cf6', popcorn: '#fde68a', water: '#7dd3fc'
};

/**
 * Mobili in cui si nuota: lato in caselle e costume. In mare si va in costume, in piscina
 * anche con la cuffia.
 */
const WATER = { pool_water: { size: 1, outfit: 'pool' }, sea_water: { size: 2, outfit: 'sea' } };

/** Di quanto scende in acqua chi nuota: resta fuori dalla vita in su, come su Habbo. */
const SWIM_SINK = 30;
const HEART_MS = 2_200;

/** Il pallone rotola piu' veloce di chi cammina: ms per casella. */
const BALL_STEP_MS = 110;
const GOAL_MS = 2_600;
/** Animazioni dei minigiochi nella stanza: tiro a canestro, boccia sulla pista, caduta dei birilli. */
const SHOT_MS = 750;
const SHOT_HOLD_MS = 180;
const ROLL_MS = 1_100;
const PIN_FALLEN_MS = 1_400;
/** Birilli: posizione laterale (in larghezze di birillo) e fila, come in sportGames.jsx. */
/**
 * Panno dei tavoli da biliardo, in caselle del mobile: da dove a dove si muovono le bilie e a che
 * altezza sta il panno.
 */
const POOL_CLOTH = {
  billiard_table: { u0: 0.34, u1: 3.66, v0: 0.3, v1: 1.7, z: 41 },
  pool_table: { u0: 0.16, u1: 1.84, v0: 0.24, v1: 0.76, z: 35 }
};
const BOWLING_PINS = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2], [-1.5, 3], [-0.5, 3], [0.5, 3], [1.5, 3]];

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
  constructor(canvas, { onTileClick, onAvatarClick, onItemClick, onPlace, onCardClick, reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onTileClick = onTileClick;
    this.onAvatarClick = onAvatarClick;
    this.onItemClick = onItemClick;
    this.onPlace = onPlace;
    this.onCardClick = onCardClick;
    /** Carte disegnate sopra le teste in questo fotogramma (riepiloghi, carte di bandiera): si cliccano. */
    this.cardHotspots = [];

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
    /** Riepiloghi dei pacchetti aperti: valore e carta migliore sopra la testa per qualche secondo. */
    this.recaps = [];
    this.reducedMotion = reducedMotion;
    /** Pallone dello stadio: posizione, caselle ancora da rotolare e quando e' partito. null altrove. */
    this.ball = null;
    /** Scritta del gol al centro dello schermo. */
    this.goalFlash = null;
    /** Meteo e stagione (dal server), particelle della pioggia/neve e decorazioni della stagione. */
    this.weather = null;
    this.weatherState = createWeatherState();
    this.decor = null;
    /** Minigiochi animati: tiri a canestro in volo, bocce in corsa, birilli di ogni pista, palline da golf. */
    this.shots = [];
    this.rolls = [];
    this.lanes = new Map();
    this.golfBalls = new Map();
    this.bagHits = new Map();
    /** Karaoke, pesca e go-kart: note che volano, lenze in acqua, kart in pista (per giocatore). */
    this.singNotes = [];
    this.fishing = new Map();
    this.karts = new Map();
    /** Ping pong: ultimo colpo per tavolo. Freccette: le ultime tre per bersaglio. */
    this.rallies = new Map();
    this.boardDarts = new Map();
    /** Bilie dei tavoli da biliardo: posizioni di prima e di adesso, per scorrere fra un aggiornamento e l'altro. */
    this.poolBalls = new Map();

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
    this.hoverPetId = null;

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

  /** Un'azione riuscita nel minigioco (ripetizione, pugno, passo): l'avatar si muove subito. */
  pulse(userId) {
    const user = this.users.get(userId || this.meId);
    if (!user) return;
    user.pulseAt = performance.now();
    // Panca e tapis roulant non mandano eventi alla stanza: il suono e' solo per chi si allena.
    if (user.game === 'bench') playSfx('lift', 0.7);
    else if (user.game === 'run') playSfx('bounce', 0.35);
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

  /**
   * Centra la stanza nel riquadro visibile. Le stanze grandi come i locali di Habbo non ci stanno
   * tutte: si parte inquadrando il proprio avatar (o la porta) e il resto si vede trascinando.
   */
  centerCamera() {
    if (!this.roomImage) return;
    const { canvas, originX, originY } = this.roomImage;
    const w = canvas.width * this.zoom;
    const h = canvas.height * this.zoom;
    let x = (this.cssWidth - w) / 2;
    let y = (this.cssHeight - h) / 2 + 20;
    const me = this.users.get(this.meId);
    const focus = me ? me.pos : this.room?.door;
    if (focus && (w > this.cssWidth || h > this.cssHeight)) {
      const c = tileCenter(focus.x, focus.y, focus.z || 0);
      if (w > this.cssWidth) x = clamp(this.cssWidth / 2 - (originX + c.x) * this.zoom, this.cssWidth - w, 0);
      if (h > this.cssHeight) y = clamp(this.cssHeight / 2 - (originY + c.y) * this.zoom, this.cssHeight - h, 0);
    }
    this.camera.x = Math.round(x);
    this.camera.y = Math.round(y);
  }

  /** Trascinando la vista la stanza non sparisce mai del tutto: ne resta sempre un pezzo. */
  pan(dx, dy) {
    if (!this.roomImage) return;
    const { canvas } = this.roomImage;
    const keep = 120;
    this.camera.x = clamp(this.camera.x + dx, keep - canvas.width * this.zoom, this.cssWidth - keep);
    this.camera.y = clamp(this.camera.y + dy, keep - canvas.height * this.zoom, this.cssHeight - keep);
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
      case 'match': this.setTeams(message); break;
      case 'emote': this.setEmote(message.id, message.emote, now); break;
      case 'typing': this.setTyping(message.id, message.on); break;
      case 'chat': this.addBubble(message, now); break;
      case 'item_added':
      case 'item_updated': this.items.set(message.item.id, message.item); this.waterTiles = null; this.decor = null; break;
      case 'item_removed': this.items.delete(message.id); this.waterTiles = null; this.decor = null; break;
      case 'weather': this.setWeather(message); break;
      case 'game_fx': this.applyFx(message, now); break;
      case 'hand_item': this.setHandItem(message.id, message.item, message.left); break;
      case 'consume': this.setConsume(message.id, message.item, message.left, now); break;
      case 'minigame': {
        const user = this.users.get(message.id);
        if (user) user.game = message.game;
        break;
      }
      case 'pack_recap': this.recaps = [...this.recaps.filter((r) => r.userId !== message.id), { userId: message.id, data: message, born: now }]; break;
      case 'minigame_score': this.sips.push({ userId: message.id, text: `${message.score} ${message.unit}${message.record ? ' · record!' : ''}`, born: now }); break;
      case 'user_away': {
        const user = this.users.get(message.id);
        if (user) user.away = message.away;
        break;
      }
      case 'jukebox': this.jukeboxOn = message.track >= 0; break;
      case 'room_updated': this.updateRoom(message.room); break;
      case 'respect': this.hearts.push({ userId: message.to, born: now }); break;
      case 'ball': this.rollBall(message, now); break;
      case 'goal':
        this.goalFlash = { team: message.team, label: message.label, by: message.by, winner: message.winner, born: now };
        playSfx('goal', 0.9);
        break;
      default: break;
    }
  }

  /** Il proprietario ha cambiato pavimento o pareti: si ridisegna la stanza, il resto resta. */
  updateRoom(changes) {
    if (!this.room) return;
    const restyle = (changes.floorStyle && changes.floorStyle !== this.room.floorStyle)
      || (changes.wallStyle && changes.wallStyle !== this.room.wallStyle);
    this.room = { ...this.room, ...changes };
    if (restyle) {
      this.roomImage = renderRoom(this.layout, this.room.floorStyle, this.room.door, this.room.wallStyle, this.weather);
      this.decor = null;
    }
  }

  loadRoom(message, now) {
    this.room = message.room;
    this.meId = message.you;
    this.layout = parseLayout(message.room.layout);
    this.weather = message.weather || null;
    this.weatherState = createWeatherState();
    this.decor = null;
    this.shots = [];
    this.rolls = [];
    this.lanes = new Map();
    this.golfBalls = new Map();
    this.singNotes = [];
    this.fishing = new Map();
    this.karts = new Map();
    this.rallies = new Map();
    this.boardDarts = new Map();
    this.track = message.room.floorStyle === 'kart' ? kartTrack(this.layout, message.room.door) : null;
    this.roomImage = renderRoom(this.layout, message.room.floorStyle, message.room.door, message.room.wallStyle, this.weather);
    this.users.clear();
    this.bubbles = [];
    this.items = new Map((message.items || []).map((item) => [item.id, item]));
    this.waterTiles = null;
    this.jukeboxOn = (message.jukebox?.track ?? -1) >= 0;
    this.hearts = [];
    this.sips = [];
    this.recaps = [];
    this.ball = message.ball ? { pos: { x: message.ball.x, y: message.ball.y }, steps: [], stepStart: now, spin: 0 } : null;
    this.goalFlash = null;
    this.setTeams(message.match || {});
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

  /** Squadre della partita allo stadio: chi gioca ha un anello blu o rosso ai piedi. */
  setTeams(message) {
    this.matchPhase = message.phase || null;
    this.teams = new Map();
    (message.blue || []).forEach((p) => this.teams.set(p.id, '#3b82f6'));
    (message.red || []).forEach((p) => this.teams.set(p.id, '#ef4444'));
  }

  updateUser(user) {
    const existing = this.users.get(user.id);
    if (existing) {
      Object.assign(existing, { username: user.username, look: user.look, level: user.level, bestCard: user.bestCard, topCards: user.topCards, pet: user.pet, club: user.club, badge: user.badge });
    }
  }

  setPath(id, from, path, now) {
    const user = this.users.get(id);
    if (!user) return;
    user.pos = { x: from[0], y: from[1], z: from[2] };
    user.steps = path.map(([x, y, z]) => ({ x, y, z }));
    user.stepStart = now;
    user.status = 'idle';
  }

  // ------------------------------------------------------------------ suoni

  /** Suona un effetto come se venisse dalla casella (x, y): piu' piano se e' lontano dal proprio avatar. */
  soundAt(name, x, y, delay = 0, extra) {
    const me = this.users.get(this.meId);
    const d = me && x !== undefined ? Math.hypot(me.pos.x - x, me.pos.y - y) : 0;
    const play = () => playSfx(name, volumeAt(d), extra);
    if (delay > 0) setTimeout(play, delay);
    else play();
  }

  // ------------------------------------------------------------------ minigiochi animati

  /**
   * Evento di un minigioco (dal browser di chi gioca, via server): posa dell'avatar e animazione
   * nella stanza, uguale per tutti.
   */
  applyFx(message, now) {
    const user = this.users.get(message.id);
    const fx = message.fx || {};
    if (user) {
      user.fx = { kind: fx.kind, born: now, arm: fx.arm };
      if (fx.kind === 'hit') user.hits = (user.hits || 0) + 1;
    }
    // Il sacco colpito oscilla.
    if (fx.kind === 'hit' && message.item) this.bagHits.set(message.item, now);
    this.fxSound(message.game, fx, user, this.items.get(message.item));
    if (user) this.leisureFx(message.game, fx, user, now);
    const item = this.items.get(message.item);
    if (item && message.game === 'pong' && fx.kind === 'rally') this.rallies.set(item.id, { toward: fx.x > 0 ? 0 : 1, born: now });
    if (item && message.game === 'darts' && fx.kind === 'dart') {
      const list = [...(this.boardDarts.get(item.id) || []), { u: fx.u || 0, v: fx.v || 0, born: now }].slice(-3);
      this.boardDarts.set(item.id, list);
    }
    if (!item) return;
    if (message.game === 'basket' && fx.kind === 'shoot' && user) {
      this.shots.push({ userId: user.id, item, made: fx.made > 0, swish: fx.swish > 0, off: fx.off || 0, born: now });
    } else if (message.game === 'bowling') {
      const lane = this.laneState(item.id);
      if (fx.kind === 'roll') {
        this.rolls.push({ item, x: fx.x || 0, born: now });
        lane.pending = { fallen: fx.fallen || [], at: now + ROLL_MS };
      } else if (fx.kind === 'reset') {
        lane.resetAt = now + PIN_FALLEN_MS + 300;
      }
    } else if (message.game === 'pool' && fx.kind === 'balls' && Array.isArray(fx.balls)) {
      const prev = this.poolBalls.get(item.id);
      const from = prev ? poolPositions(prev, now) : fx.balls;
      this.poolBalls.set(item.id, { from, to: fx.balls, born: now });
    } else if (message.game.startsWith('golf')) {
      if (fx.kind === 'ball') {
        const prev = this.golfBalls.get(item.id);
        const to = { u: 0.1 + clamp(fx.u ?? 0, 0, 1) * 2.8, v: 0.1 + clamp(fx.v ?? 0, 0, 1) * 1.8 };
        const from = prev && !prev.sunkAt ? golfPosition(prev, now) : to;
        this.golfBalls.set(item.id, { from, to, born: now, sunkAt: 0 });
      } else if (fx.kind === 'hole') {
        const ball = this.golfBalls.get(item.id);
        if (ball) ball.sunkAt = now;
      }
    }
  }

  /** Karaoke, pesca e go-kart: lo stato da animare nella stanza, per chi guarda. */
  leisureFx(game, fx, user, now) {
    const at = user.pos;
    if (game === 'sing' && fx.kind === 'sing') {
      this.singNotes.push({ x: at.x, y: at.y, z: at.z || 0, lane: fx.x || 0, born: now, drift: Math.random() * 2 - 1 });
      if (this.singNotes.length > 40) this.singNotes.shift();
    } else if (game === 'fish') {
      const line = this.fishing.get(user.id);
      if (fx.kind === 'cast') {
        // Il galleggiante finisce in mare, piu' lontano con un lancio forte.
        const reach = 2 + clamp(fx.power || 50, 0, 100) / 30;
        this.fishing.set(user.id, { phase: 'wait', x: at.x + reach, y: at.y, born: now, phaseAt: now });
      } else if (line && (fx.kind === 'bite' || fx.kind === 'reel')) {
        line.phase = fx.kind;
        line.phaseAt = now;
        if (fx.kind === 'bite') this.soundAt('splash', line.x, line.y);
      } else if (line && fx.kind === 'catch') {
        line.phase = 'catch';
        line.phaseAt = now;
        line.points = fx.x || 0;
        this.soundAt('splash', line.x, line.y);
      } else if (fx.kind === 'reset') {
        this.fishing.delete(user.id);
      }
    } else if (game === 'kart' && fx.kind === 'kart') {
      // Posizione e velocita' (giri al secondo x100): fra un aggiornamento e l'altro il kart
      // prosegue da solo alla stessa velocita', e quello disegnato insegue dolcemente la stima.
      const prev = this.karts.get(user.id);
      const u = clamp(fx.u ?? 0, 0, 1);
      this.karts.set(user.id, { u, v: Math.max(0, (fx.v || 0) / 100), at: now, shown: prev ? prev.shown : u, shownAt: prev ? prev.shownAt : now, lap: fx.x || 0 });
      if (user.id === this.meId && now - (this.engineSoundAt || 0) > 900 && (fx.v || 0) > 4) {
        this.engineSoundAt = now;
        this.soundAt('engine', at.x, at.y);
      }
    }
  }

  /** In gara sui kart (con la pista e un aggiornamento recente): l'avatar si disegna sul kart. */
  isRacing(user, now) {
    const kart = this.track && this.karts.get(user.id);
    return !!kart && user.game === 'kart' && now - kart.at < 4000;
  }

  /**
   * Frazione di giro del kart adesso. Il kart disegnato avanza sempre alla sua velocita' e
   * corregge a poco a poco la distanza dalla posizione stimata (ultima ricevuta + velocita' per il
   * tempo passato): cosi' quando arriva un aggiornamento non si ferma e non salta.
   */
  kartU(kart, now) {
    const dt = Math.max(0, now - kart.shownAt);
    kart.shownAt = now;
    const predicted = (kart.u + kart.v * Math.min(0.6, (now - kart.at) / 1000)) % 1;
    const error = lapDelta(kart.shown, predicted);
    if (Math.abs(error) > 0.06) {
      // Troppo lontano (partenza, rientro dopo una pausa): si riallinea di colpo.
      kart.shown = predicted;
      return kart.shown;
    }
    const cruise = (kart.v * dt) / 1000;
    let step = cruise + error * Math.min(1, dt / 250);
    if (kart.v > 0) step = Math.max(cruise * 0.5, step);
    kart.shown = (kart.shown + step + 1) % 1;
    return kart.shown;
  }

  /** Note del karaoke, lenze e galleggianti, kart in pista: sopra la scena. */
  drawLeisure(ctx, now, toScreen, scale) {
    const unit = DETAIL * scale;
    // Ping pong: la pallina vola da una parte all'altra del tavolo con un piccolo arco.
    this.rallies.forEach((rally, itemId) => {
      const item = this.items.get(itemId);
      const t = (now - rally.born) / 650;
      if (!item || t > 1.4) {
        this.rallies.delete(itemId);
        return;
      }
      const k = Math.min(1, t);
      const u = rally.toward ? 0.3 + 2.4 * k : 2.7 - 2.4 * k;
      const w = this.itemScreen(item, u, 1, 26 + Math.sin(k * Math.PI) * 18);
      const p = toScreen(w.x, w.y);
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, 2.2 * unit), 0, Math.PI * 2);
      ctx.fill();
    });
    // Freccette piantate nel bersaglio (il cerchio sta in alto sul mobile).
    this.boardDarts.forEach((list, itemId) => {
      const item = this.items.get(itemId);
      if (!item) {
        this.boardDarts.delete(itemId);
        return;
      }
      list.forEach((dart, i) => {
        const w = this.itemScreen(item, 0.5 + dart.u * 0.3, 0.9, 58 - dart.v * 14);
        const p = toScreen(w.x, w.y);
        ctx.fillStyle = ['#ef4444', '#22c55e', '#3b82f6'][i % 3];
        ctx.fillRect(p.x - unit, p.y - unit, 2 * unit, 2 * unit);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = Math.max(1, unit * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 3 * unit, p.y + 2 * unit);
        ctx.stroke();
      });
    });
    // Note che salgono dalla testa di chi canta.
    this.singNotes = this.singNotes.filter((n) => now - n.born < 1600);
    const colors = ['#22d3ee', '#ec4899', '#fde047'];
    this.singNotes.forEach((n) => {
      const age = (now - n.born) / 1600;
      const c = tileCenter(n.x, n.y, n.z);
      const p = toScreen(c.x, c.y);
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = colors[n.lane % 3];
      ctx.font = `bold ${Math.round(12 * unit)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(n.lane === 2 ? '♫' : '♪', p.x + (n.drift * 10 + Math.sin(age * 6) * 4) * unit, p.y - (44 + age * 28) * unit);
    });
    ctx.globalAlpha = 1;

    // Pesca: lenza dalla punta della canna al galleggiante, che affonda quando abbocca.
    this.fishing.forEach((line, id) => {
      const user = this.users.get(id);
      if (!user || user.game !== 'fish') {
        this.fishing.delete(id);
        return;
      }
      const c = tileCenter(line.x, line.y, 0);
      const bob = toScreen(c.x, c.y);
      const since = now - line.phaseAt;
      let dip = Math.sin(now / 400) * 1.5;
      if (line.phase === 'bite') dip = 5 + Math.sin(now / 60) * 3;
      if (line.phase === 'reel') dip = 3 + Math.sin(now / 90) * 2;
      const tipX = (user.screenX ?? bob.x) + 20 * unit;
      const tipY = (user.headY ?? bob.y) - 8 * unit;
      ctx.strokeStyle = 'rgba(240, 240, 240, 0.85)';
      ctx.lineWidth = Math.max(1, unit * 0.6);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      const sag = line.phase === 'reel' || line.phase === 'bite' ? 4 : 18;
      ctx.quadraticCurveTo((tipX + bob.x) / 2, Math.max(tipY, bob.y) + sag * unit, bob.x, bob.y + dip * unit - 3 * unit);
      ctx.stroke();
      if (line.phase === 'catch') {
        // Il pesce salta fuori dall'acqua, poi sparisce.
        if (since > 1600) {
          this.fishing.delete(id);
          return;
        }
        const jump = Math.sin(Math.min(1, since / 900) * Math.PI) * 40 * unit;
        const size = (6 + (line.points || 0) / 12) * unit;
        ctx.fillStyle = line.points >= 90 ? '#a855f7' : line.points >= 70 ? '#f59e0b' : '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(bob.x, bob.y - jump, size, size * 0.45, Math.sin(since / 120) * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bob.x - size, bob.y - jump);
        ctx.lineTo(bob.x - size * 1.6, bob.y - jump - size * 0.5);
        ctx.lineTo(bob.x - size * 1.6, bob.y - jump + size * 0.5);
        ctx.fill();
        return;
      }
      // Galleggiante rosso e bianco, con i cerchi nell'acqua quando abbocca.
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(bob.x, bob.y + dip * unit - 3 * unit, 2.5 * unit, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(bob.x, bob.y + dip * unit - 3 * unit, 2.5 * unit, 0, Math.PI);
      ctx.fill();
      if (line.phase === 'bite') {
        const r = ((now % 600) / 600) * 12 * unit;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(bob.x, bob.y, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Kart in gara sulla pista: il kart corre lungo la pista con il pilota seduto sopra.
    if (!this.track) return;
    this.karts.forEach((kart, id) => {
      const user = this.users.get(id);
      if (!user || !this.isRacing(user, now)) {
        if (!user || now - kart.at > 4000) this.karts.delete(id);
        return;
      }
      const u = this.kartU(kart, now);
      const p0 = kartPoint(this.track, u);
      const p1 = kartPoint(this.track, (u + 0.004) % 1);
      const c = tileCenter(p0.x, p0.y, 0);
      const at = toScreen(c.x, c.y);
      const wobble = this.reducedMotion ? 0 : Math.round(Math.sin(now / 45) * 0.6 * unit);
      // Verso di marcia sulle caselle: la pista corre lungo gli assi, bastano le quattro rotazioni.
      const dir = (2 + Math.round(Math.atan2(p1.y - p0.y, p1.x - p0.x) / (Math.PI / 4)) + 8) % 8;
      const rot = (Math.round(((dir - 2 + 8) % 8) / 2) * 2) % 8;
      // Il kart e' lo stesso mobile parcheggiato in griglia, che si sposta lungo la pista.
      const kartItem = { id: `race-${id}`, type: 'go_kart', x: p0.x - 0.5, y: p0.y - 0.5, z: 0, rot };
      if (this.catalog.has('go_kart')) {
        const { sprite, left, top } = this.itemSprite(kartItem, now);
        const kp = toScreen(left, top);
        ctx.drawImage(sprite, kp.x, kp.y + wobble, sprite.width * scale, sprite.height * scale);
      }
      // Il pilota seduto nel kart, girato come il kart.
      const savedDir = user.dir;
      user.dir = (2 + rot) % 8;
      const { sprite, left, top, center } = this.spriteFor(user, now);
      user.dir = savedDir;
      const base = toScreen(center.x, center.y);
      const pos = toScreen(left, top);
      const width = AVATAR_W * AVATAR_SCALE * scale;
      const height = AVATAR_H * AVATAR_SCALE * scale;
      ctx.drawImage(sprite, pos.x + at.x - base.x, pos.y + at.y - base.y - 3 * unit + wobble, width, height);
      ctx.font = `bold ${Math.max(10, Math.round(6 * unit))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      const label = `${user.username} · giro ${Math.min(3, kart.lap + 1)}`;
      const labelY = pos.y + at.y - base.y - 10 * unit;
      ctx.strokeText(label, at.x, labelY);
      ctx.fillText(label, at.x, labelY);
    });
  }

  /** Suono di un evento di minigioco, dal punto in cui succede. */
  fxSound(game, fx, user, item) {
    const at = item || user?.pos || {};
    const x = at.x;
    const y = at.y;
    switch (fx.kind) {
      case 'shoot':
        this.soundAt('bounce', x, y);
        this.soundAt(fx.made > 0 ? 'swish' : 'rim', x, y, SHOT_HOLD_MS + SHOT_MS);
        break;
      case 'roll':
        if (game === 'bowling') {
          this.soundAt('roll', x, y);
          if ((fx.fallen || []).length) this.soundAt('pins', x, y, ROLL_MS);
        } else if (game?.startsWith('golf')) this.soundAt('putt', x, y);
        break;
      case 'hole': this.soundAt('cup', x, y); break;
      case 'cue': this.soundAt('clack', x, y); break;
      case 'hit': this.soundAt('punch', x, y); break;
      case 'curl': this.soundAt('lift', x, y); break;
      case 'cast': this.soundAt('splash', x, y); break;
      case 'catch': this.soundAt('reel', x, y); break;
      case 'reel': this.soundAt('reel', x, y); break;
      case 'rally': this.soundAt('clack', x, y); break;
      case 'dart': this.soundAt('punch', x, y); break;
      case 'sing': this.soundAt('note', x, y, 0, fx.x || 0); break;
      case 'lap': this.soundAt('engine', x, y); break;
      default: break;
    }
  }

  laneState(itemId) {
    let lane = this.lanes.get(itemId);
    if (!lane) {
      lane = { fallen: new Set(), fallAt: 0, resetAt: 0, pending: null };
      this.lanes.set(itemId, lane);
    }
    return lane;
  }

  /** Punto (u, v) del mobile, in caselle, girato come il mobile. */
  itemPoint(item, u, v) {
    const def = this.catalog.get(item.type) || { width: 1, length: 1 };
    const W = def.width;
    const L = def.length;
    switch (item.rot) {
      case 2: return { x: item.x + v, y: item.y + u };
      case 4: return { x: item.x + W - u, y: item.y + L - v };
      case 6: return { x: item.x + L - v, y: item.y + W - u };
      default: return { x: item.x + u, y: item.y + v };
    }
  }

  /** Punto del mobile sullo schermo (pixel base), a `z` pixel da terra. */
  itemScreen(item, u, v, z) {
    const p = this.itemPoint(item, u, v);
    const t = tileTop(p.x, p.y, item.z);
    return { x: t.x, y: t.y - z };
  }

  /** Birilli sulla pista (in piedi, o per terra appena caduti) e la boccia che corre. */
  drawLaneExtras(ctx, item, now, toScreen, scale) {
    const lane = this.laneState(item.id);
    if (lane.pending && now >= lane.pending.at) {
      lane.pending.fallen.forEach((pin) => lane.fallen.add(pin));
      lane.fallAt = now;
      lane.pending = null;
    }
    if (lane.resetAt && now >= lane.resetAt) {
      lane.fallen.clear();
      lane.resetAt = 0;
    }
    BOWLING_PINS.forEach(([px, row], i) => {
      const p = toScreen(...Object.values(this.itemScreen(item, 0.5 + px * 0.15, 6.85 + row * 0.27, 4)));
      const fallen = lane.fallen.has(i);
      if (fallen && now - lane.fallAt > PIN_FALLEN_MS) return;
      if (fallen) {
        // Birillo a terra, girato di lato.
        ctx.fillStyle = '#1a1030';
        ctx.fillRect(p.x - 5 * scale, p.y - 3 * scale, 11 * scale, 5 * scale);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(p.x - 4 * scale, p.y - 2 * scale, 9 * scale, 3 * scale);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(p.x, p.y - 2 * scale, scale, 3 * scale);
        return;
      }
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(p.x - 3 * scale, p.y - 14 * scale, 6 * scale, 15 * scale);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(p.x - 2 * scale, p.y - 13 * scale, 4 * scale, 13 * scale);
      ctx.fillRect(p.x - 1 * scale, p.y - 15 * scale, 2 * scale, 2 * scale);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(p.x - 2 * scale, p.y - 10 * scale, 4 * scale, 2 * scale);
    });
    this.rolls = this.rolls.filter((roll) => now - roll.born < ROLL_MS);
    this.rolls.filter((roll) => roll.item.id === item.id).forEach((roll) => {
      const t = (now - roll.born) / ROLL_MS;
      const p = toScreen(...Object.values(this.itemScreen(item, 0.5 + roll.x * 0.15 * t, 0.4 + t * 6.3, 7)));
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Bilie sul tavolo da biliardo, come nel gioco di chi sta tirando. */
  drawPoolBalls(ctx, item, now, toScreen, scale) {
    const state = this.poolBalls.get(item.id);
    if (!state) return;
    const cloth = POOL_CLOTH[item.type];
    const at = poolPositions(state, now);
    const balls = [];
    for (let i = 0; i + 1 < at.length; i += 2) {
      if (at[i] < 0) continue;
      const u = cloth.u0 + at[i] * (cloth.u1 - cloth.u0);
      const v = cloth.v0 + at[i + 1] * (cloth.v1 - cloth.v0);
      balls.push({ n: i / 2, p: toScreen(...Object.values(this.itemScreen(item, u, v, cloth.z + 2))) });
    }
    // Da dietro in avanti, cosi' le bilie vicine coprono quelle lontane.
    balls.sort((a, b) => a.p.y - b.p.y).forEach(({ n, p }) => {
      const r = (item.type === 'billiard_table' ? 2.6 : 1.9) * scale;
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + scale * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n >= 9 ? '#f8fafc' : BALL_COLORS[n];
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (n >= 9) {
        ctx.fillStyle = BALL_COLORS[n];
        ctx.fillRect(p.x - r, p.y - r * 0.4, r * 2, r * 0.8);
      }
    });
  }

  /** Pallina del golf sulla buca vera, che segue i colpi di chi gioca. */
  drawGolfBall(ctx, item, now, toScreen, scale) {
    const ball = this.golfBalls.get(item.id);
    if (!ball) return;
    if (ball.sunkAt && now - ball.sunkAt > 400) {
      if (now - ball.sunkAt > 3_000) this.golfBalls.delete(item.id);
      return;
    }
    const at = golfPosition(ball, now);
    const p = toScreen(...Object.values(this.itemScreen(item, at.u, at.v, 7)));
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Tiri a canestro in volo: parabola dalle mani al ferro, poi dentro la retina o fuori. */
  drawShots(ctx, now, toScreen, scale) {
    this.shots = this.shots.filter((shot) => now - shot.born < SHOT_HOLD_MS + SHOT_MS + 500);
    this.shots.forEach((shot) => {
      const user = this.users.get(shot.userId);
      if (!user?.drawn) return;
      const c = tileCenter(user.drawn.x, user.drawn.y, user.drawn.z);
      const from = { x: c.x, y: c.y - 84 };
      const rim = this.itemScreen(shot.item, 0.5, 0.62, 101);
      const to = { x: rim.x + (shot.made ? 0 : shot.off * 0.6), y: rim.y };
      // Per un attimo il pallone e' ancora fra le mani (lo disegna l'avatar), poi parte.
      const age = now - shot.born - SHOT_HOLD_MS;
      if (age < 0) return;
      let x;
      let y;
      if (age <= SHOT_MS) {
        const t = age / SHOT_MS;
        const lift = 50 + Math.hypot(to.x - from.x, to.y - from.y) * 0.25;
        x = from.x + (to.x - from.x) * t;
        y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * lift;
      } else {
        const t = (age - SHOT_MS) / 500;
        // Dentro: scende nella retina. Fuori: rimbalza sul ferro e cade di lato.
        x = to.x + (shot.made ? 0 : Math.sign(shot.off || 1) * t * 22);
        y = to.y + (shot.made ? t * 26 : -Math.sin(t * Math.PI) * 10 + t * 30);
      }
      const p = toScreen(x, y);
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = Math.max(1, scale);
      ctx.beginPath();
      ctx.moveTo(p.x - 5 * scale, p.y);
      ctx.lineTo(p.x + 5 * scale, p.y);
      ctx.stroke();
    });
  }

  /** Nuovo meteo: cambiando stagione o festa si ridisegnano festoni e decorazioni. */
  setWeather(weather) {
    const restyle = !this.weather || this.weather.season !== weather.season || this.weather.holiday !== weather.holiday
      || this.weather.condition !== weather.condition;
    this.weather = weather;
    if (restyle && this.room) {
      this.roomImage = renderRoom(this.layout, this.room.floorStyle, this.room.door, this.room.wallStyle, weather);
      this.decor = null;
    }
  }

  /** Decorazioni della stagione, calcolate quando servono (cambiano con i mobili e con il meteo). */
  decorations() {
    if (!this.decor) {
      const items = [...this.items.values()].filter((item) => this.catalog.has(item.type) && !this.catalog.get(item.type).wall);
      this.decor = seasonDecor(this.layout, items, (item) => this.footprint(item), this.room?.door, this.room, this.weather);
    }
    return this.decor;
  }

  decorSprite(entry) {
    const key = `decor|${entry.type}`;
    let cached = this.spriteCache.get(key);
    if (!cached) {
      cached = furniSprite(entry, DECOR_DEFS[entry.type]);
      this.spriteCache.set(key, cached);
    }
    const t = tileTop(entry.x, entry.y, entry.z);
    return { sprite: cached.canvas, left: t.x - cached.anchorX, top: t.y - cached.anchorY };
  }

  /** Tiro: il pallone parte da dove si trova ora (anche a meta' di un rotolamento) e segue il percorso. */
  rollBall(message, now) {
    const kicker = message.byId ? this.users.get(message.byId) : null;
    if (kicker) {
      kicker.kickAt = now;
      this.soundAt('kick', kicker.pos.x, kicker.pos.y);
    }
    if (!this.ball) this.ball = { pos: { x: message.x, y: message.y }, steps: [], stepStart: now, spin: 0 };
    const current = this.ballAt(now);
    const path = message.path || [];
    if (!path.length) {
      this.ball.pos = { x: message.x, y: message.y };
      this.ball.steps = [];
      return;
    }
    this.ball.pos = { x: current.x, y: current.y };
    this.ball.steps = path.map(([x, y]) => ({ x, y }));
    this.ball.stepStart = now;
  }

  /** Posizione del pallone in questo istante, con il saltello di ogni casella. */
  ballAt(now) {
    const ball = this.ball;
    while (ball.steps.length && now - ball.stepStart >= BALL_STEP_MS) {
      ball.pos = ball.steps.shift();
      ball.stepStart += BALL_STEP_MS;
      ball.spin += 1;
    }
    if (!ball.steps.length) return { x: ball.pos.x, y: ball.pos.y, lift: 0, rolling: false };
    const next = ball.steps[0];
    const t = Math.min(1, (now - ball.stepStart) / BALL_STEP_MS);
    // Rimbalzi sempre piu' bassi man mano che il pallone rallenta.
    const lift = Math.sin(t * Math.PI) * Math.min(8, 2 + ball.steps.length * 1.2);
    return { x: ball.pos.x + (next.x - ball.pos.x) * t, y: ball.pos.y + (next.y - ball.pos.y) * t, lift, rolling: true };
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
    this.sips.push({ userId: id, text: item === 'book' ? 'sfoglia' : ['pizza', 'gelato', 'popcorn'].includes(item) ? 'gnam!' : 'glu glu', born: now });
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
    this.hoverUserId = this.inMatch() ? null : this.avatarAt(cssX, cssY)?.id || null;
    this.hoverPetId = this.hoverUserId ? null : this.petAt(cssX, cssY)?.id || null;
    this.hoverTile = this.hoverUserId || this.hoverPetId ? null : this.tileAt(cssX, cssY);
  }

  /** Sto giocando una partita di calcio (in squadra, fischio d'inizio gia' dato). */
  inMatch() {
    return !!this.matchPhase && this.matchPhase !== 'lobby' && this.teams?.has(this.meId);
  }

  /** Padrone dell'animale sotto il puntatore (riquadro dello sprite disegnato). */
  petAt(cssX, cssY) {
    return [...this.users.values()].reverse().find((u) => u.pet && u.petBox
      && cssX >= u.petBox.x && cssX <= u.petBox.x + u.petBox.w && cssY >= u.petBox.y && cssY <= u.petBox.y + u.petBox.h) || null;
  }

  click(cssX, cssY) {
    if (this.placement) {
      const tile = this.tileAt(cssX, cssY);
      if (tile) this.onPlace?.(tile, this.placement);
      return;
    }
    // In campo durante una partita ogni click e' un passo: niente schede dei giocatori o carte
    // sopra la testa che aprono finestre a meta' azione.
    if (this.inMatch()) {
      const tile = this.tileAt(cssX, cssY);
      if (tile) this.onTileClick?.(tile);
      return;
    }
    // Una carta sopra la testa (riepilogo di un pacchetto o carte di bandiera): si ispeziona.
    const hotspot = [...this.cardHotspots].reverse()
      .find((h) => cssX >= h.x && cssX <= h.x + h.w && cssY >= h.y && cssY <= h.y + h.h);
    if (hotspot && !this.buildMode) {
      this.onCardClick?.(hotspot.card);
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
  /** Che acqua c'e' in quel punto: 'pool', 'sea' oppure null se si e' all'asciutto. */
  waterAt(at) {
    // Le caselle d'acqua (piscina e mare) si ricalcolano solo quando cambiano i mobili.
    if (!this.waterTiles) {
      this.waterTiles = new Map();
      this.items.forEach((item) => {
        const water = WATER[item.type];
        if (!water) return;
        for (let dx = 0; dx < water.size; dx += 1) {
          for (let dy = 0; dy < water.size; dy += 1) this.waterTiles.set(`${item.x + dx},${item.y + dy}`, water.outfit);
        }
      });
    }
    return this.waterTiles.get(`${Math.round(at.x)},${Math.round(at.y)}`) || null;
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

  /**
   * L'animale da compagnia segue il padrone a meno di un passo, con un po' di ritardo; se resta
   * troppo indietro (cambio stanza, teletrasporto) gli ricompare accanto.
   */
  followPet(user, now) {
    if (!user.pet) {
      user.petAt = null;
      return;
    }
    const owner = user.drawn || user.pos;
    const last = user.petTime || now;
    user.petTime = now;
    if (!user.petAt || Math.hypot(owner.x - user.petAt.x, owner.y - user.petAt.y) > 4) {
      user.petAt = { x: owner.x - 0.6, y: owner.y + 0.3, z: owner.z, walking: false, left: false };
      return;
    }
    const dx = owner.x - user.petAt.x;
    const dy = owner.y - user.petAt.y;
    const d = Math.hypot(dx, dy);
    const gap = 0.75;
    // Affamato va piu' piano.
    const speed = (user.pet.hungry ? 0.5 : 1) * Math.min(1, (now - last) / 220);
    if (d > gap) {
      const step = (d - gap) * speed;
      user.petAt.x += (dx / d) * step;
      user.petAt.y += (dy / d) * step;
      user.petAt.walking = step > 0.002;
      // Sullo schermo la x cresce con (x - y): guarda a sinistra se si sposta da quella parte.
      if (Math.abs(dx - dy) > 0.05) user.petAt.left = dx - dy < 0;
    } else {
      user.petAt.walking = false;
    }
    user.petAt.z += (owner.z - user.petAt.z) * Math.min(1, speed * 2);
    // Il proprio animale ogni tanto abbaia o miagola.
    if (user.id === this.meId && PET_SOUND[user.pet.type] && now > (user.petVoiceAt || 0)) {
      if (user.petVoiceAt) this.soundAt(PET_SOUND[user.pet.type], user.petAt.x, user.petAt.y);
      user.petVoiceAt = now + 25000 + Math.random() * 35000;
    }
  }

  drawPet(ctx, user, now, toScreen, scale) {
    const at = user.petAt;
    const animate = !this.reducedMotion;
    const frame = at.walking && animate ? Math.floor(now / 140) % 2 : 0;
    const sprite = petSprite(user.pet.type, frame, at.left);
    const c = tileCenter(at.x, at.y, at.z);
    const base = toScreen(c.x, c.y);
    const unit = DETAIL * scale;
    const hop = at.walking && animate ? Math.abs(Math.sin(now / 140)) * unit : 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 6 * unit, 2 * unit, 0, 0, Math.PI * 2);
    ctx.fill();
    if (user.away) ctx.globalAlpha = 0.45;
    const x = base.x - (PET_W * unit) / 2;
    const y = base.y - PET_H * unit - hop + unit;
    ctx.drawImage(sprite, x, y, PET_W * unit, PET_H * unit);
    ctx.globalAlpha = 1;
    user.petBox = { x, y, w: PET_W * unit, h: PET_H * unit };
    // Sazio: ogni tanto un cuoricino. Affamato: una ciotola vuota che lampeggia.
    const phase = (now / 1000 + phaseOf(user.id)) % 6;
    const px = Math.max(1, Math.round(unit));
    if (user.pet.hungry) {
      if (!animate || Math.floor(now / 600) % 2 === 0) {
        const bx = base.x - 3 * px;
        const by = y - 5 * px;
        ctx.fillStyle = '#8fa4c8';
        ctx.fillRect(bx, by + 2 * px, 7 * px, 2 * px);
        ctx.fillRect(bx + px, by + 4 * px, 5 * px, px);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + 3 * px, by - 3 * px, px, 3 * px);
      }
    } else if (animate && phase < 1.2) {
      const rise = phase * 8 * px;
      ctx.globalAlpha = 1 - phase / 1.2;
      ctx.fillStyle = '#ff5c8a';
      const hx = base.x - 2 * px;
      const hy = y - 4 * px - rise;
      ctx.fillRect(hx, hy, 2 * px, 2 * px);
      ctx.fillRect(hx + 3 * px, hy, 2 * px, 2 * px);
      ctx.fillRect(hx - px, hy + px, 7 * px, 2 * px);
      ctx.fillRect(hx, hy + 3 * px, 5 * px, px);
      ctx.fillRect(hx + px, hy + 4 * px, 3 * px, px);
      ctx.fillRect(hx + 2 * px, hy + 5 * px, px, px);
      ctx.globalAlpha = 1;
    }
  }

  spriteFor(user, now) {
    const at = user.drawn || { ...user.pos, walking: false };
    const view = viewForDirection(user.dir ?? 2);
    let pose = 'stand';
    let frame = 0;
    const animate = !this.reducedMotion;
    const fx = user.fx;
    const fxAge = fx ? now - fx.born : Infinity;
    if (now - (user.kickAt || 0) < 320) {
      // Calcio al pallone: la gamba parte in avanti, anche di corsa.
      pose = 'kick';
    } else if (at.walking) {
      pose = 'walk';
      frame = Math.floor(now / 125) % 4;
    } else if (user.game === 'bench') {
      // Panca: il bilanciere sale a ogni ripetizione (le proprie in tempo reale, quelle degli altri a ritmo).
      pose = 'lift';
      // Le proprie ripetizioni seguono i tasti premuti (spinta in tre tempi), quelle degli altri vanno a ritmo.
      const since = now - (user.pulseAt || 0);
      frame = user.id === this.meId ? (since < 120 ? 1 : since < 320 ? 2 : since < 480 ? 3 : 0) : (animate ? Math.floor(now / 350) % 4 : 0);
    } else if (user.game === 'run') {
      pose = 'run';
      frame = animate ? Math.floor(now / (user.id === this.meId && now - (user.pulseAt || 0) > 600 ? 260 : 95)) % 4 : 0;
    } else if (user.game === 'box') {
      pose = 'punch';
      // Ogni pugno cambia braccio: si vede dall'evento "hit" (anche per gli altri), altrimenti in guardia.
      frame = fx?.kind === 'hit' && fxAge < 220 ? 1 + ((user.hits || 0) % 2) : (animate && user.id !== this.meId && !fx ? Math.floor(now / 320) % 3 : 0);
    } else if (user.game === 'sing') {
      // Karaoke: microfono alla bocca, ondeggia a tempo con le note.
      pose = 'mic';
      frame = fx?.kind === 'sing' && fxAge < 300 ? 1 : (animate ? Math.floor(now / 500) % 2 : 0);
    } else if (user.game === 'fish') {
      pose = 'fish';
      frame = this.fishing.get(user.id)?.phase === 'reel' && animate ? Math.floor(now / 150) % 2 : 0;
    } else if (user.game === 'pong') {
      // Racchetta: il braccio si muove a ogni colpo.
      pose = 'punch';
      frame = fx?.kind === 'rally' && fxAge < 250 ? 1 : 0;
    } else if (user.game === 'darts') {
      pose = 'shoot';
      frame = fx?.kind === 'dart' && fxAge < 300 ? 1 : 0;
    } else if (user.game === 'curl') {
      pose = 'curl';
      frame = fx?.kind === 'curl' && fxAge < 380 ? (fx.arm === 1 ? 2 : 1) : 0;
    } else if (user.game === 'basket') {
      // Palleggio, poi il tiro: pallone sopra la testa e braccia che si distendono.
      if (fx?.kind === 'shoot' && fxAge < 650) {
        pose = 'shoot';
        frame = fxAge < 180 ? 0 : 1;
      } else {
        pose = 'dribble';
        frame = animate ? Math.floor(now / 140) % 4 : 0;
      }
    } else if (user.game === 'bowling') {
      // Boccia in mano; al lancio caricamento all'indietro e rilascio con il passo in avanti.
      pose = 'bowl';
      frame = fx?.kind === 'roll' && fxAge < 900 ? (fxAge < 300 ? 1 : 2) : 0;
    } else if (user.game?.startsWith('golf')) {
      pose = 'putt';
      frame = fx?.kind === 'roll' && fxAge < 400 ? 1 : 0;
    } else if (user.game === 'rhythm' || user.game === 'claw') {
      pose = 'play';
      frame = animate ? Math.floor(now / 260) % 2 : 0;
    } else if (user.game === 'pool') {
      // Chino sul tavolo con la stecca; al tiro la stecca va avanti.
      pose = 'cue';
      frame = fx?.kind === 'cue' && fxAge < 300 ? 1 : 0;
    } else if (user.status === 'sit') {
      pose = 'sit';
    } else if (user.status === 'dance' || (this.jukeboxOn && user.status !== 'sit' && this.onDanceFloor(at))) {
      pose = 'dance';
      frame = animate ? Math.floor(now / 180) % 4 : 0;
    } else if (user.emote === 'wave' && now < user.emoteUntil) {
      pose = 'wave';
      frame = animate ? Math.floor(now / 250) % 2 : 0;
    }
    // In acqua si nuota in costume (e con la cuffia in piscina); seduti a bordo vasca no.
    const water = user.status !== 'sit' ? this.waterAt(at) : null;
    const sprite = avatarSprite(user.look, { ...view, pose, frame, outfit: water });
    const center = tileCenter(at.x, at.y, at.z);
    if ((pose === 'sit' || pose === 'lift') && this.seatUnder(user)) center.y -= SEAT_LIFT;
    // Sul tapis roulant si corre sopra il nastro, non sul pavimento.
    if (user.game === 'run' && !at.walking) center.y -= 11;
    return { sprite, left: center.x - AVATAR_FOOT_X * AVATAR_SCALE, top: center.y - AVATAR_FOOT_Y * AVATAR_SCALE, center, water };
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
    this.cardHotspots = [];
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
      // Sacco da boxe colpito: dondola e si ferma piano piano.
      const hitAt = item.type === 'punching_bag' ? this.bagHits.get(item.id) : 0;
      if (hitAt && now - hitAt < 900) p.x += Math.sin((now - hitAt) / 70) * 4 * scale * (1 - (now - hitAt) / 900);
      ctx.drawImage(sprite, p.x, p.y, sprite.width * scale, sprite.height * scale);
      if (item.type === 'bowling_lane') this.drawLaneExtras(ctx, item, now, toScreen, scale);
      else if (item.type.startsWith('golf_hole_')) this.drawGolfBall(ctx, item, now, toScreen, scale);
      else if (POOL_CLOTH[item.type]) this.drawPoolBalls(ctx, item, now, toScreen, scale);
    };
    const items = [...this.items.values()].filter((item) => this.catalog.has(item.type));
    const backItems = items.filter((item) => this.itemDepth(item) < -100).sort((a, b) => this.itemDepth(a) - this.itemDepth(b));
    backItems.forEach(drawItem);
    // Foglie, petali e neve per terra; zucche, albero e pupazzo di neve vanno fra gli avatar.
    const decor = this.catalog.size ? this.decorations() : [];
    const drawDecor = (entry) => {
      const { sprite, left, top } = this.decorSprite(entry);
      const p = toScreen(left, top);
      ctx.drawImage(sprite, p.x, p.y, sprite.width * scale, sprite.height * scale);
    };
    decor.filter((entry) => DECOR_DEFS[entry.type].walkable).forEach(drawDecor);

    if (this.hoverTile) {
      const t = tileTop(this.hoverTile.x, this.hoverTile.y, this.hoverTile.z);
      const p = toScreen(t.x - HALF_W, t.y);
      ctx.drawImage(hoverTileSprite(), p.x, p.y, TILE_W * scale, TILE_H * scale);
    }

    // Avatar e mobili in ordine di profondita': chi e' piu' in basso sullo schermo copre chi sta dietro.
    const users = [...this.users.values()];
    users.forEach((u) => { u.drawn = this.advance(u, now); this.followPet(u, now); });
    const ballAt = this.ball ? this.ballAt(now) : null;
    const scene = [
      ...users.filter((user) => !this.isRacing(user, now)).map((user) => ({ kind: 'user', user, depth: this.userDepth(user) })),
      ...users.filter((user) => user.pet && user.petAt).map((user) => ({ kind: 'pet', user, depth: user.petAt.x + user.petAt.y + 0.004 })),
      ...(ballAt ? [{ kind: 'ball', depth: ballAt.x + ballAt.y + 0.005 }] : []),
      ...decor.filter((entry) => !DECOR_DEFS[entry.type].walkable).map((entry) => ({ kind: 'decor', entry, depth: entry.x + entry.y - 0.01 })),
      ...items.filter((item) => this.itemDepth(item) >= -100).map((item) => ({ kind: 'item', item, depth: this.itemDepth(item) }))
    ].sort((a, b) => a.depth - b.depth);

    const labels = [];
    scene.forEach((entry) => {
      if (entry.kind === 'item') {
        drawItem(entry.item);
        return;
      }
      if (entry.kind === 'decor') {
        drawDecor(entry.entry);
        return;
      }
      if (entry.kind === 'pet') {
        this.drawPet(ctx, entry.user, now, toScreen, scale);
        return;
      }
      if (entry.kind === 'ball') {
        const z = Math.max(0, this.layout?.heightAt(Math.round(ballAt.x), Math.round(ballAt.y)) ?? 0);
        const c = tileCenter(ballAt.x, ballAt.y, z);
        drawBall(ctx, toScreen(c.x, c.y), ballAt.lift * scale, 5.5 * DETAIL * scale / 2, this.ball.spin + (ballAt.rolling ? 0.5 : 0));
        return;
      }
      const { user } = entry;
      const { sprite, left, top, center, water } = this.spriteFor(user, now);
      const swimming = !!water;
      const sink = swimming ? SWIM_SINK : 0;
      const shadow = toScreen(center.x, center.y);
      if (!swimming) {
        // Ombra ovale sotto i piedi.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(shadow.x, shadow.y, 8 * DETAIL * scale, 3 * DETAIL * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        const teamColor = this.teams?.get(user.id);
        if (teamColor) {
          ctx.strokeStyle = teamColor;
          ctx.lineWidth = Math.max(2, 1.5 * DETAIL * scale);
          ctx.beginPath();
          ctx.ellipse(shadow.x, shadow.y, 10 * DETAIL * scale, 4 * DETAIL * scale, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
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
          gem: user.bestCard?.rarity, card: hovered ? user.bestCard : null, club: user.club, badge: user.badge
        });
        // Le tre carte di bandiera stanno sopra l'etichetta (e sopra "Carta migliore" se c'e').
        if (user.topCards?.length) {
          labels.push({ kind: 'cards', x: head.x, y: labelY - (hovered && user.bestCard ? 34 : 18), cards: user.topCards, seed: phaseOf(user.id) });
        }
      } else if (user.topCards?.length) {
        // Le carte piu' usate in battaglia (o le piu' preziose) in miniatura sopra la testa.
        labels.push({ kind: 'cards', x: head.x, y: labelY, cards: user.topCards, seed: phaseOf(user.id) });
        if (user.badge) labels.push({ kind: 'badge', x: head.x, y: labelY, badge: user.badge, beside: 'cards', count: user.topCards.length });
      } else if (user.bestCard) {
        // Distintivo della carta migliore: una gemma che galleggia sopra la testa.
        labels.push({ kind: 'gem', x: head.x, y: labelY, rarity: user.bestCard.rarity, seed: phaseOf(user.id) });
        if (user.badge) labels.push({ kind: 'badge', x: head.x, y: labelY, badge: user.badge, beside: 'gem' });
      } else if (user.badge) {
        labels.push({ kind: 'badge', x: head.x, y: labelY, badge: user.badge });
      }
    });

    this.drawShots(ctx, now, toScreen, scale);
    this.drawLeisure(ctx, now, toScreen, scale);
    this.drawPlacement(ctx, now, toScreen, scale);
    // Pioggia, neve, vento e luce del sole sopra le stanze all'aperto.
    if (this.weather && isOutdoor(this.room)) {
      drawWeather(ctx, this.weather, this.weatherState, this.cssWidth, this.cssHeight, now, this.reducedMotion);
    }
    this.drawHearts(ctx, now);
    this.drawSips(ctx, now);
    const animate = !this.reducedMotion;
    // La gemma resta leggibile anche con lo zoom indietro.
    const gemScale = Math.max(1, Math.round(scale * 2));
    const cardScale = Math.max(1, Math.round(scale * 2)) / 2;
    // Animale sotto il mouse: il suo nome (e di chi e') su una targhetta.
    const petOwner = this.hoverPetId && this.users.get(this.hoverPetId);
    if (petOwner?.pet && petOwner.petBox) {
      const { x, y, w } = petOwner.petBox;
      const whose = petOwner.id === this.meId ? '' : ` · di ${petOwner.username}`;
      labels.push({ kind: 'name', x: x + w / 2, y: y - 4, text: `${petOwner.pet.name || 'Animale'}${whose}` });
    }
    labels.forEach((label) => {
      if (label.kind === 'typing') drawTyping(ctx, label);
      else if (label.kind === 'staff') drawStaffTag(ctx, label, gemScale);
      else if (label.kind === 'cards') {
        const bob = animate ? Math.round(Math.sin(now / 450 + label.seed)) * cardScale : 0;
        drawTopCards(ctx, label.x, label.y + bob, label.cards, cardScale, now, animate, this.cardHotspots);
      } else if (label.kind === 'badge') {
        // Il distintivo indossato sta a sinistra della gemma o delle carte, altrimenti da solo.
        const width = BADGE_W * gemScale;
        let right = label.x + width / 2;
        if (label.beside === 'gem') right = label.x - (GEM_W * gemScale) / 2 - 3;
        if (label.beside === 'cards') right = label.x - (label.count * (MINI_W * cardScale) + (label.count - 1) * 3 * cardScale) / 2 - 3;
        drawBadge(ctx, right - width, label.y, label.badge, gemScale);
      } else if (label.kind === 'gem') {
        const bob = animate ? Math.round(Math.sin(now / 450 + label.seed)) * gemScale : 0;
        drawGem(ctx, label.x - (GEM_W * gemScale) / 2, label.y + bob, label.rarity, gemScale, now, animate);
      } else drawName(ctx, label, gemScale, now, animate);
    });
    this.drawRecaps(ctx, now);
    this.drawGoal(ctx, now);
    this.drawBubbles(ctx, now);
  }

  /** "GOL!" grande al centro, nel colore della squadra che ha segnato. */
  drawGoal(ctx, now) {
    const flash = this.goalFlash;
    if (!flash) return;
    const age = now - flash.born;
    if (age > GOAL_MS) {
      this.goalFlash = null;
      return;
    }
    const color = flash.team === 'blue' ? '#3b82f6' : '#ef4444';
    const pop = this.reducedMotion ? 1 : Math.min(1, age / 180) * (1 + Math.sin(age / 90) * 0.04);
    const x = this.cssWidth / 2;
    const y = this.cssHeight * 0.34;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (GOAL_MS - age) / 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(64 * pop)}px "Segoe UI", system-ui, sans-serif`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#0a0716';
    ctx.strokeText('GOL!', x, y);
    ctx.fillStyle = color;
    ctx.fillText('GOL!', x, y);
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.lineWidth = 4;
    const line = flash.winner ? `${flash.by} · vincono i ${flash.label}!` : `${flash.by} · punto ai ${flash.label}`;
    ctx.strokeText(line, x, y + 46);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, x, y + 46);
    ctx.restore();
  }

  /**
   * Riepilogo di un pacchetto sopra chi l'ha aperto: nome del pacchetto, valore delle carte e la
   * miniatura della piu' costosa. Sale piano e dopo qualche secondo sparisce.
   */
  drawRecaps(ctx, now) {
    this.recaps = this.recaps.filter((r) => now - r.born < RECAP_MS);
    this.recaps.forEach((recap) => {
      const user = this.users.get(recap.userId);
      if (!user || user.headY === undefined) return;
      const age = now - recap.born;
      const fade = Math.min(1, (RECAP_MS - age) / 600, age / 200);
      const { data } = recap;
      const w = 176;
      const h = 58;
      const x = Math.round(user.screenX - w / 2);
      const y = Math.round(user.headY - h - 34 - Math.min(10, age / 400));
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = 'rgba(10, 7, 22, 0.92)';
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      const color = getRarityColor(data.top?.rarity);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 8);
      ctx.stroke();
      // Miniatura della carta migliore, con il bordo della rarita'. Tutto il riquadro si clicca.
      if (data.top) this.cardHotspots.push({ x, y, w, h, card: data.top });
      ctx.fillStyle = color;
      ctx.fillRect(x + 6, y + 6, 33, 46);
      const img = data.top ? cardImage(data.top) : null;
      ctx.imageSmoothingEnabled = true;
      if (img) ctx.drawImage(img, x + 8, y + 8, 29, 42);
      else {
        ctx.fillStyle = '#2a1f55';
        ctx.fillRect(x + 8, y + 8, 29, 42);
      }
      ctx.imageSmoothingEnabled = this.zoom < 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#c4b5fd';
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(clip(ctx, `${data.pack} · ${data.count} carte`, w - 54), x + 46, y + 17);
      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(data.total > 0 ? USD.format(data.total) : 'Senza prezzo', x + 46, y + 35);
      ctx.fillStyle = color;
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(clip(ctx, `Top: ${data.top?.name || '—'}`, w - 54), x + 46, y + 50);
      ctx.restore();
    });
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

/**
 * Pallone a pixel: bianco con le macchie nere che girano mentre rotola, ombra sotto che resta a
 * terra quando rimbalza.
 */
function drawBall(ctx, at, lift, r, spin) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const cx = at.x;
  const cy = at.y - r - lift;
  ctx.fillStyle = '#1a1030';
  ctx.beginPath();
  ctx.arc(cx, cy, r + Math.max(1, r * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#111827';
  const turn = (spin % 4) * (Math.PI / 2) * 0.5;
  [[0, 0], [1, 0.9], [2.1, 0.9], [3.2, 0.9], [4.3, 0.9], [5.4, 0.9]].forEach(([a, d]) => {
    const angle = a + turn;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * r * d, cy + Math.sin(angle) * r * d, r * (d ? 0.3 : 0.34), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Bilie fra un aggiornamento e il successivo (arrivano ogni ~130 ms). Quelle in buca valgono -1. */
function poolPositions(state, now) {
  const t = Math.min(1, (now - state.born) / 140);
  return state.to.map((value, i) => {
    const before = state.from[i];
    if (value < 0 || before === undefined || before < 0) return value;
    return before + (value - before) * t;
  });
}

/** Pallina del golf fra un punto e il successivo (la posizione arriva ogni ~120 ms). */
function golfPosition(ball, now) {
  const t = Math.min(1, (now - ball.born) / 130);
  return { u: ball.from.u + (ball.to.u - ball.from.u) * t, v: ball.from.v + (ball.to.v - ball.from.v) * t };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
    case 'popcorn':
      // Secchiello a righe rosse e bianche, sempre meno pieno.
      rect(-1, 0, 10, 11, '#1a1030');
      for (let i = 0; i < 4; i += 1) rect(i * 2, 1, 2, 9, i % 2 ? '#f5f5f5' : '#ef4444');
      rect(0, -2 + (3 - left), 8, 3, color);
      rect(1, -3 + (3 - left), 2, 1, '#fffbeb');
      if (left > 1) rect(5, -3, 2, 1, '#fffbeb');
      break;
    case 'water':
      // Borraccia trasparente con il tappo blu.
      rect(0, -3, 8, 14, '#1a1030');
      rect(2, -2, 4, 2, '#2563eb');
      rect(1, 0, 6, 10, 'rgba(224, 242, 254, 0.85)');
      rect(1, 10 - left * 3, 6, left * 3, color);
      rect(2, 1, 1, 6, 'rgba(255, 255, 255, 0.8)');
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

function drawName(ctx, { x, y, text, me, gem, card, npc, club, badge }, scale, now, animate) {
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  const width = ctx.measureText(text).width + 10;
  // Sigla del club, nel colore del club, subito a sinistra del nome.
  let tagWidth = 0;
  if (club?.tag) {
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    tagWidth = ctx.measureText(club.tag).width + 8;
    ctx.fillStyle = club.color || '#8b5cf6';
    roundRect(ctx, x - width / 2 - tagWidth - 2, y - 13, tagWidth, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(club.tag, x - width / 2 - tagWidth / 2 - 2, y - 7);
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  }
  ctx.fillStyle = npc ? 'rgba(180, 120, 0, 0.95)' : me ? 'rgba(139, 92, 246, 0.9)' : 'rgba(10, 16, 36, 0.85)';
  roundRect(ctx, x - width / 2, y - 14, width, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 7);
  // La gemma sta a sinistra del nome, centrata in altezza sull'etichetta.
  let left = x - width / 2 - tagWidth - (tagWidth ? 2 : 0);
  if (gem) {
    left -= GEM_W * scale + 2;
    drawGem(ctx, left, y - 7 + (GEM_H * scale) / 2, gem, scale, now, animate);
  }
  // Il distintivo scelto dal giocatore chiude la fila a sinistra.
  if (badge) drawBadge(ctx, left - BADGE_W * scale - 2, y - 7 + (BADGE_H * scale) / 2, badge, scale);
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

/** Quanto resta visibile il riepilogo di un pacchetto aperto. */
const RECAP_MS = 7_000;
const USD = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** Taglia un testo con i puntini perche' stia nella larghezza data. */
function clip(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** Miniatura di una carta sopra la testa, in pixel a zoom 1. */
const MINI_W = 15;
const MINI_H = 21;

/**
 * Le tre carte di bandiera in miniatura, a ventaglio, centrate su x e con il fondo in bottom:
 * quella in mezzo sta un po' piu' in alto. Il bordo ha il colore della rarita'.
 */
function drawTopCards(ctx, x, bottom, cards, scale, now, animate, hotspots) {
  const w = MINI_W * scale;
  const h = MINI_H * scale;
  const gap = 3 * scale;
  const order = cards.length === 3 ? [1, 0, 2] : cards.map((_, i) => i);
  const left = x - (cards.length * w + (cards.length - 1) * gap) / 2;
  ctx.imageSmoothingEnabled = true;
  // Prima le laterali, poi quella centrale sopra.
  [...order].reverse().forEach((index) => {
    const card = cards[index];
    const slot = cards.length === 3 ? [1, 0, 2].indexOf(index) : index;
    const cx = Math.round(left + slot * (w + gap));
    const lift = cards.length === 3 && index === 0 ? 3 * scale : 0;
    const cy = Math.round(bottom - h - lift);
    hotspots?.push({ x: cx - 2, y: cy - 2, w: w + 4, h: h + 4, card });
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(cx - scale, cy - scale, w + 2 * scale, h + 2 * scale);
    ctx.fillStyle = getRarityColor(card.rarity);
    ctx.fillRect(cx, cy, w, h);
    const img = cardImage(card);
    if (img) ctx.drawImage(img, cx + scale, cy + scale, w - 2 * scale, h - 2 * scale);
    else {
      ctx.fillStyle = '#2a1f55';
      ctx.fillRect(cx + scale, cy + scale, w - 2 * scale, h - 2 * scale);
    }
    if (card.rarity === 'legendary' && (!animate || Math.floor(now / 220) % 7 < 2)) drawSparkle(ctx, cx + w - 3 * scale, cy, scale);
  });
  ctx.imageSmoothingEnabled = false;
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

