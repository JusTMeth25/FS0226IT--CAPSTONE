/**
 * Tiri in porta del palaghiaccio: cinque tiri contro il bersaglio con i quattro buchi negli angoli.
 * Primo tasto: si ferma il mirino che scorre di lato. Secondo tasto: si ferma l'altezza e si tira.
 * Nel buco 10 punti, vicino al buco 5, in porta 2, fuori niente. Massimo 50.
 */

const SHOTS = 5;
const HOLES = [[16, 24], [84, 24], [16, 76], [84, 76]];
const FLIGHT_MS = 420;

function pointsFor(x, y) {
  if (x < 4 || x > 96 || y < 6 || y > 96) return { points: 0, label: 'Fuori!' };
  const d = Math.min(...HOLES.map(([hx, hy]) => Math.hypot(x - hx, y - hy)));
  if (d < 7) return { points: 10, label: 'Nel buco! +10' };
  if (d < 15) return { points: 5, label: 'Vicinissimo! +5' };
  return { points: 2, label: 'In porta +2' };
}

export const hockey = {
  help: 'Premi SPAZIO (o Tira!) per fermare il mirino di lato, poi ancora per l\'altezza: il disco parte. Mira ai buchi negli angoli!',
  duration: 0,
  keys: { ' ': 'shot', Enter: 'shot' },
  buttons: [['shot', 'Tira!', 'ph-target']],
  init: () => ({ t: 0, phase: 'x', x: 50, y: 50, left: SHOTS, points: 0, shots: [], flying: null, result: null }),
  tick(s, dt) {
    s.t += dt;
    if (s.phase === 'x') s.x = 50 + Math.sin(s.t / 380) * 52;
    if (s.phase === 'y') s.y = 50 + Math.sin(s.t / 300) * 52;
    if (s.flying) {
      s.flying.t += dt;
      if (s.flying.t >= FLIGHT_MS) {
        const { x, y } = s.flying;
        const hit = pointsFor(x, y);
        s.points += hit.points;
        s.shots.push({ x, y, points: hit.points });
        s.result = hit.label;
        s.flying = null;
        s.left -= 1;
        s.phase = s.left > 0 ? 'x' : 'done';
      }
    }
  },
  press(s, action, pulse) {
    if (action !== 'shot' || s.flying) return;
    if (s.phase === 'x') {
      s.phase = 'y';
      s.t = 0;
    } else if (s.phase === 'y') {
      s.phase = 'fly';
      s.flying = { x: s.x, y: s.y, t: 0 };
      pulse();
    }
  },
  score: (s) => s.points,
  done: (s) => s.phase === 'done' && !s.flying,
  view: (s) => {
    const flyK = s.flying ? s.flying.t / FLIGHT_MS : 0;
    return (
      <div className="mg-hockey">
        <div className="mg-hockey-rink">
          <div className="mg-hockey-net">
            {HOLES.map(([x, y]) => <span key={`${x}-${y}`} className="mg-hockey-hole" style={{ left: `${x}%`, top: `${y}%` }} />)}
            {s.shots.map((shot, i) => (
              <span key={i} className={`mg-hockey-mark${shot.points >= 10 ? ' top' : shot.points === 0 ? ' miss' : ''}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />
            ))}
            {(s.phase === 'x' || s.phase === 'y') && (
              <>
                <span className="mg-hockey-aim-x" style={{ left: `${s.x}%` }} />
                {s.phase === 'y' && <span className="mg-hockey-aim-y" style={{ top: `${s.y}%` }} />}
              </>
            )}
          </div>
          {s.flying && (
            <span className="mg-hockey-puck" style={{
              left: `${50 + (s.flying.x - 50) * flyK * 0.62}%`,
              top: `${96 - (96 - (8 + s.flying.y * 0.5)) * flyK}%`,
              transform: `translate(-50%, -50%) scale(${1.4 - flyK * 0.7})`
            }} />
          )}
          {!s.flying && s.phase !== 'done' && <span className="mg-hockey-puck idle" />}
        </div>
        <div className="mg-row">
          <span>{s.result || (s.phase === 'y' ? 'Ora l\'altezza…' : 'Ferma il mirino…')}</span>
          <span>Tiri {SHOTS - s.left}/{SHOTS}</span>
          <div className="mg-big">{s.points}<small>punti</small></div>
        </div>
      </div>
    );
  }
};
