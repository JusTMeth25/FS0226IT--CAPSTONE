/**
 * Navigazione "a croce" fra gli elementi della pagina, come nei menu delle console: dal
 * pulsante attivo si passa a quello piu' vicino nella direzione scelta.
 *
 * Si resta dentro il livello piu' in alto (un pannello dell'hotel, una finestra, il menu "Altro"):
 * finche' e' aperto il resto della pagina non si raggiunge, e B lo chiude.
 */

const FOCUSABLE = [
  'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary', '[tabindex]',
  '[role=button]', '[role=tab]', '[role=link]', '[role=option]', '[role=menuitem]', '[role=checkbox]', '[role=switch]'
].join(',');

/** Livelli che coprono la pagina: finestre, pannelli, fogli, sovrapposizioni. */
const LAYERS = [
  '[aria-modal=true]', '[role=dialog]', '[role=alertdialog]', '.hotel-panel', '.more-sheet', '.pack-overlay',
  '.pack-modal', '.hotel-travel-overlay', '.hotel-pack-overlay', '.rotate-prompt', '.casino-panel'
].join(',');

const TEXT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', 'number', '']);

export function isTextField(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
  if (el.tagName === 'INPUT') return TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase()) && !el.readOnly && !el.disabled;
  return el.isContentEditable;
}

function shown(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
}

