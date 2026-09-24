import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useHotelSocket } from '../hotel/useHotelSocket.js';
import HotelCanvas from '../hotel/ui/HotelCanvas.jsx';
import ChatBar from '../hotel/ui/ChatBar.jsx';
import Navigator from '../hotel/ui/Navigator.jsx';
import Wardrobe from '../hotel/ui/Wardrobe.jsx';
import AvatarPreview from '../hotel/ui/AvatarPreview.jsx';
import { DEFAULT_LOOK } from '../hotel/sprites/avatar.js';
import '../hotel/hotel.css';

const ERRORS = {
  room_full: 'La stanza e\' piena. Riprova tra poco.',
  room_closed: 'La porta di questa stanza e\' chiusa.',
  room_not_found: 'Questa stanza non esiste piu\'.',
  chat_muted: 'Stai scrivendo troppo in fretta: aspetta 30 secondi.',
  user_not_here: 'Quella persona non e\' in questa stanza.',
  server_error: 'Qualcosa e\' andato storto. Riprova.'
};

const STATUS_LABELS = {
  connecting: 'Connessione all\'hotel…',
  reconnecting: 'Connessione persa, riprovo…',
  replaced: 'Hai aperto l\'hotel in un\'altra scheda o dispositivo.',
  auth_failed: 'Sessione scaduta: esci e rientra per tornare nell\'hotel.',
  banned: 'Il tuo account e\' sospeso.'
};

/**
 * VinylDex Hotel: la lobby social in stile Habbo.
 *
 * La pagina tiene lo stato "da pannello" (stanza attuale, chi c'e', pannelli aperti). Tutto
 * cio' che cambia a ogni fotogramma (camminate, fumetti) lo gestisce il motore del canvas.
 */
