import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { buttonLabel, controllerName, DIRECTIONS, gamepad } from './gamepad.js';
import {
  candidates, closeButtonOf, currentScope, firstIn, focusElement, isTextField, pickInDirection, scrollerOf, tabsOf
} from './spatialNav.js';
import PadKeyboard from './PadKeyboard.jsx';
import './gamepad.css';

/**
 * Tutta l'app col controller (Xbox One, PS4, PS5):
 * - croce o levetta sinistra: da un pulsante all'altro; A sceglie, B chiude o torna indietro;
 * - LB/RB: scheda precedente/successiva; LT/RT e levetta destra: scorrono la pagina;
 * - X: scrivi (chat, ricerca) con la tastiera a schermo; Menu: menu principale;
 * - View: puntatore libero per toccare qualunque punto (mobili e persone nell'hotel, le cose da
 *   trascinare); nella stanza la croce fa camminare l'avatar;
 * - Y: l'aiuto con i comandi.
 * I minigiochi si prendono i tasti che servono a loro (vedi usePadControls in Minigame).
 */

const CURSOR_SPEED = 900;

function sendKey(target, key, type = 'keydown', repeat = false) {
  (target || document.body).dispatchEvent(new KeyboardEvent(type, { key, code: key, repeat, bubbles: true, cancelable: true }));
}

const ARROW = { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };

/** Evento del puntatore finto, come quello del mouse. */
function pointer(type, el, x, y, buttons) {
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons, view: window };
  if (type.startsWith('pointer')) {
    el.dispatchEvent(new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  } else {
    el.dispatchEvent(new MouseEvent(type, init));
  }
}

