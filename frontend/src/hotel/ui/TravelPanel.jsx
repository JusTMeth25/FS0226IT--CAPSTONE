import { useEffect, useState } from 'react';
import { roomApi } from '../../services/roomApi.js';

/**
 * Fermata dell'autobus e posteggio dei taxi del quartiere: si sceglie una stanza pubblica e ci si
 * arriva con un breve viaggio (TravelOverlay), invece di aprire il navigatore.
 */
export default function TravelPanel({ mode, currentRoomId, onGo, onClose }) {
  const [rooms, setRooms] = useState(null);
  useEffect(() => {
    let cancelled = false;
    roomApi.navigator().then((res) => { if (!cancelled) setRooms(res.publicRooms || []); }).catch(() => { if (!cancelled) setRooms([]); });
    return () => { cancelled = true; };
  }, []);
  const taxi = mode === 'taxi';
  return (
    <div className="hotel-panel hotel-travel" role="dialog" aria-label={taxi ? 'Taxi' : 'Autobus'}>
      <header className="hotel-panel-header">
        <h3><i className={`ph-fill ${taxi ? 'ph-taxi' : 'ph-bus'}`} /> {taxi ? 'Taxi: dove la porto?' : 'Autobus: fermate'}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <p className="hotel-panel-hint">{taxi ? 'Il taxi ti porta dritto dove vuoi.' : "L'autobus passa per tutte le stanze pubbliche dell'hotel."}</p>
      <ul className="hotel-travel-list">
        {rooms === null && <li className="hotel-panel-hint">Controllo gli orari…</li>}
        {(rooms || []).filter((r) => r.id !== currentRoomId).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onGo(r)}>
              <strong>{r.name}</strong>
              <small><i className="ph-fill ph-user" /> {r.users}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Viaggio: la strada che scorre e l'autobus (o il taxi) che attraversa lo schermo. */
export function TravelOverlay({ mode, to }) {
  const taxi = mode === 'taxi';
  return (
    <div className="hotel-travel-overlay" role="status" aria-live="polite">
      <div className="travel-sky" />
      <div className="travel-city" />
      <div className="travel-road"><span /></div>
      <div className={`travel-vehicle ${taxi ? 'taxi' : 'bus'}`}>
        <div className="travel-body">
          {taxi ? <b className="travel-taxi-sign">TAXI</b> : <b className="travel-bus-line">VinylDex</b>}
          <i />
          <i />
          {!taxi && <i />}
        </div>
        <em />
        <em />
      </div>
      <p>{taxi ? 'In taxi verso' : 'In autobus verso'} <strong>{to}</strong>…</p>
    </div>
  );
}
