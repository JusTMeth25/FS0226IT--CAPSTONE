import { useEffect, useState } from 'react';
import { roomApi } from '../../services/roomApi.js';

const TABS = [
  { key: 'publicRooms', label: 'Pubbliche', icon: 'ph-buildings' },
  { key: 'userRooms', label: 'Dei giocatori', icon: 'ph-house-line' }
];

/**
 * Navigatore delle stanze, come su Habbo: stanze pubbliche e stanze dei giocatori, con quante
 * persone ci sono dentro adesso. Il conteggio si aggiorna ogni volta che si apre.
 */
export default function Navigator({ currentRoomId, onJoin, onMyRoom, onClose }) {
  const [tab, setTab] = useState('publicRooms');
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    roomApi.navigator()
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const rooms = data?.[tab] || [];

  return (
    <div className="hotel-panel hotel-navigator" role="dialog" aria-label="Navigatore">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-compass" /> Navigatore</h3>
        {onClose && (
          <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
        )}
      </header>

      {onMyRoom && (
        <button type="button" className="hotel-my-room" onClick={onMyRoom}>
          <i className="ph-fill ph-house-simple" /> Vai alla mia stanza
        </button>
      )}

      <div className="hotel-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`hotel-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <i className={`ph-fill ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      <ul className="hotel-room-list">
        {error && <li className="hotel-room-empty">Navigatore non disponibile. Riprova tra poco.</li>}
        {!error && !data && <li className="hotel-room-empty">Carico le stanze…</li>}
        {data && rooms.length === 0 && (
          <li className="hotel-room-empty">
            {tab === 'userRooms' ? 'Nessuna stanza dei giocatori, per ora.' : 'Nessuna stanza pubblica.'}
          </li>
        )}
        {rooms.map((room) => {
          const full = room.users >= room.maxUsers;
          const here = room.id === currentRoomId;
          return (
            <li key={room.id}>
              <button
                type="button"
                className={`hotel-room${here ? ' current' : ''}`}
                onClick={() => onJoin(room.id)}
                disabled={full && !here}
              >
                <span className={`hotel-room-occupancy${room.users > 0 ? ' busy' : ''}`}>
                  <i className="ph-fill ph-user" /> {room.users}
                </span>
                <span className="hotel-room-text">
                  <strong>{room.name}</strong>
                  <small>{room.ownerName ? `di ${room.ownerName}` : room.description}</small>
                </span>
                {room.likes > 0 && <span className="hotel-room-likes"><i className="ph-fill ph-heart" /> {room.likes}</span>}
                {room.doorMode === 'closed' && <i className="ph-fill ph-lock" title="Porta chiusa" />}
                {here && <span className="hotel-room-here">Sei qui</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
