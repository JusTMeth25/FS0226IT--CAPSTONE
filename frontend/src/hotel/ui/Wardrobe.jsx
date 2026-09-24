import { useState } from 'react';
import { authApi } from '../../services/authApi.js';
import {
  HAIR_COLORS, HAIR_STYLES, LOOK_PARTS, PANTS, SHIRTS, SHIRT_NAMES, SKINS, formatLook, parseLook
} from '../sprites/avatar.js';
import AvatarPreview from './AvatarPreview.jsx';

/** Nome o campione di colore mostrato accanto alle frecce di ogni parte. */
const SWATCHES = { s: SKINS, hc: HAIR_COLORS, sh: SHIRTS, p: PANTS };
const NAMES = { h: HAIR_STYLES, sh: SHIRT_NAMES };

/**
 * Guardaroba: si sceglie l'aspetto parte per parte e si vede subito il risultato, di fronte
 * e di spalle. Salvando, il server lo registra e lo mostra a tutti i presenti nella stanza.
 */
export default function Wardrobe({ look, onClose, onSaved }) {
  const [parts, setParts] = useState(() => parseLook(look));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const draft = formatLook(parts);

  const cycle = (key, count, delta) => {
    setParts((p) => ({ ...p, [key]: (p[key] + delta + count) % count }));
  };

  const randomize = () => {
    setParts(Object.fromEntries(LOOK_PARTS.map(({ key, count }) => [key, Math.floor(Math.random() * count)])));
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
          <AvatarPreview look={draft} scale={4} walking />
          <AvatarPreview look={draft} scale={4} back flip />
        </div>

        <div className="hotel-wardrobe-parts">
          {LOOK_PARTS.map(({ key, label, count }) => (
            <div className="hotel-wardrobe-row" key={key}>
              <span className="hotel-wardrobe-label">{label}</span>
              <button type="button" className="hotel-arrow" onClick={() => cycle(key, count, -1)} aria-label={`${label} precedente`}>
                <i className="ph-bold ph-caret-left" />
              </button>
              <span className="hotel-wardrobe-value">
                {SWATCHES[key] && <span className="hotel-swatch" style={{ background: SWATCHES[key][parts[key]] }} />}
                {NAMES[key] ? NAMES[key][parts[key]] : `${parts[key] + 1}/${count}`}
              </span>
              <button type="button" className="hotel-arrow" onClick={() => cycle(key, count, 1)} aria-label={`${label} successivo`}>
                <i className="ph-bold ph-caret-right" />
              </button>
            </div>
          ))}
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
