import { useState } from 'react';
import { Link } from 'react-router-dom';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import RarityPreview from '../components/a11y/RarityPreview.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useAccessibility } from '../hooks/useAccessibility.js';
import { resetAccessibility, setAccessibility } from '../services/accessibility.js';
import '../styles/pages/social-phantom.css';
import '../styles/pages/accessibility.css';

const CVD_OPTIONS = [
  { value: '', label: 'Nessuno', hint: 'Colori normali.' },
  { value: 'rg', label: 'Rosso-verde', hint: 'Protanopia e deuteranopia.' },
  { value: 'by', label: 'Blu-giallo', hint: 'Tritanopia.' },
  { value: 'mono', label: 'Scala di grigi', hint: 'Acromatopsia.' }
];

const SAFE_CHANGES = [
  'Niente lampi all’apertura dei pacchetti e niente tendina tra le pagine.',
  'I bagliori delle carte leggendarie e olografiche restano fermi e più tenui.',
  'Nell’hotel niente fulmini, luci delle feste che lampeggiano né luci del casinò a scatti.',
  'Le animazioni di movimento si riducono al minimo.'
];

/** Interruttore vero (checkbox con ruolo switch): tutta la riga si tocca, Spazio lo cambia. */
function Switch({ id, checked, onChange, label, description }) {
  return (
    <label className="a11y-switch" htmlFor={id}>
      <span className="a11y-switch-text">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="a11y-switch-track" aria-hidden="true"><span className="a11y-switch-thumb" /></span>
    </label>
  );
}

/**
 * Impostazioni di accessibilita' di questo dispositivo: modalita' sicura per l'epilessia,
 * daltonismo e alto contrasto. Aperta anche senza account (vedi PublicLayout in App.jsx).
 */
export default function AccessibilityPage() {
  const { safe, cvd, contrast } = useAccessibility();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState('');

  const change = (patch, text) => {
    setAccessibility(patch);
    setStatus(text);
  };

  return (
    <section className="a11y-page sp-page">
      <header className="sp-head">
        <PhantomTitle as="h2" text="Accessibilità" />
        <p className="sp-sub">Le scelte valgono su questo dispositivo, anche prima dell&apos;accesso, e restano salvate.</p>
        {!isAuthenticated && (
          <Link to="/login" className="btn btn-secondary a11y-back"><i className="ph ph-arrow-left" aria-hidden="true" /> Torna all&apos;accesso</Link>
        )}
      </header>

      <div className="glass-panel a11y-panel">
        <h3 className="panel-title"><i className="ph-fill ph-lightning-slash" aria-hidden="true" /> Modalità sicura per l&apos;epilessia</h3>
        <Switch
          id="a11y-safe"
          checked={safe}
          onChange={(on) => change({ safe: on }, on ? 'Modalità sicura attiva.' : 'Modalità sicura spenta.')}
          label="Modalità sicura"
          description="Per chi soffre di epilessia o di fotosensibilità."
        />
        <ul className="a11y-list">
          {SAFE_CHANGES.map((text) => <li key={text}>{text}</li>)}
        </ul>
        <p className="a11y-warning">
          <i className="ph-fill ph-warning" aria-hidden="true" />
          <span>
            Alcune parti di VinylDex (apertura dei pacchetti, feste e temporali nell&apos;hotel, minigiochi musicali) hanno
            lampi di luce e colori che cambiano veloci. Se tu o qualcuno in famiglia soffre di epilessia o di
            fotosensibilità, attiva la modalità sicura.
          </span>
        </p>
      </div>

      <div className="glass-panel a11y-panel">
        <h3 className="panel-title"><i className="ph-fill ph-eye" aria-hidden="true" /> Daltonismo</h3>
        <fieldset className="a11y-fieldset">
          <legend>Colori delle rarità e degli avvisi</legend>
          <div className="a11y-radios">
            {CVD_OPTIONS.map((opt) => (
              <label key={opt.value || 'none'} className={`a11y-radio${cvd === opt.value ? ' is-checked' : ''}`}>
                <input
                  type="radio"
                  name="a11y-cvd"
                  value={opt.value}
                  checked={cvd === opt.value}
                  onChange={() => change({ cvd: opt.value }, `Daltonismo: ${opt.label}.`)}
                />
                <span className="a11y-radio-text"><strong>{opt.label}</strong><span>{opt.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="a11y-preview">
          <h4>Anteprima delle rarità</h4>
          <RarityPreview />
        </div>
      </div>

      <div className="glass-panel a11y-panel">
        <h3 className="panel-title"><i className="ph-fill ph-circle-half" aria-hidden="true" /> Contrasto</h3>
        <Switch
          id="a11y-contrast"
          checked={contrast}
          onChange={(on) => change({ contrast: on }, on ? 'Alto contrasto attivo.' : 'Alto contrasto spento.')}
          label="Alto contrasto"
          description="Testi più chiari, bordi netti, niente retino dietro le scritte."
        />
      </div>

      <div className="a11y-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => { resetAccessibility(); setStatus('Impostazioni ripristinate.'); }}
        >
          <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" /> Ripristina
        </button>
        <p className="a11y-status" role="status" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}