export default function HotelPage() {
  const { user, refreshUser } = useAuth();
  const canvasRef = useRef(null);
  const roomIdRef = useRef(null);

  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [people, setPeople] = useState({});
  const [panel, setPanel] = useState('navigator');
  const [selected, setSelected] = useState(null);
  const [whisperTo, setWhisperTo] = useState(null);
  const [notice, setNotice] = useState(null);
  const [zoom, setZoom] = useState(() => (window.innerWidth < 600 ? 1 : 2));
  const noticeTimer = useRef(0);

  const showNotice = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const onMessage = useCallback((message) => {
    canvasRef.current?.handle(message);
    switch (message.type) {
      case 'hello':
        setMe(message.user);
        break;
      case 'room_state':
        roomIdRef.current = message.room.id;
        setRoom(message.room);
        setPeople(Object.fromEntries(message.users.map((u) => [u.id, u])));
        setPanel(null);
        setSelected(null);
        break;
      case 'user_joined':
        setPeople((p) => ({ ...p, [message.user.id]: message.user }));
        break;
      case 'user_left':
        setPeople((p) => {
          const next = { ...p };
          delete next[message.id];
          return next;
        });
        setSelected((s) => (s?.id === message.id ? null : s));
        break;
      case 'user_update':
        setPeople((p) => ({ ...p, [message.user.id]: { ...p[message.user.id], ...message.user } }));
        break;
      case 'user_status':
        setPeople((p) => (p[message.id] ? { ...p, [message.id]: { ...p[message.id], status: message.status } } : p));
        break;
      case 'error':
        showNotice(ERRORS[message.code] || ERRORS.server_error);
        break;
      default:
        break;
    }
  }, [showNotice]);

  const { status, send } = useHotelSocket({
    onMessage,
    // Dopo una caduta di rete si torna nella stanza in cui si era.
    onReconnect: () => {
      if (roomIdRef.current) send({ type: 'join', roomId: roomIdRef.current });
    }
  });

  const join = (roomId) => send({ type: 'join', roomId });
  const online = status === 'online';
  const myLook = me?.look || user?.hotelLook || DEFAULT_LOOK;
  const myStatus = me ? people[me.id]?.status : null;

  const toggleStatus = (value) => send({ type: 'status', status: myStatus === value ? 'idle' : value });

  return (
    <section className="hotel-page">
      <div className="hotel-stage">
        <HotelCanvas
          ref={canvasRef}
          zoom={zoom}
          onTileClick={(tile) => send({ type: 'move', x: tile.x, y: tile.y })}
          onAvatarClick={(u) => setSelected(u)}
        />

        {!room && <div className="hotel-view" aria-hidden="true"><span className="hotel-view-title">VinylDex Hotel</span></div>}

        {room && (
          <div className="hotel-room-info">
            <strong>{room.name}</strong>
            <span>{room.ownerName ? `Stanza di ${room.ownerName}` : 'Stanza pubblica'} · <i className="ph-fill ph-user" /> {Object.keys(people).length}</span>
          </div>
        )}

        {!online && <div className="hotel-status">{STATUS_LABELS[status]}</div>}
        {notice && <div className="hotel-notice" role="status">{notice}</div>}

        {selected && (
          <div className="hotel-panel hotel-user-card" role="dialog" aria-label={`Profilo di ${selected.username}`}>
            <button type="button" className="hotel-panel-close" onClick={() => setSelected(null)} aria-label="Chiudi"><i className="ph ph-x" /></button>
            <AvatarPreview look={people[selected.id]?.look || selected.look} scale={3} />
            <div className="hotel-user-card-info">
              <strong>{selected.username}</strong>
              <span>Livello {people[selected.id]?.level ?? selected.level}</span>
              {selected.id !== me?.id && (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => { setWhisperTo(selected.username); setSelected(null); }}>
                  <i className="ph-fill ph-ear" /> Sussurra
                </button>
              )}
            </div>
          </div>
        )}

        {panel === 'navigator' && (
          <Navigator
            currentRoomId={room?.id}
            onJoin={join}
            onClose={room ? () => setPanel(null) : null}
          />
        )}
        {panel === 'wardrobe' && (
          <Wardrobe
            look={myLook}
            onClose={() => setPanel(null)}
            onSaved={() => {
              send({ type: 'refresh_profile' });
              refreshUser();
              setPanel(null);
              showNotice('Nuovo aspetto salvato!');
            }}
          />
        )}
      </div>

      <div className="hotel-toolbar">
        <button type="button" className={`hotel-tool${panel === 'navigator' ? ' active' : ''}`} onClick={() => setPanel(panel === 'navigator' ? null : 'navigator')} title="Navigatore">
          <i className="ph-fill ph-compass" /><span>Stanze</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'wardrobe' ? ' active' : ''}`} onClick={() => setPanel(panel === 'wardrobe' ? null : 'wardrobe')} title="Guardaroba">
          <i className="ph-fill ph-t-shirt" /><span>Look</span>
        </button>

        <ChatBar send={send} whisperTo={whisperTo} onClearWhisper={() => setWhisperTo(null)} disabled={!online || !room} />

        <div className="hotel-emotes">
          <button type="button" className="hotel-tool" onClick={() => send({ type: 'emote', emote: 'wave' })} disabled={!room} title="Saluta">
            <i className="ph-fill ph-hand-waving" />
          </button>
          <button type="button" className={`hotel-tool${myStatus === 'dance' ? ' active' : ''}`} onClick={() => toggleStatus('dance')} disabled={!room} title="Balla">
            <i className="ph-fill ph-music-notes" />
          </button>
          <button type="button" className={`hotel-tool${myStatus === 'sit' ? ' active' : ''}`} onClick={() => toggleStatus('sit')} disabled={!room} title="Siediti">
            <i className="ph-fill ph-armchair" />
          </button>
          <button type="button" className="hotel-tool" onClick={() => setZoom((z) => (z === 2 ? 1 : 2))} title="Zoom">
            <i className={`ph-fill ${zoom === 2 ? 'ph-magnifying-glass-minus' : 'ph-magnifying-glass-plus'}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
