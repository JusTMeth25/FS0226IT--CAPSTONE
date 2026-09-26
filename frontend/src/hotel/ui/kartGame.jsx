import { lapDelta } from '../kartTrack.js';
import KartView from './KartView.jsx';
import { ACCEL, BRAKE, COAST, GRASS_SPEED, HALF, LAPS, MAX_SPEED, STEER, TRACK, TRACK_LENGTH, TRACK_POINTS, WALL, clamp, nearest, pointAt } from './kartWorld.js';

/**
 * Go-kart: si guida davvero. Freccia su/W gas, giu'/S freno, sinistra/destra (A/D) sterzo, tenuti
 * premuti. La pista vista dall'alto, con la telecamera che segue il kart; fuori dall'asfalto
 * l'erba rallenta e alza la polvere, contro le gomme si rimbalza. Tre giri: conta il tempo.
 *
 * Con piu' giocatori sui kart la partenza e' la stessa per tutti (il server manda l'ora del
 * via) e gli avversari compaiono in pista, dalla loro posizione mandata alla stanza.
 */

function formatTime(ms) {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

export const kart = {
  ownStart: true,
  help: 'Tieni premuto SU/W per il gas e GIU\'/S per frenare, SINISTRA/DESTRA (A/D) per sterzare. Resta sull\'asfalto: l\'erba rallenta. Tre giri, conta il tempo.',
  duration: 170_000,
  keys: {
    ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right'
  },
  buttons: [['left', '◀', null], ['brake', 'Freno', 'ph-hand-palm'], ['gas', 'Gas', 'ph-lightning'], ['right', '▶', null]],
  init(start, clockOffset = 0) {
    const grid = pointAt(-0.012);
    // Attesa fino al via comune: ora del server al momento del messaggio, meno il tempo passato da allora.
    const race = start?.raceStart && start?.serverTime
      ? start.raceStart - start.serverTime - (Date.now() - (start.key || Date.now()))
      : (start?.raceStart ? start.raceStart - (Date.now() + clockOffset) : 0);
    return {
      x: grid.x, y: grid.y, heading: grid.angle, speed: 0, index: TRACK_POINTS - 4, u: 0.988,
      wait: Math.max(3000, Math.min(15000, race)), goAt: 0, elapsed: 0, lap: 0, half: false, lapStart: 0, laps: [],
      held: {}, skids: [], dust: [], spin: 0, offTrack: false, fxAt: -1000, finished: false, bumpAt: -1000
    };
  },
  tick(s, dt, emit) {
    if (s.finished) return;
    // Il via e' a un'ora precisa (uguale per tutti i piloti), non dopo tot fotogrammi: su un
    // computer lento il semaforo si spegne comunque in tempo.
    if (!s.goAt) s.goAt = Date.now() + s.wait;
    if (s.wait > 0) {
      s.wait = Math.max(0, s.goAt - Date.now());
      if (s.wait > 0) return;
    }
    const t = dt / 1000;
    s.elapsed += dt;
    const { held } = s;
    // Motore e freni.
    if (held.gas) s.speed += ACCEL * t;
    if (held.brake) s.speed -= BRAKE * t;
    if (!held.gas && !held.brake) s.speed -= COAST * t;
    const limit = s.offTrack ? GRASS_SPEED : MAX_SPEED;
    if (s.speed > limit) s.speed = Math.max(limit, s.speed - 520 * t);
    s.speed = clamp(s.speed, 0, MAX_SPEED);
    // Sterzo: piu' forte a media velocita', quasi niente da fermi.
    const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const grip = Math.min(1, s.speed / 140) * (1 - Math.max(0, s.speed - 300) / 700);
    s.heading += steer * STEER * grip * t;
    s.x += Math.cos(s.heading) * s.speed * t;
    s.y += Math.sin(s.heading) * s.speed * t;
    // Dove si trova rispetto alla pista.
    const near = nearest(s.x, s.y, s.index);
    s.index = near.index;
    s.offTrack = near.dist > HALF;
    if (near.dist > WALL) {
      // Contro le gomme: si torna in pista e si perde velocita'.
      const p = TRACK[near.index];
      const back = (near.dist - WALL) / near.dist;
      s.x -= (s.x - p.x) * back;
      s.y -= (s.y - p.y) * back;
      s.speed *= 0.35;
      s.spin = 400;
      if (s.elapsed - s.bumpAt > 500) {
        s.bumpAt = s.elapsed;
        emit?.({ kind: 'hit' });
      }
    }
    s.spin = Math.max(0, s.spin - dt);
    // Tracce: gomme che stridono in curva, polvere sull'erba.
    if (steer && s.speed > 280 && !s.offTrack) {
      s.skids.push({ x: s.x - Math.cos(s.heading) * 10, y: s.y - Math.sin(s.heading) * 10 });
      if (s.skids.length > 240) s.skids.shift();
    }
    if (s.offTrack && s.speed > 50) s.dust.push({ x: s.x, y: s.y, life: 600 });
    s.dust.forEach((d) => { d.life -= dt; });
    s.dust = s.dust.filter((d) => d.life > 0).slice(-40);
    // Giri: vale solo se si e' passati dalla meta' pista.
    const prevU = s.u;
    s.u = s.index / TRACK_POINTS;
    if (s.u > 0.4 && s.u < 0.6) s.half = true;
    if (lapDelta(prevU, s.u) > 0 && prevU > 0.9 && s.u < 0.1 && s.half) {
      s.half = false;
      s.lap += 1;
      s.laps.push(s.elapsed - s.lapStart);
      s.lapStart = s.elapsed;
      emit?.({ kind: 'lap', x: s.lap });
      if (s.lap >= LAPS) s.finished = true;
    }
    if (s.elapsed - s.fxAt >= 100) {
      s.fxAt = s.elapsed;
      // Posizione per la stanza: frazione di giro e velocita' in giri al secondo (x100).
      emit?.({ kind: 'kart', u: Math.round(s.u * 1000) / 1000, v: Math.round((s.speed / TRACK_LENGTH) * 10000) / 100, x: s.lap });
    }
  },
  press(s, action, pulse) {
    s.held[action] = true;
    if (action === 'gas') pulse();
  },
  release(s, action) {
    s.held[action] = false;
  },
  score: (s) => (s.lap >= LAPS ? clamp(Math.round(300 - s.elapsed / 1000), 0, 260) : 0),
  done: (s) => s.finished,
  view: (s, act, extra) => {
    const best = s.laps.length ? Math.min(...s.laps) : null;
    const rivals = extra?.kartRivals || [];
    const place = 1 + rivals.filter((r) => r.lap + r.u > s.lap + s.u).length;
    return (
      <div className="mg-kart">
        <KartView s={s} rivals={rivals} />
        <div className="mg-kart-hud">
          <span>Giro <b>{Math.min(LAPS, s.lap + 1)}/{LAPS}</b></span>
          <span>Tempo <b>{formatTime(s.elapsed)}</b></span>
          <span>Miglior giro <b>{best ? formatTime(best) : '--'}</b></span>
          {rivals.length > 0 && <span>Posizione <b>{place}°</b></span>}
        </div>
        <div className="mg-meter mg-kart-speed" aria-label="Velocita'">
          <span style={{ width: `${(s.speed / MAX_SPEED) * 100}%`, background: s.offTrack ? '#a16207' : undefined }} />
        </div>
        {s.offTrack && <p className="mg-kart-warn">Sei sull&apos;erba: torna in pista!</p>}
      </div>
    );
  }
};