function usable(el) {
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
  if (el.getAttribute('tabindex') === '-1' && !el.matches('[role], canvas')) return false;
  if (el.closest('[inert], [aria-hidden=true], .pad-layer')) return false;
  if (el.tagName === 'INPUT' && el.type === 'radio' && !el.checked && el.name) {
    // Dei radio con lo stesso nome se ne raggiunge uno solo (quello scelto o il primo).
    const group = document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`);
    if ([...group].some((r) => r.checked) || group[0] !== el) return false;
  }
  return shown(el);
}

function zIndexOf(el) {
  let z = 0;
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    const v = parseInt(s.zIndex, 10);
    if (!Number.isNaN(v) && s.position !== 'static') z = Math.max(z, v);
  }
  return z;
}

/** Livello attivo: il piu' alto fra quelli visibili, a parita' l'ultimo aperto (dopo nel DOM). */
export function currentScope() {
  const layers = [...document.querySelectorAll(LAYERS)]
    .filter((el) => shown(el) && !el.closest('.pad-layer') && !el.parentElement?.closest(LAYERS) && candidates(el).length > 0);
  if (!layers.length) return document.body;
  let best = layers[0];
  let bestZ = zIndexOf(best);
  for (const el of layers.slice(1)) {
    const z = zIndexOf(el);
    if (z >= bestZ) {
      best = el;
      bestZ = z;
    }
  }
  return best;
}

export function candidates(scope) {
  return [...scope.querySelectorAll(FOCUSABLE)].filter(usable);
}

function center(r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Il prossimo elemento nella direzione: deve stare davvero da quella parte; vince il piu' vicino,
 * pesando di piu' lo spostamento di lato (cosi' "destra" resta sulla stessa riga se puo').
 */
export function pickInDirection(from, list, dir) {
  const a = from.getBoundingClientRect();
  const ca = center(a);
  const fromRegion = regionOf(from);
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === from || el.contains(from) || from.contains(el)) continue;
    const b = el.getBoundingClientRect();
    const cb = center(b);
    let main;
    let side;
    if (dir === 'RIGHT') {
      if (cb.x <= ca.x + 1 || b.right <= a.right - 1) continue;
      main = Math.max(0, b.left - a.right);
      side = overlap(a.top, a.bottom, b.top, b.bottom) ? 0 : Math.abs(cb.y - ca.y);
    } else if (dir === 'LEFT') {
      if (cb.x >= ca.x - 1 || b.left >= a.left + 1) continue;
      main = Math.max(0, a.left - b.right);
      side = overlap(a.top, a.bottom, b.top, b.bottom) ? 0 : Math.abs(cb.y - ca.y);
    } else if (dir === 'DOWN') {
      if (cb.y <= ca.y + 1 || b.bottom <= a.bottom - 1) continue;
      main = Math.max(0, b.top - a.bottom);
      side = overlap(a.left, a.right, b.left, b.right) ? 0 : Math.abs(cb.x - ca.x);
    } else {
      if (cb.y >= ca.y - 1 || b.top >= a.top + 1) continue;
      main = Math.max(0, a.top - b.bottom);
      side = overlap(a.left, a.right, b.left, b.right) ? 0 : Math.abs(cb.x - ca.x);
    }
    // Si resta nella stessa zona (menu laterale, barra in alto, contenuto) finche' c'e' qualcosa:
    // dal contenuto non si "scivola" nel menu solo perche' e' piu' vicino in verticale.
    const crossing = regionOf(el) !== fromRegion ? 1500 : 0;
    // Fuori zona solo "dritti": dal contenuto in giu' non si finisce nel menu di lato.
    if (crossing && side > 0) continue;
    const score = main + side * 2.5 + Math.hypot(cb.x - ca.x, cb.y - ca.y) * 0.05 + crossing;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

const REGIONS = 'aside, nav, header, main, footer, [role=dialog], .hotel-panel, .hotel-toolbar, .sidebar, .bottom-nav, .topbar';

function regionOf(el) {
  return el.closest(REGIONS);
}

function overlap(a1, a2, b1, b2) {
  return Math.min(a2, b2) - Math.max(a1, b1) > 4;
}

/** Elemento da cui partire quando nel livello non c'e' ancora niente di selezionato. */
export function firstIn(scope) {
  const list = candidates(scope);
  if (!list.length) return null;
  const preferred = scope.querySelector('[data-pad-initial]');
  if (preferred && usable(preferred)) return preferred;
  const inView = list.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  });
  const pool = inView.length ? inView : list;
  const active = pool.find((el) => el.matches('.active, [aria-selected=true], [aria-current=page]'));
  if (active && scope !== document.body) return active;
  return pool.reduce((best, el) => {
    const r = el.getBoundingClientRect();
    const b = best.getBoundingClientRect();
    return r.top + r.left * 0.3 < b.top + b.left * 0.3 ? el : best;
  }, pool[0]);
}

export function focusElement(el) {
  if (!el) return;
  if (!el.matches('a[href], button, input, select, textarea, summary, [tabindex]')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

/** Contenitore che scorre attorno a un elemento (o la pagina). */
export function scrollerOf(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 2) return n;
    if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 2 && n.scrollHeight <= n.clientHeight + 2) return n;
  }
  return document.scrollingElement || document.documentElement;
}

/** Il pulsante che chiude il livello, se c'e'. */
export function closeButtonOf(scope) {
  if (!scope || scope === document.body) return null;
  const sel = '.hotel-panel-close, [aria-label="Chiudi"], [aria-label^="Chiudi"], [aria-label="Close"], .modal-close, .close-btn';
  return [...scope.querySelectorAll(sel)].find(usable) || null;
}

/** Gruppo di schede del livello (casino, accesso, sport...): quello che contiene una scheda attiva. */
export function tabsOf(scope, near) {
  const groups = [...scope.querySelectorAll('[role=tablist], nav, .casino-tabs, .auth-tabs, [class*="-tabs"]')]
    .filter((g) => shown(g) && !g.matches('.bottom-nav, .sidebar nav') && !g.closest('.sidebar, .bottom-nav'));
  const withActive = groups
    .map((g) => {
      const tabs = [...g.querySelectorAll('button, a[href], [role=tab]')].filter(usable);
      const index = tabs.findIndex((t) => t.matches('.active, .btn-tab-active, [aria-selected=true], [aria-pressed=true], [aria-current=page]'));
      return { g, tabs, index };
    })
    .filter((x) => x.tabs.length >= 2 && x.index >= 0);
  if (!withActive.length) return null;
  // Se il focus sta dentro un gruppo, quello; altrimenti il primo dall'alto.
  return withActive.find((x) => near && x.g.contains(near)) || withActive[0];
}
