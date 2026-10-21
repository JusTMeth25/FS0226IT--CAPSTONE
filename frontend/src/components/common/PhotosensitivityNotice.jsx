import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccessibility } from '../../hooks/useAccessibility.js';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';
import { setAccessibility } from '../../services/accessibility.js';

/**
 * Avvertenza sulla fotosensibilita' al primo avvio su questo dispositivo: prima di vedere un
 * qualunque lampo si puo' accendere la modalita' sicura. Una volta scelto (o chiuso con Esc,
 * che vale "Continua") non torna piu'. Sulla pagina dell'accessibilita' non serve: li' lo
 * stesso testo sta accanto all'interruttore.
 */
export default function PhotosensitivityNotice() {
  const { warned } = useAccessibility();
  const { pathname } = useLocation();
  const open = !warned && pathname !== '/accessibility';
  const cardRef = useRef(null);
  const firstRef = useRef(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAccessibility({ warned: true });
        return;
      }
      // Il focus resta dentro la finestra finche' non si sceglie.
      if (e.key !== 'Tab' || !cardRef.current) return;
      const items = cardRef.current.querySelectorAll('button, a[href]');
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const choose = (safe) => setAccessibility(safe ? { safe: true, warned: true } : { warned: true });

  return (
    <div className="a11y-notice" role="dialog" aria-modal="true" aria-labelledby="a11y-notice-title" aria-describedby="a11y-notice-text">
      <div className="a11y-notice-card" ref={cardRef}>
        <h2 id="a11y-notice-title"><i className="ph-fill ph-warning" aria-hidden="true" /> Avviso sulla fotosensibilità</h2>
        <p id="a11y-notice-text">
          Alcune parti di VinylDex (apertura dei pacchetti, feste e temporali nell&apos;hotel, minigiochi musicali) hanno
          lampi di luce e colori che cambiano veloci. Se tu o qualcuno in famiglia soffre di epilessia o di
          fotosensibilità, attiva la modalità sicura.
        </p>
        <div className="a11y-notice-actions">
          <button type="button" className="btn btn-primary" ref={firstRef} onClick={() => choose(true)}>
            <i className="ph-fill ph-shield-check" aria-hidden="true" /> Attiva la modalità sicura
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => choose(false)}>Continua</button>
        </div>
        {/* Andando alle impostazioni l'avviso si considera visto: la' si sceglie tutto. */}
        <Link to="/accessibility" className="a11y-notice-link" onClick={() => choose(false)}>
          <i className="ph ph-wheelchair" aria-hidden="true" /> Altre impostazioni di accessibilità
        </Link>
      </div>
    </div>
  );
}
