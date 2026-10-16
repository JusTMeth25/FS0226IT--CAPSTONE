import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HotelContext } from './hotel-context.js';
import { useHotelSocket } from './useHotelSocket.js';

/**
 * Connessione all'hotel a livello di app.
 *
 * Aperta alla prima visita dell'hotel, resta attiva mentre si naviga nel resto del sito:
 * aprendo la collezione o il mercato si resta nella stanza (gli altri vedono l'avatar
 * "assente") e si ricevono comunque sfide e proposte di scambio. Tornando all'hotel la pagina
 * chiede al server lo stato attuale della stanza invece di rientrarci.
 *
 * I messaggi vanno a chi si iscrive con subscribe (la pagina dell'hotel). Sfide e scambi che
 * arrivano mentre si e' altrove diventano un avviso in basso nella pagina corrente.
 */
export default function HotelProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  const [me, setMe] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingChallenge, setPendingChallenge] = useState(null);
  /** Inizio di una partita del torneo arrivato quando nessuna pagina lo ascoltava. */
  const pendingMatch = useRef(null);
  const [tradeVersion, setTradeVersion] = useState(0);
  const listeners = useRef(new Set());
  const roomIdRef = useRef(null);
  const sendRef = useRef(() => {});

  const onMessage = useCallback((message) => {
    switch (message.type) {
      case 'hello':
        setMe(message.user);
        break;
      case 'room_state':
        roomIdRef.current = message.room.id;
        setRoomId(message.room.id);
        break;
      case 'kicked':
      case 'not_in_room':
        roomIdRef.current = null;
        setRoomId(null);
        break;
      case 'trade_event':
        setTradeVersion((v) => v + 1);
        break;
      default:
        break;
    }

    // Una sfida scaduta o annullata sparisce sempre, anche dall'avviso globale.
    if (message.type === 'challenge_expired') {
      setPendingChallenge((c) => (c && c.challengeId === message.challengeId ? null : c));
      setToast((t) => (t?.kind === 'challenge' ? null : t));
    }

    if (message.type === 'pvp_end' || message.type === 'pvp_cancelled') pendingMatch.current = null;

    // Nessuna pagina hotel aperta: sfide e scambi diventano un avviso globale.
    if (listeners.current.size === 0) {
      if (message.type === 'pvp_start' && message.tournament) {
        pendingMatch.current = message;
        setToast({ kind: 'tournament', text: `Torneo: tocca a te (${message.tournament}) contro ${message.opponent?.username}!` });
      } else if (message.type === 'challenge_received') {
        setPendingChallenge({ ...message, receivedAt: Date.now() });
        setToast({ kind: 'challenge', text: `${message.from.username} ti sfida nell'hotel!` });
      } else if (message.type === 'trade_event' && message.kind === 'received') {
        setToast({ kind: 'trade', text: `${message.other} ti ha proposto uno scambio.` });
      } else if (message.type === 'trade_event' && message.kind === 'accepted') {
        setToast({ kind: 'trade', text: `${message.other} ha accettato il tuo scambio!` });
      }
    }
    listeners.current.forEach((listener) => listener(message));
  }, []);

  const { status, send, resume } = useHotelSocket({
    enabled,
    onMessage,
    // Dopo una caduta di rete si torna nella stanza in cui si era.
    onReconnect: () => {
      if (roomIdRef.current) sendRef.current({ type: 'join', roomId: roomIdRef.current });
    }
  });
  useEffect(() => { sendRef.current = send; }, [send]);

  const subscribe = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const value = useMemo(() => ({
    status, send, resume, subscribe, me, roomId,
    activate: () => setEnabled(true),
    pendingChallenge,
    takePendingChallenge: () => {
      const challenge = pendingChallenge;
      setPendingChallenge(null);
      return challenge;
    },
    tradeVersion,
    /** La partita del torneo cominciata altrove (una volta sola), per chi apre adesso la pagina. */
    takePendingMatch: () => {
      const match = pendingMatch.current;
      pendingMatch.current = null;
      return match;
    },
    clearToast: () => setToast(null)
  }), [status, send, resume, subscribe, me, roomId, pendingChallenge, tradeVersion]);

  return (
    <HotelContext.Provider value={value}>
      {children}
      <HotelToast toast={toast} onClose={() => setToast(null)} />
    </HotelContext.Provider>
  );
}

/** Avviso di sfida o scambio mostrato sulle altre pagine del sito. */
function HotelToast({ toast, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  if (!toast || location.pathname.startsWith('/hotel')) return null;

  const go = () => {
    onClose();
    navigate(toast.kind === 'trade' ? '/hotel?panel=trades' : toast.kind === 'tournament' ? '/battle?mode=tournament' : '/hotel');
  };

  return (
    <div className="hotel-toast" role="status">
      <i className={`ph-fill ${toast.kind === 'challenge' ? 'ph-sword' : toast.kind === 'tournament' ? 'ph-trophy' : 'ph-arrows-left-right'}`} />
      <span>{toast.text}</span>
      <button type="button" className="btn btn-primary btn-small" onClick={go}>
        {toast.kind === 'challenge' ? 'Vai all\'hotel' : toast.kind === 'tournament' ? 'Gioca' : 'Vedi'}
      </button>
      <button type="button" className="hotel-toast-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
    </div>
  );
}
