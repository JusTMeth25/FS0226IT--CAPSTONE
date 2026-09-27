import PackOpeningFlow from '../../components/pack/PackOpeningFlow.jsx';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';

/**
 * Apertura di un pacchetto della borsa, sopra la stanza: e' la stessa della pagina Pacchetti
 * (strappo, carte una a una, riepilogo, ispezione in 3D), cosi' non si esce dall'hotel. Sta
 * dentro la pagina dell'hotel e non su document.body: a schermo intero resta visibile.
 */
export default function HotelPackOpening({ opening, left, onAgain, onClose, onSummary }) {
  // Senza la barra di scorrimento della pagina il riquadro occupa tutto lo schermo ed e' centrato davvero.
  useBodyScrollLock(true);
  const actions = [
    ...(left > 0 ? [{ label: `Apri un altro (${left})`, icon: 'ph-gift', onClick: onAgain, primary: true }] : []),
    { label: 'Torna all\'hotel', icon: 'ph-buildings', onClick: onClose, primary: left === 0 }
  ];
  return (
    <div className="hotel-pack-overlay" role="dialog" aria-label="Apertura pacchetto">
      <button type="button" className="hotel-panel-close hotel-pack-overlay-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      <div className="pack-opening-page hotel-pack-opening">
        <h2 className="section-title text-gradient">Apertura Pacchetto</h2>
        <PackOpeningFlow key={opening.id} packId={opening.packId} cards={opening.cards} actions={actions} onSummary={onSummary} />
      </div>
    </div>
  );
}
