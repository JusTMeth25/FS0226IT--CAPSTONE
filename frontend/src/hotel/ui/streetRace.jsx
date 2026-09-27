import StreetRaceView from './StreetRaceView.jsx';
import { ACCEL, BRAKE, COAST, HALF, LAPS, MAX_SPEED, STEER, TRACK, TRACK_LENGTH, nearest, pointAtDistance } from './streetWorld.js';

/**
 * Gara in citta' con le auto sportive: dal semaforo del quartiere, due giri fra i palazzi contro
 * tre avversari. Su/W gas, giu'/S freno, sinistra/destra (A/D) sterzo. Contro i marciapiedi e i
 * palazzi l'auto rimbalza e rallenta. Punti: fino a 300 per il tempo, piu' 100, 60 o 30 per il
 * podio (massimo 400). L'auto e' quella che si possiede (il colore), o una rossa del noleggio.
 */

const RIVALS = [
  { name: 'Enzo', color: '#d91a1a', top: 470, lane: -40 },
  { name: 'Lola', color: '#f5c518', top: 455, lane: 40 },
  { name: 'Max', color: '#f4f4f5', top: 440, lane: 0 }
];

export const street = {
  ownStart: true,
  wide: true,
  help: 'SU/W gas, GIU\'/S freno, SINISTRA/DESTRA (A/D) sterzo. Due giri fra i palazzi: niente marciapiedi!',
  duration: 200_000,
  keys: {
    ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right'
  },
  buttons: [['left', '◀', null], ['brake', 'Freno', 'ph-hand-palm'], ['gas', 'Gas', 'ph-lightning'], ['right', '▶', null]],
  init() {
    const start = pointAtDistance(-60, 0);
    return {
      x: start.x, y: start.y, heading: start.angle, speed: 0, index: TRACK.length - 3, progress: -60, lastIndex: TRACK.length - 3,
      wait: 3200, elapsed: 0, held: {}, finished: false, place: 0, bumpAt: -9999, skids: [],
      rivals: RIVALS.map((r, i) => ({ ...r, s: -120 - i * 70, v: 0 }))
    };
  },
  tick(s, dt) {
    if (s.finished) return;
    if (s.wait > 0) {
      s.wait = Math.max(0, s.wait - dt);
      return;
    }
    const t = dt / 1000;
    s.elapsed += dt;
    const { held } = s;
    if (held.gas) s.speed += ACCEL * t;
    if (held.brake) s.speed -= BRAKE * t;
    if (!held.gas && !held.brake) s.speed -= COAST * t;
    s.speed = Math.max(-80, Math.min(MAX_SPEED, s.speed));
    const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const grip = Math.min(1, Math.abs(s.speed) / 160);
    s.heading += steer * STEER * grip * t * Math.sign(s.speed || 1);
    s.x += Math.cos(s.heading) * s.speed * t;
    s.y += Math.sin(s.heading) * s.speed * t;
    // Fuori dall'asfalto: contro il marciapiede, l'auto torna in strada e perde velocita'.
    const near = nearest(s.x, s.y, s.index);
    if (near.dist > HALF) {
      const p = TRACK[near.index];
      const k = (near.dist - HALF + 2) / near.dist;
      s.x -= (s.x - p.x) * k;
      s.y -= (s.y - p.y) * k;
      if (s.elapsed - s.bumpAt > 250) {
        s.speed *= 0.45;
        s.bumpAt = s.elapsed;
      }
    }
    if (steer && s.speed > 360) s.skids = [...s.skids.slice(-80), { x: s.x, y: s.y }];
    // Avanzamento lungo la pista (con i giri), per sapere la posizione.
    let step = near.index - s.index;
    if (step < -TRACK.length / 2) step += TRACK.length;
    if (step > TRACK.length / 2) step -= TRACK.length;
    s.progress += (step * TRACK_LENGTH) / TRACK.length;
    s.index = near.index;
    // Avversari: seguono la pista, frenano in curva.
    s.rivals.forEach((r) => {
      const ahead = pointAtDistance(r.s + 160);
      const target = r.top * (1 - Math.min(0.5, ahead.curve * 2.2));
      r.v += Math.sign(target - r.v) * Math.min(Math.abs(target - r.v), (r.v < target ? 260 : 520) * t);
      r.s += r.v * t;
    });
    if (s.progress >= LAPS * TRACK_LENGTH) {
      s.finished = true;
      s.place = 1 + s.rivals.filter((r) => r.s >= LAPS * TRACK_LENGTH).length;
    }
  },
  press(s, action) {
    s.held[action] = true;
  },
  release(s, action) {
    s.held[action] = false;
  },
  score: (s) => {
    if (!s.finished) return 0;
    const time = Math.max(0, Math.round(300 - (s.elapsed / 1000) * 2.5));
    return Math.min(400, time + [0, 100, 60, 30, 0][s.place] || 0);
  },
  done: (s) => s.finished,
  view: (s, act, extra) => <StreetRaceView s={s} color={extra?.carColor} />
};
