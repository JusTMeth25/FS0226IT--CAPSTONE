import { useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';

/**
 * Foto della stanza appena scattata: si scarica o si mette nel profilo (le ultime dodici).
 */
export default function PhotoModal({ image, roomName, onClose }) {
  const [state, setState] = useState(null);
  const save = async () => {
    setState('saving');
    try {
      await hotelApi.savePhoto(image, roomName);
      setState('saved');
    } catch {
      setState('error');
    }
  };
  const file = `vinyldex-hotel-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jpg`;
  return (
    <div className="hotel-panel hotel-photo" role="dialog" aria-label="Foto dell'hotel">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-camera" /> Foto</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <figure className="hotel-photo-frame">
        <img src={image} alt={`Foto di ${roomName}`} />
        <figcaption>{roomName} · {new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</figcaption>
      </figure>
      <div className="club-actions">
        <a className="btn btn-secondary btn-small" href={image} download={file}><i className="ph-fill ph-download-simple" /> Scarica</a>
        <button type="button" className="btn btn-primary btn-small" onClick={save} disabled={state === 'saving' || state === 'saved'}>
          <i className="ph-fill ph-user-circle" /> {state === 'saved' ? 'Nel profilo!' : 'Metti nel profilo'}
        </button>
      </div>
      {state === 'error' && <p className="hotel-panel-error">Foto non salvata, riprova.</p>}
    </div>
  );
}
