/**
 * Controller Xbox One, PS4 e PS5 tramite la Gamepad API del browser (anche nella WebView
 * dell'app Android e iOS).
 *
 * Un solo ciclo legge il controller usato per ultimo e trasforma i suoi tasti in eventi con nomi
 * logici, uguali per tutte le marche: A (✕), B (○), X (□), Y (△), LB/RB (L1/R1), LT/RT (L2/R2),
 * VIEW (Share/Create), MENU (Options), L3, R3, le quattro direzioni (croce o levetta sinistra)
 * e HOME. Le direzioni tenute premute si ripetono, come un tasto della tastiera.
 *
 * Gli ascoltatori hanno una priorita': chi sta piu' in alto (un minigioco, la tastiera a schermo)
 * riceve l'evento per primo e, restituendo true, lo tiene per se'.
 */

const STANDARD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'];
// Firefox su Windows legge i controller Sony senza la mappatura standard: tasti in un altro ordine.
const SONY_RAW = ['X', 'A', 'B', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'HOME'];
export const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

const STICK = 0.55;
const REPEAT_DELAY = 380;
const REPEAT_EVERY = 110;

const handlers = [];
const statusListeners = new Set();
let pressed = new Set();
let since = {};
let lastRepeat = {};
let axes = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };
let info = null;
let raf = 0;

function kindOf(id = '') {
  const s = id.toLowerCase();
  if (/xbox|045e|xinput/.test(s)) return 'xbox';
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(s)) {
    return /dualsense|0ce6|0df2/.test(s) ? 'ps5' : 'ps4';
  }
  return 'xbox';
}

function emit(event) {
  for (const h of [...handlers].sort((a, b) => b.priority - a.priority)) {
    try {
      if (h.fn(event) === true) return;
    } catch (err) {
      console.error('Gamepad handler', err);
    }
  }
}

function setStatus(next) {
  const same = (info?.index ?? null) === (next?.index ?? null) && info?.kind === next?.kind;
  info = next;
  if (!same) statusListeners.forEach((fn) => fn(next));
}

/** Croce dei controller Sony letti senza mappatura standard: e' un unico asse a otto posizioni. */
function hatDirections(value, out) {
  if (value === undefined || value > 1.05) return;
  const positions = [-1, -0.714, -0.428, -0.142, 0.142, 0.428, 0.714, 1];
  const i = positions.reduce((best, p, k) => (Math.abs(p - value) < Math.abs(positions[best] - value) ? k : best), 0);
  const dirs = [['UP'], ['UP', 'RIGHT'], ['RIGHT'], ['DOWN', 'RIGHT'], ['DOWN'], ['DOWN', 'LEFT'], ['LEFT'], ['UP', 'LEFT']][i];
  dirs.forEach((d) => out.add(d));
}

function read(gp) {
  const now = new Set();
  const standard = gp.mapping === 'standard';
  const names = standard ? STANDARD : (kindOf(gp.id) === 'xbox' ? STANDARD : SONY_RAW);
  gp.buttons.forEach((b, i) => {
    const name = names[i];
    if (!name) return;
    const value = typeof b === 'object' ? b.value : b;
    const down = typeof b === 'object' ? b.pressed || value > 0.5 : b > 0.5;
    if (down) now.add(name);
  });
  const a = gp.axes;
  const rx = standard ? a[2] : a[2];
  const ry = standard ? a[3] : (a.length > 5 ? a[5] : a[3]);
  if (!standard && kindOf(gp.id) !== 'xbox') hatDirections(a[9], now);
  axes = {
    lx: a[0] || 0,
    ly: a[1] || 0,
    rx: rx || 0,
    ry: ry || 0,
    lt: standard ? gp.buttons[6]?.value || 0 : 0,
    rt: standard ? gp.buttons[7]?.value || 0 : 0
  };
  if (axes.lx < -STICK) now.add('LEFT');
  if (axes.lx > STICK) now.add('RIGHT');
  if (axes.ly < -STICK) now.add('UP');
  if (axes.ly > STICK) now.add('DOWN');
  return now;
}

function releaseAll() {
  pressed.forEach((button) => emit({ type: 'up', button }));
  pressed = new Set();
  since = {};
}

function loop() {
  raf = requestAnimationFrame(loop);
  const pads = [...(navigator.getGamepads?.() || [])].filter((p) => p && p.connected);
  if (!pads.length) {
    if (info) {
      releaseAll();
      setStatus(null);
    }
    return;
  }
  // Il controller usato per ultimo comanda: si puo' passare dall'uno all'altro senza scollegarli.
  const gp = pads.reduce((best, p) => (p.timestamp > best.timestamp ? p : best), pads[0]);
  setStatus({ index: gp.index, id: gp.id, kind: kindOf(gp.id) });
  const now = read(gp);
  const t = performance.now();
  now.forEach((button) => {
    if (!pressed.has(button)) {
      since[button] = t;
      lastRepeat[button] = t;
      emit({ type: 'down', button });
    } else if (DIRECTIONS.includes(button) && t - since[button] > REPEAT_DELAY && t - lastRepeat[button] > REPEAT_EVERY) {
      lastRepeat[button] = t;
      emit({ type: 'repeat', button, held: t - since[button] });
    }
  });
  pressed.forEach((button) => {
    if (!now.has(button)) emit({ type: 'up', button });
  });
  pressed = now;
  if (Math.abs(axes.rx) > 0.2 || Math.abs(axes.ry) > 0.2 || Math.abs(axes.lx) > 0.15 || Math.abs(axes.ly) > 0.15) {
    emit({ type: 'axes', axes });
  }
}

function start() {
  if (raf || typeof window === 'undefined' || !navigator.getGamepads) return;
  raf = requestAnimationFrame(loop);
}

if (typeof window !== 'undefined') {
  // Il browser mostra il controller solo dopo il primo tasto premuto: da li' parte il ciclo.
  window.addEventListener('gamepadconnected', start);
  window.addEventListener('blur', releaseAll);
  if ([...(navigator.getGamepads?.() || [])].some(Boolean)) start();
}

export const gamepad = {
  /** Ascolta gli eventi del controller; true dal gestore = evento consumato. */
  subscribe(fn, priority = 0) {
    const entry = { fn, priority };
    handlers.push(entry);
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    };
  },
  /** Collegamento e scollegamento: riceve { kind: 'xbox' | 'ps4' | 'ps5' } oppure null. */
  onStatus(fn) {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  },
  status: () => info,
  isDown: (button) => pressed.has(button),
  axes: () => axes
};

/** Nome del tasto come e' stampato sul controller. */
export function buttonLabel(button, kind = info?.kind || 'xbox') {
  const ps = kind === 'ps4' || kind === 'ps5';
  const labels = ps
    ? { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: kind === 'ps5' ? 'Create' : 'Share', MENU: 'Options', L3: 'L3', R3: 'R3', HOME: 'PS' }
    : { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'View', MENU: 'Menu', L3: 'LS', R3: 'RS', HOME: 'Xbox' };
  const dirs = { UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' };
  return labels[button] || dirs[button] || button;
}

export function controllerName(kind) {
  return { xbox: 'Xbox', ps4: 'PS4', ps5: 'PS5' }[kind] || 'Controller';
}
