/**
 * Gara di ballo della Disco anni 80: le frecce salgono a tempo di musica (120 battiti al minuto)
 * e si preme la freccia giusta quando arriva sulla sagoma in alto, come sulle pedane da ballo.
 *
 * Perfetto 2 punti, bene 1; ogni 10 passi di fila un punto in piu'. Si arriva al massimo a 100.
 */

const BEAT_MS = 500;
/** Tempo di salita di una freccia, dal fondo alla sagoma. */
const TRAVEL_MS = 1600;
const TARGET = 12;
const PERFECT_MS = 70;
const GOOD_MS = 150;
const MAX_SCORE = 100;
const ARROWS = ['left', 'down', 'up', 'right'];

/** Passi di una battuta (4 tempi, a ottavi): quale freccia su quale ottavo, piu' fitti col tempo. */
const PATTERNS = [
  [[0, 0], [2, 3], [4, 1], [6, 2]],
  [[0, 3], [2, 0], [4, 2], [6, 1]],
  [[0, 0], [2, 1], [3, 1], [4, 3], [6, 2]],
  [[0, 2], [1, 1], [2, 3], [4, 0], [6, 3], [7, 2]],
  [[0, 1], [2, 2], [4, 0], [5, 3], [6, 0]]
];

function barNotes(bar, startAt, id) {
  const level = Math.min(PATTERNS.length - 1, Math.floor(bar / 3) + (bar % 2));
  const pattern = PATTERNS[(bar * 3 + level) % PATTERNS.length];
  return pattern.map(([eighth, lane]) => ({ id: id + eighth, lane, at: startAt + (eighth * BEAT_MS) / 2 }));
}

export const disco = {
  help: 'Premi la freccia giusta (o A S W D) quando arriva sulla sagoma in alto. Passi di fila = punti extra!',
  duration: 40_000,
  keys: { ArrowLeft: 0, a: 0, A: 0, ArrowDown: 1, s: 1, S: 1, ArrowUp: 2, w: 2, W: 2, ArrowRight: 3, d: 3, D: 3 },
  buttons: [[0, '←', null], [1, '↓', null], [2, '↑', null], [3, '→', null]],
  init: () => ({ t: 0, bar: 0, notes: [], id: 0, points: 0, combo: 0, best: 0, perfect: 0, good: 0, miss: 0, judge: null, judgeAt: -1000, flash: [0, 0, 0, 0] }),
  tick(s, dt) {
    s.t += dt;
    // Le battute si preparano in anticipo: la freccia parte TRAVEL_MS prima del suo tempo.
    while (s.bar * 4 * BEAT_MS < s.t + TRAVEL_MS + 4 * BEAT_MS) {
      const startAt = 1500 + s.bar * 4 * BEAT_MS;
      s.notes.push(...barNotes(s.bar, startAt, s.id));
      s.id += 10;
      s.bar += 1;
    }
    const late = s.notes.filter((n) => s.t - n.at > GOOD_MS);
    if (late.length) {
      s.miss += late.length;
      s.combo = 0;
      s.judge = 'miss';
      s.judgeAt = s.t;
      s.notes = s.notes.filter((n) => s.t - n.at <= GOOD_MS);
    }
    s.flash = s.flash.map((f) => Math.max(0, f - dt));
  },
  press(s, lane, pulse) {
    const candidates = s.notes.filter((n) => n.lane === lane && Math.abs(n.at - s.t) <= GOOD_MS);
    if (!candidates.length) {
      s.combo = 0;
      s.judge = 'miss';
      s.judgeAt = s.t;
      return;
    }
    const note = candidates.reduce((a, b) => (Math.abs(a.at - s.t) <= Math.abs(b.at - s.t) ? a : b));
    s.notes = s.notes.filter((n) => n !== note);
    const perfect = Math.abs(note.at - s.t) <= PERFECT_MS;
    s.combo += 1;
    s.best = Math.max(s.best, s.combo);
    s.points += (perfect ? 2 : 1) + (s.combo % 10 === 0 ? 1 : 0);
    if (perfect) s.perfect += 1;
    else s.good += 1;
    s.judge = perfect ? 'perfect' : 'good';
    s.judgeAt = s.t;
    s.flash[lane] = 160;
    pulse();
  },
  score: (s) => Math.min(MAX_SCORE, s.points),
  done: (s) => s.points >= MAX_SCORE,
  view: (s) => {
    const judgeText = { perfect: 'PERFETTO!', good: 'BENE', miss: 'MANCATO' }[s.judge];
    const showJudge = judgeText && s.t - s.judgeAt < 500;
    const beat = Math.floor(s.t / BEAT_MS);
    return (
      <div className="mg-disco">
        <div className="mg-disco-floor" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => <span key={i} className={(i + beat) % 3 ? 'on' : ''} style={{ '--c': i % 6 }} />)}
        </div>
        <div className="mg-disco-lanes">
          {ARROWS.map((arrow, lane) => (
            <div key={arrow} className={`mg-disco-lane lane-${lane}${s.flash[lane] ? ' hit' : ''}`}>
              <i className={`ph-fill ph-arrow-fat-${arrow} mg-disco-target`} style={{ top: `${TARGET}%` }} />
              {s.notes.filter((n) => n.lane === lane && n.at - s.t < TRAVEL_MS).map((n) => {
                // Da sotto (100%) alla sagoma (TARGET%): la freccia sale fino al suo tempo.
                const y = TARGET + ((n.at - s.t) / TRAVEL_MS) * (100 - TARGET);
                return <i key={n.id} className={`ph-fill ph-arrow-fat-${arrow} mg-disco-note`} style={{ top: `${y}%` }} />;
              })}
            </div>
          ))}
          {showJudge && <span key={s.judgeAt} className={`mg-disco-judge ${s.judge}`}>{judgeText}</span>}
          {s.combo >= 4 && <span className="mg-disco-combo">{s.combo} di fila</span>}
        </div>
        <div className="mg-row">
          <span>Perfetti {s.perfect} · Bene {s.good} · Mancati {s.miss}</span>
          <div className="mg-big">{Math.min(MAX_SCORE, s.points)}<small>punti</small></div>
        </div>
      </div>
    );
  }
};