export default function GamepadLayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(() => gamepad.status());
  const [toast, setToast] = useState(null);
  const [help, setHelp] = useState(false);
  const [keyboard, setKeyboard] = useState(null);
  const [cursorOn, setCursorOn] = useState(false);
  const cursorRef = useRef(null);
  const cursor = useRef({ x: 0, y: 0, down: null, hover: null });
  const lastB = useRef(0);
  const helpRef = useRef(false);
  useEffect(() => { helpRef.current = help; }, [help]);
  const pathRef = useRef(location.pathname);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

  // Scelta una pagina dal menu col controller, si passa al suo contenuto (non si resta nel menu).
  useEffect(() => {
    if (!document.documentElement.classList.contains('pad-mode')) return undefined;
    let tries = 0;
    let id = 0;
    // La pagina puo' arrivare dopo (caricamento a richiesta): si riprova per un paio di secondi.
    const attempt = () => {
      const active = document.activeElement;
      const inMenu = !active || active === document.body || active.closest('.sidebar, .bottom-nav, .more-sheet');
      if (!inMenu) return;
      const view = document.getElementById('app-view');
      const first = view && firstIn(view);
      if (first) focusElement(first);
      else if (tries++ < 10) id = setTimeout(attempt, 250);
    };
    id = setTimeout(attempt, 350);
    return () => clearTimeout(id);
  }, [location.pathname]);

  // Collegamento: avviso con il nome del controller.
  useEffect(() => gamepad.onStatus((next) => {
    setStatus(next);
    setToast(next ? `Controller ${controllerName(next.kind)} collegato · ${buttonLabel('Y', next.kind)} per i comandi` : 'Controller scollegato');
    if (!next) {
      setCursorOn(false);
      setKeyboard(null);
      document.documentElement.classList.remove('pad-mode');
    }
  }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Modalita' controller: anello di selezione ben visibile; il mouse o il dito la spengono.
  useEffect(() => {
    const off = (event) => {
      if (event.isTrusted && (event.type !== 'mousemove' || event.movementX || event.movementY)) {
        document.documentElement.classList.remove('pad-mode');
      }
    };
    window.addEventListener('mousemove', off, { passive: true });
    window.addEventListener('touchstart', off, { passive: true });
    return () => {
      window.removeEventListener('mousemove', off);
      window.removeEventListener('touchstart', off);
    };
  }, []);

  /** B: chiude quello che sta sopra, altrimenti torna alla pagina di prima. */
  const back = useCallback(() => {
    const scope = currentScope();
    const close = closeButtonOf(scope);
    if (close) {
      close.click();
      return true;
    }
    if (scope.matches?.('.more-sheet')) {
      scope.parentElement?.click();
      return true;
    }
    if (scope !== document.body) {
      sendKey(document.activeElement, 'Escape');
      return true;
    }
    const active = document.activeElement;
    if (active?.matches?.('canvas.hotel-canvas')) {
      // Dalla stanza si passa ai comandi sotto, senza uscire dall'hotel.
      const next = pickInDirection(active, candidates(document.body), 'DOWN') || pickInDirection(active, candidates(document.body), 'RIGHT');
      if (next) focusElement(next);
      return true;
    }
    if (pathRef.current !== '/home' && pathRef.current !== '/hotel' && window.history.length > 1) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate]);

  // Tasto "indietro" di Android (anche il B del controller arriva da li'): prima chiude i pannelli.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let remove = null;
    import('@capacitor/app').then(({ App }) => App.addListener('backButton', () => {
      if (performance.now() - lastB.current < 400) return;
      if (!back() && pathRef.current === '/home') App.exitApp();
    })).then((handle) => { remove = handle; }).catch(() => {});
    // Con un controller collegato Android manda anche croce e A come tasti: li gestisce gia' la Gamepad API.
    const block = (event) => {
      if (!gamepad.status() || !event.isTrusted || isTextField(event.target)) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key) && !event.ctrlKey) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', block, true);
    return () => {
      remove?.remove();
      window.removeEventListener('keydown', block, true);
    };
  }, [back]);

  // Puntatore libero: la levetta lo muove, A tocca (tenuto premuto trascina), la levetta destra scorre.
  useEffect(() => {
    if (!cursorOn) return undefined;
    const c = cursor.current;
    const active = document.activeElement;
    if (active && active !== document.body) {
      const r = active.getBoundingClientRect();
      c.x = r.left + r.width / 2;
      c.y = r.top + r.height / 2;
    } else {
      c.x = window.innerWidth / 2;
      c.y = window.innerHeight / 2;
    }
    let raf = 0;
    let last = performance.now();
    const place = () => {
      if (cursorRef.current) cursorRef.current.style.transform = `translate(${c.x}px, ${c.y}px)`;
    };
    const under = () => document.elementFromPoint(c.x, c.y);
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(50, t - last) / 1000;
      last = t;
      const { lx, ly, rx, ry } = gamepad.axes();
      const curve = (v) => {
        const a = Math.max(0, (Math.abs(v) - 0.15) / 0.85);
        return Math.sign(v) * a * a;
      };
      let dx = curve(lx) * CURSOR_SPEED * dt;
      let dy = curve(ly) * CURSOR_SPEED * dt;
      // Croce: passi piccoli e precisi.
      if (gamepad.isDown('LEFT') && Math.abs(lx) < 0.5) dx -= 160 * dt;
      if (gamepad.isDown('RIGHT') && Math.abs(lx) < 0.5) dx += 160 * dt;
      if (gamepad.isDown('UP') && Math.abs(ly) < 0.5) dy -= 160 * dt;
      if (gamepad.isDown('DOWN') && Math.abs(ly) < 0.5) dy += 160 * dt;
      if (dx || dy) {
        c.x = Math.max(0, Math.min(window.innerWidth - 1, c.x + dx));
        c.y = Math.max(0, Math.min(window.innerHeight - 1, c.y + dy));
        place();
        const el = c.down || under();
        if (el) {
          pointer('pointermove', el, c.x, c.y, c.down ? 1 : 0);
          pointer('mousemove', el, c.x, c.y, c.down ? 1 : 0);
        }
      }
      if (Math.abs(ry) > 0.2 || Math.abs(rx) > 0.2) {
        const el = under();
        if (el) scrollerOf(el).scrollBy({ left: curve(rx) * 900 * dt, top: curve(ry) * 900 * dt });
      }
    };
    place();
    raf = requestAnimationFrame(tick);
    const off = gamepad.subscribe((event) => {
      if (event.type === 'axes') return true;
      const b = event.button;
      if (DIRECTIONS.includes(b)) return true;
      if (b === 'A' && event.type === 'down') {
        const el = under();
        if (!el) return true;
        c.down = el;
        pointer('pointerdown', el, c.x, c.y, 1);
        pointer('mousedown', el, c.x, c.y, 1);
        return true;
      }
      if (b === 'A' && event.type === 'up') {
        const el = c.down;
        c.down = null;
        if (!el) return true;
        pointer('pointerup', el, c.x, c.y, 0);
        pointer('mouseup', el, c.x, c.y, 0);
        const now = under();
        if (now && (now === el || el.contains(now) || now.contains(el))) {
          pointer('click', now, c.x, c.y, 0);
          if (now.matches?.('input, textarea, select')) now.focus();
        }
        return true;
      }
      if (event.type !== 'down') return true;
      if (b === 'B' || b === 'VIEW') {
        setCursorOn(false);
        return true;
      }
      if (b === 'LT' || b === 'RT') {
        // Rotella: avvicina o allontana la stanza dell'hotel, scorre il resto.
        const el = under();
        el?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, deltaY: b === 'LT' ? 120 : -120 }));
        return true;
      }
      return b !== 'Y' && b !== 'MENU';
    }, 50);
    return () => {
      cancelAnimationFrame(raf);
      off();
      if (c.down) {
        pointer('pointerup', c.down, c.x, c.y, 0);
        c.down = null;
      }
    };
  }, [cursorOn]);

  const openKeyboard = useCallback((el) => {
    if (el) setKeyboard({ el });
  }, []);

  const closeKeyboard = useCallback((submit) => {
    setKeyboard((kb) => {
      const el = kb?.el;
      if (el && submit) {
        // Dopo il rendering: prima si chiude la tastiera, poi si invia.
        setTimeout(() => {
          if (el.form?.requestSubmit) el.form.requestSubmit();
          else sendKey(el, 'Enter');
        }, 0);
      }
      if (el) setTimeout(() => focusElement(el), 0);
      return null;
    });
  }, []);

  // Navigazione principale.
  useEffect(() => gamepad.subscribe((event) => {
    // Rilasciata una direzione sulla stanza: l'avatar finisce il passo e si ferma.
    if (event.type === 'up' && ARROW[event.button] && document.activeElement?.matches?.('canvas.hotel-canvas')) {
      sendKey(document.activeElement, ARROW[event.button], 'keyup');
      return true;
    }
    if (event.type === 'up' || event.type === 'axes') {
      if (event.type === 'axes') {
        const { rx, ry } = event.axes;
        if (Math.abs(ry) > 0.2 || Math.abs(rx) > 0.2) {
          const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : currentScope();
          scrollerOf(el).scrollBy({ left: rx * 22, top: ry * 22 });
        }
      }
      return false;
    }
    document.documentElement.classList.add('pad-mode');
    const b = event.button;
    if (b === 'B' && event.type === 'down') lastB.current = performance.now();
    if (helpRef.current && event.type === 'down' && (b === 'B' || b === 'Y' || b === 'A')) {
      setHelp(false);
      return true;
    }
    const scope = currentScope();
    let active = document.activeElement;
    const inScope = active && active !== document.body && scope.contains(active);

    if (DIRECTIONS.includes(b)) {
      // Nella stanza dell'hotel la croce fa camminare: tenendo premuto si continua (vedi HotelCanvas).
      if (inScope && active.matches('canvas.hotel-canvas')) {
        sendKey(active, ARROW[b], 'keydown', event.type === 'repeat');
        return true;
      }
      if (!inScope) {
        focusElement(firstIn(scope));
        return true;
      }
      // Cursori e menu a tendina: sinistra e destra cambiano il valore.
      if ((b === 'LEFT' || b === 'RIGHT') && active.matches('input[type=range]')) {
        if (b === 'LEFT') active.stepDown(); else active.stepUp();
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      if ((b === 'LEFT' || b === 'RIGHT') && active.tagName === 'SELECT' && active.options.length) {
        const n = active.options.length;
        active.selectedIndex = (active.selectedIndex + (b === 'LEFT' ? n - 1 : 1)) % n;
        active.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      const next = pickInDirection(active, candidates(scope), b);
      if (next) focusElement(next);
      else scrollerOf(active).scrollBy({ top: b === 'DOWN' ? 160 : b === 'UP' ? -160 : 0, left: b === 'RIGHT' ? 160 : b === 'LEFT' ? -160 : 0, behavior: 'smooth' });
      return true;
    }
    if (event.type !== 'down') return true;

    switch (b) {
      case 'A': {
        if (!inScope) {
          focusElement(firstIn(scope));
          return true;
        }
        if (isTextField(active)) openKeyboard(active);
        else if (active.matches('canvas.hotel-canvas')) setCursorOn(true);
        else if (active.tagName === 'SELECT') {
          const n = active.options.length;
          if (n) {
            active.selectedIndex = (active.selectedIndex + 1) % n;
            active.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else active.click();
        return true;
      }
      case 'B':
        back();
        return true;
      case 'X': {
        // Scrivi: il primo campo di testo visibile (chat dell'hotel, ricerca, accesso).
        const field = isTextField(active) ? active : candidates(scope).find(isTextField);
        if (field) openKeyboard(field);
        return true;
      }
      case 'Y':
        setHelp((h) => !h);
        return true;
      case 'LB':
      case 'RB': {
        const tabs = tabsOf(scope, active);
        if (tabs) {
          const next = tabs.tabs[(tabs.index + (b === 'LB' ? tabs.tabs.length - 1 : 1)) % tabs.tabs.length];
          next.click();
          focusElement(next);
        } else {
          // Senza schede: come le frecce della tastiera (pagine del raccoglitore).
          sendKey(active || document.body, b === 'LB' ? 'ArrowLeft' : 'ArrowRight');
        }
        return true;
      }
      case 'LT':
      case 'RT': {
        const el = inScope ? active : scope;
        const box = scrollerOf(el);
        const page = (box === document.scrollingElement ? window.innerHeight : box.clientHeight) * 0.8;
        box.scrollBy({ top: b === 'LT' ? -page : page, behavior: 'smooth' });
        return true;
      }
      case 'MENU': {
        const more = document.querySelector('.bottom-nav-more-btn');
        if (more && more.getBoundingClientRect().width > 0) {
          more.click();
          setTimeout(() => focusElement(firstIn(currentScope())), 120);
        } else {
          const link = document.querySelector('.sidebar a.active') || document.querySelector('.sidebar a[href]');
          focusElement(link);
        }
        return true;
      }
      case 'VIEW':
        setCursorOn((on) => !on);
        return true;
      case 'L3':
      case 'R3':
        return true;
      default:
        return false;
    }
  }, 0), [back, openKeyboard]);

  if (!status && !toast) return null;
  const k = status?.kind;
  const L = (b) => <b className="pad-glyph">{buttonLabel(b, k)}</b>;

  return (
    <>
      {toast && <div className="pad-layer pad-toast" role="status"><i className="ph-fill ph-game-controller" /> {toast}</div>}
      {cursorOn && <div ref={cursorRef} className="pad-layer pad-cursor" aria-hidden="true"><i className="ph-fill ph-cursor" /></div>}
      {keyboard && <PadKeyboard target={keyboard.el} onClose={closeKeyboard} />}
      {help && status && (
        <div className="pad-layer pad-help" role="dialog" aria-label="Comandi del controller">
          <h3><i className="ph-fill ph-game-controller" /> Comandi {controllerName(k)}</h3>
          <ul>
            <li><span>{L('UP')}{L('DOWN')}{L('LEFT')}{L('RIGHT')} o levetta</span> spostati fra i pulsanti</li>
            <li><span>{L('A')}</span> scegli · <span>{L('B')}</span> chiudi / indietro</li>
            <li><span>{L('LB')}{L('RB')}</span> scheda precedente / successiva</li>
            <li><span>{L('LT')}{L('RT')} o levetta destra</span> scorri la pagina</li>
            <li><span>{L('X')}</span> scrivi (chat, ricerca) con la tastiera a schermo</li>
            <li><span>{L('MENU')}</span> menu principale · <span>{L('VIEW')}</span> puntatore libero</li>
            <li><span>Hotel</span> sulla stanza la croce cammina, {L('A')} apre il puntatore per toccare mobili e persone, {L('B')} passa ai comandi</li>
            <li><span>Minigiochi</span> i tasti sono scritti sotto il gioco; {L('MENU')} esce</li>
          </ul>
          <p>{L('Y')} chiude questo aiuto</p>
        </div>
      )}
    </>
  );
}
