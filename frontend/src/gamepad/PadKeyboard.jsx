import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonLabel, gamepad } from './gamepad.js';

/**
 * Tastiera a schermo per scrivere col controller (chat, ricerca, accesso): la croce sceglie il
 * tasto, A lo scrive. Scorciatoie: X cancella, Y spazio, LB maiuscole, RB simboli,
 * LT/RT spostano il cursore, Menu conferma (invia), B chiude.
 */

const LAYOUTS = {
  lower: ['1234567890', 'qwertyuiop', "asdfghjkl'", 'zxcvbnm,.?'],
  upper: ['1234567890', 'QWERTYUIOP', "ASDFGHJKL'", 'ZXCVBNM,.?'],
  symbols: ['!@#€%&*()=', "-_+/\\:;\"'!", 'àèéìòù<>[]', '{}|~^$£°§…']
};
const ACTIONS = [
  { id: 'shift', label: '⇧', wide: 1 },
  { id: 'symbols', label: '?123', wide: 1 },
  { id: 'at', label: '@', wide: 1 },
  { id: 'space', label: 'spazio', wide: 3 },
  { id: 'back', label: '⌫', wide: 1 },
  { id: 'enter', label: 'OK', wide: 2 }
];

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function caretOf(el) {
  try {
    if (typeof el.selectionStart === 'number') return [el.selectionStart, el.selectionEnd];
  } catch {
    // email e number non hanno il cursore: si scrive in fondo.
  }
  return [el.value.length, el.value.length];
}

function setCaret(el, pos) {
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    // Vedi caretOf.
  }
}

export default function PadKeyboard({ target, onClose }) {
  const [layer, setLayer] = useState('lower');
  const [pos, setPos] = useState({ row: 1, col: 0 });
  const [, refresh] = useState(0);
  const posRef = useRef(pos);
  const pressRef = useRef(() => {});

  const rows = useMemo(() => [
    ...LAYOUTS[layer].map((r) => [...r].map((ch) => ({ id: 'char', label: ch, value: ch, wide: 1 }))),
    ACTIONS
  ], [layer]);
  const rowsRef = useRef(rows);
  useEffect(() => {
    posRef.current = pos;
    rowsRef.current = rows;
  });

  // Sul telefono la tastiera di sistema resterebbe aperta sopra la nostra: la si spegne finche' si scrive col controller.
  useEffect(() => {
    const before = target.getAttribute('inputmode');
    target.setAttribute('inputmode', 'none');
    target.focus({ preventScroll: true });
    return () => {
      if (before === null) target.removeAttribute('inputmode');
      else target.setAttribute('inputmode', before);
    };
  }, [target]);

  useEffect(() => {
    const type = (text) => {
      const [a, b] = caretOf(target);
      const max = target.maxLength > 0 ? target.maxLength : Infinity;
      const next = (target.value.slice(0, a) + text + target.value.slice(b)).slice(0, max);
      setNativeValue(target, next);
      setCaret(target, Math.min(next.length, a + text.length));
      refresh((n) => n + 1);
    };
    const erase = () => {
      const [a, b] = caretOf(target);
      if (a === b && a === 0) return;
      const from = a === b ? a - 1 : a;
      setNativeValue(target, target.value.slice(0, from) + target.value.slice(b));
      setCaret(target, from);
      refresh((n) => n + 1);
    };
    const moveCaret = (delta) => {
      const [a] = caretOf(target);
      setCaret(target, Math.max(0, Math.min(target.value.length, a + delta)));
      refresh((n) => n + 1);
    };
    const press = (key) => {
      if (key.id === 'char') {
        type(key.value);
        if (layer === 'upper') setLayer('lower');
      } else if (key.id === 'shift') setLayer((l) => (l === 'upper' ? 'lower' : 'upper'));
      else if (key.id === 'symbols') setLayer((l) => (l === 'symbols' ? 'lower' : 'symbols'));
      else if (key.id === 'at') type('@');
      else if (key.id === 'space') type(' ');
      else if (key.id === 'back') erase();
      else if (key.id === 'enter') onClose(true);
    };
    pressRef.current = press;
    const move = (dir) => {
      const all = rowsRef.current;
      const { row, col } = posRef.current;
      if (dir === 'LEFT' || dir === 'RIGHT') {
        const len = all[row].length;
        setPos({ row, col: (col + (dir === 'LEFT' ? -1 : 1) + len) % len });
        return;
      }
      const nextRow = (row + (dir === 'UP' ? -1 : 1) + all.length) % all.length;
      // Stessa posizione in orizzontale, anche fra righe di lunghezza diversa.
      const width = (r) => all[r].reduce((s, k) => s + k.wide, 0);
      let x = all[row].slice(0, col).reduce((s, k) => s + k.wide, 0) + all[row][col].wide / 2;
      x = (x / width(row)) * width(nextRow);
      let acc = 0;
      let nextCol = 0;
      for (let i = 0; i < all[nextRow].length; i += 1) {
        acc += all[nextRow][i].wide;
        if (acc >= x) {
          nextCol = i;
          break;
        }
        nextCol = i;
      }
      setPos({ row: nextRow, col: nextCol });
    };
    return gamepad.subscribe((event) => {
      if (event.type === 'axes') return false;
      if (event.type === 'up') return true;
      const b = event.button;
      if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(b)) move(b);
      else if (event.type === 'repeat') return true;
      else if (b === 'A') press(rowsRef.current[posRef.current.row][posRef.current.col]);
      else if (b === 'X') erase();
      else if (b === 'Y') type(' ');
      else if (b === 'LB') setLayer((l) => (l === 'upper' ? 'lower' : 'upper'));
      else if (b === 'RB') setLayer((l) => (l === 'symbols' ? 'lower' : 'symbols'));
      else if (b === 'LT') moveCaret(-1);
      else if (b === 'RT') moveCaret(1);
      else if (b === 'MENU') onClose(true);
      else if (b === 'B') onClose(false);
      return true;
    }, 100);
  }, [target, onClose, layer]);

  const label = target.getAttribute('aria-label') || target.placeholder || target.labels?.[0]?.textContent || 'Scrivi';
  const secret = target.type === 'password';
  const [caret] = caretOf(target);
  const shownText = secret ? '•'.repeat(target.value.length) : target.value;

  return (
    <div className="pad-layer pad-keyboard" role="dialog" aria-label="Tastiera del controller">
      <div className="pad-kb-preview">
        <small>{label}</small>
        <div className="pad-kb-text">
          {shownText.slice(0, caret)}<i className="pad-kb-caret" />{shownText.slice(caret)}
        </div>
      </div>
      <div className="pad-kb-keys">
        {rows.map((row, r) => (
          <div className="pad-kb-row" key={r}>
            {row.map((key, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                tabIndex={-1}
                className={`pad-kb-key${pos.row === r && pos.col === c ? ' on' : ''}${key.id !== 'char' ? ' action' : ''}${key.id === 'shift' && layer === 'upper' ? ' lit' : ''}`}
                style={{ flexGrow: key.wide }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPos({ row: r, col: c });
                  pressRef.current(key);
                }}
              >
                {key.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="pad-kb-help">
        <b>{buttonLabel('A')}</b> scrivi · <b>{buttonLabel('X')}</b> cancella · <b>{buttonLabel('Y')}</b> spazio · <b>{buttonLabel('LB')}</b> maiuscole ·{' '}
        <b>{buttonLabel('RB')}</b> simboli · <b>{buttonLabel('MENU')}</b> invia · <b>{buttonLabel('B')}</b> chiudi
      </p>
    </div>
  );
}
