import { useEffect, useState } from 'react';
import { authApi } from '../../services/authApi.js';
import { hotelApi } from '../../services/hotelApi.js';
import {
  ACCESSORIES, BARE_CHEST, BODIES, HAIR_COLORS, HAIR_COLOR_NAMES, HAIR_STYLES, LOOK_PARTS, LUXURY_PARTS, PANTS, PANTS_NAMES, SHIRTS,
  SHIRT_NAMES, SHIRT_TYPES, SHOES, SHOE_NAMES, SKINS, fixLook, formatLook, parseLook
} from '../sprites/avatar.js';
import AvatarPreview from './AvatarPreview.jsx';

/** Nome o campione di colore mostrato accanto alle frecce di ogni parte. */
const SWATCHES = { s: SKINS, hc: HAIR_COLORS, sh: SHIRTS, p: PANTS, f: SHOES };
const NAMES = { b: BODIES, h: HAIR_STYLES, hc: HAIR_COLOR_NAMES, sh: SHIRT_NAMES, t: SHIRT_TYPES, p: PANTS_NAMES, f: SHOE_NAMES, a: ACCESSORIES };

/**
 * Guardaroba: si sceglie l'aspetto parte per parte e si vede subito il risultato, di fronte
 * e di spalle. Salvando, il server lo registra e lo mostra a tutti i presenti nella stanza.
 */
/** Indici di HAIR_STYLES: Corto, A punta, Cresta, Rasato; e Lunghi. */
const SHORT_HAIR = [0, 1, 4, 9];
const LONG_HAIR = 2;

export default function Wardrobe({ look, onClose, onSaved }) {
  const [parts, setParts] = useState(() => parseLook(look));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const draft = formatLook(parts);
  // Pezzi dei negozi del quartiere: si scorrono solo quelli comprati (piu' "niente").
  const [owned, setOwned] = useState([]);
  useEffect(() => {
    let cancelled = false;
    hotelApi.wardrobe().then((res) => { if (!cancelled) setOwned(res.owned || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const luxuryChoices = (key) => [0, ...owned.filter((item) => item.startsWith(key) && /^\d+$/.test(item.slice(key.length)))
    .map((item) => Number(item.slice(key.length))).sort((a, b) => a - b)];
  const cycleLuxury = (key, delta) => {
    const choices = luxuryChoices(key);
    setParts((p) => {
      const at = Math.max(0, choices.indexOf(p[key]));
      return { ...p, [key]: choices[(at + delta + choices.length) % choices.length] };
    });
  };

  // Con la corporatura da donna il tipo di maglia salta il petto nudo.
  const countOf = (key, count, p) => (key === 't' && p.b === 1 ? BARE_CHEST : count);
  const cycle = (key, count, delta) => {
    setParts((p) => {
      const n = countOf(key, count, p);
      const next = { ...p, [key]: (p[key] + delta + n) % n };
      // Passando a donna con i capelli corti (corto, a punta, cresta, rasato) si parte dai lunghi:
      // il corpo cambia poco a quella scala, i capelli si notano. Poi si cambiano come si vuole.
      if (key === 'b' && next.b === 1 && SHORT_HAIR.includes(p.h)) next.h = LONG_HAIR;
      return fixLook(next);
    });
  };

  const randomize = () => {
    setParts((p) => fixLook({ ...p, ...Object.fromEntries(LOOK_PARTS.map(({ key, count }) => [key, Math.floor(Math.random() * count)])) }));
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await authApi.updateLook(draft);
      onSaved(draft);
    } catch {
      setError('Non sono riuscito a salvare. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hotel-panel hotel-wardrobe" role="dialog" aria-label="Guardaroba">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-t-shirt" /> Guardaroba</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>

      <div className="hotel-wardrobe-body">
        <div className="hotel-wardrobe-stage">
          <AvatarPreview look={draft} scale={2} walking />
          <AvatarPreview look={draft} scale={2} back flip />
        </div>

        <div className="hotel-wardrobe-parts">
          {LOOK_PARTS.map(({ key, label, count }) => (
            <div className="hotel-wardrobe-row" key={key}>
              <span className="hotel-wardrobe-label">{label}</span>
              <button type="button" className="hotel-arrow" onClick={() => cycle(key, count, -1)} aria-label={`${label} precedente`}>
                <i className="ph-fill ph-caret-left" />
              </button>
              <span className="hotel-wardrobe-value">
                {SWATCHES[key] && <span className="hotel-swatch" style={{ background: SWATCHES[key][parts[key]] }} />}
                {NAMES[key] ? NAMES[key][parts[key]] : `${parts[key] + 1}/${count}`}
              </span>
              <button type="button" className="hotel-arrow" onClick={() => cycle(key, count, 1)} aria-label={`${label} successivo`}>
                <i className="ph-fill ph-caret-right" />
              </button>
            </div>
          ))}
          {LUXURY_PARTS.map(({ key, label, names }) => luxuryChoices(key).length > 1 && (
            <div className="hotel-wardrobe-row lux-row" key={key}>
              <span className="hotel-wardrobe-label">{label}</span>
              <button type="button" className="hotel-arrow" onClick={() => cycleLuxury(key, -1)} aria-label={`${label} precedente`}>
                <i className="ph-fill ph-caret-left" />
              </button>
              <span className="hotel-wardrobe-value">{names[parts[key]]}</span>
              <button type="button" className="hotel-arrow" onClick={() => cycleLuxury(key, 1)} aria-label={`${label} successivo`}>
                <i className="ph-fill ph-caret-right" />
              </button>
            </div>
          ))}
          {!owned.length && <p className="hotel-panel-hint">Capi firmati, orologi e veicoli si comprano nei negozi del Quartiere.</p>}
          <button type="button" className="btn btn-secondary btn-small" onClick={randomize}>
            <i className="ph-fill ph-shuffle" /> A caso
          </button>
        </div>
      </div>

      {error && <p className="hotel-panel-error">{error}</p>}
      <footer className="hotel-panel-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || draft === look}>
          <i className="ph-fill ph-floppy-disk" /> {saving ? 'Salvataggio…' : 'Salva aspetto'}
        </button>
      </footer>
    </div>
  );
}
