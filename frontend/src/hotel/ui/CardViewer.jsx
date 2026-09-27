import { lazy } from 'react';
import { Link } from 'react-router-dom';
import ThreeGate from '../../components/three/ThreeGate.jsx';
import CardHero from '../../components/card/CardHero.jsx';

// Stessa carta 3D del dettaglio e del riepilogo pacchetti: three.js arriva solo se serve.
const Card3D = lazy(() => import('../../components/three/Card3D.jsx'));

/** Carta esposta in una vetrina, ispezionabile in 3D da chiunque sia nella stanza. */
export default function CardViewer({ card, onClose, onChange }) {
  return (
    <div className="pack-overlay hotel-card-viewer" onClick={onClose}>
      <div className="pack-inspect-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-secondary pack-inspect-close" onClick={onClose}>
          <i className="ph-fill ph-arrow-left" /> Torna nella stanza
        </button>
        <ThreeGate fallback={<CardHero card={card} />}>
          <Card3D card={card} />
        </ThreeGate>
        {onChange && (
          <button type="button" className="btn btn-gold hotel-card-viewer-link" onClick={onChange}>
            <i className="ph-fill ph-swap" /> Cambia la carta esposta
          </button>
        )}
        <Link className="btn btn-primary hotel-card-viewer-link" to={`/card/${card.id}`}>
          <i className="ph-fill ph-info" /> Scheda completa
        </Link>
      </div>
    </div>
  );
}
