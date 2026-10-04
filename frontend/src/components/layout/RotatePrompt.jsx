import { useEffect, useState } from 'react';
import { canLockOnWeb, isIOS, isNativeApp, isTouchDevice, requestHotelLandscape } from '../../services/orientation.js';

/**
 * Nell'hotel, su un telefono tenuto in verticale (nel browser, dove lo schermo non si blocca da
 * solo): invito a girarlo. Su Android un tocco mette lo schermo intero e lo gira; su iPhone si
 * gira a mano. Chi preferisce puo' restare in verticale (per questa visita).
 */
function usePortrait() {
  const [portrait, setPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches);
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const onChange = () => setPortrait(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return portrait;
}

export default function RotatePrompt() {
  const portrait = usePortrait();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('vinyldex_hotel_portrait') === '1';
    } catch {
      return false;
    }
  });
  if (isNativeApp || !isTouchDevice() || !portrait || dismissed) return null;

  const stay = () => {
    try {
      sessionStorage.setItem('vinyldex_hotel_portrait', '1');
    } catch {
      // Vale finche' resta aperta la pagina.
    }
    setDismissed(true);
  };

  return (
    <div className="rotate-prompt" role="dialog" aria-modal="true" aria-labelledby="rotate-prompt-title">
      <div className="rotate-prompt-card">
        <div className="rotate-prompt-phone" aria-hidden="true"><i className="ph-fill ph-device-mobile" /></div>
        <h2 id="rotate-prompt-title">Gira il telefono</h2>
        <p>L&apos;hotel si gioca in orizzontale: vedi tutta la stanza, la chat e gli strumenti senza scorrere.</p>
        {canLockOnWeb() ? (
          <button type="button" className="btn btn-primary" onClick={requestHotelLandscape}>
            <i className="ph-fill ph-device-rotate" /> Gira lo schermo
          </button>
        ) : (
          <p className="rotate-prompt-hint">
            {isIOS() ? 'Togli il blocco della rotazione dal Centro di Controllo, se è attivo, e gira il telefono.' : 'Gira il telefono in orizzontale.'}
          </p>
        )}
        <button type="button" className="rotate-prompt-stay" onClick={stay}>Resta in verticale</button>
      </div>
    </div>
  );
}
