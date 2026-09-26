import { useCallback, useEffect, useRef, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';
import AvatarPreview from './AvatarPreview.jsx';

const ERRORS = {
  user_not_found: 'Nessun giocatore con questo nome.',
  friend_self: 'Non puoi aggiungere te stesso.',
  already_friends: 'Siete gia\' amici.',
  friend_already_requested: 'Richiesta gia\' mandata.',
  too_many_friends: 'Hai troppi amici!',
  not_friends: 'Potete scrivervi solo da amici.',
  message_empty: 'Messaggio vuoto.'
};

/**
 * Amici dell'hotel: chi e' online e in che stanza (per raggiungerlo), le richieste in arrivo,
 * la chat privata. I messaggi nuovi arrivano dal WebSocket (prop `incoming`).
 */
export default function FriendsPanel({ me, incoming, version, onJoin, onUnreadChange, onClose }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('friends');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState(null);
  const [chat, setChat] = useState(null);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const reload = useCallback(() => {
    hotelApi.friends().then((res) => {
      setData(res);
      const unread = res.friends.reduce((sum, f) => sum + (f.unread || 0), 0) + res.incoming.length;
      onUnreadChange?.(unread);
    }).catch(() => setNotice('Amici non raggiungibili, riprova.'));
  }, [onUnreadChange]);

  useEffect(() => { reload(); }, [reload, version]);

  // Messaggio in arrivo: se la chat con quell'amico e' aperta, si aggiunge; altrimenti si ricarica la lista.
  useEffect(() => {
    if (!incoming) return;
    // La chat aperta si rilegge dal server (cosi' il messaggio risulta anche letto).
    if (chat && incoming.from === chat.id) hotelApi.thread(chat.id).then(setThread).catch(() => {});
    else reload();
  }, [incoming, chat, reload]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread]);

  const openChat = (friend) => {
    setChat(friend);
    setThread([]);
    hotelApi.thread(friend.id).then((res) => { setThread(res); reload(); }).catch(() => setNotice('Chat non disponibile.'));
  };

  const act = (promise, ok) => promise.then(() => { if (ok) setNotice(ok); reload(); })
    .catch((err) => setNotice(ERRORS[err?.code] || 'Qualcosa e\' andato storto.'));

  const sendMessage = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !chat) return;
    setText('');
    hotelApi.sendMessage(chat.id, value).then((msg) => setThread((t) => [...t, msg]))
      .catch((err) => setNotice(ERRORS[err?.code] || 'Messaggio non inviato.'));
  };

  const friends = data?.friends || [];
  const requests = data?.incoming || [];
  return (
    <div className="hotel-panel hotel-friends" role="dialog" aria-label="Amici">
      <header className="hotel-panel-header">
        <h3>{chat ? <><i className="ph-fill ph-chat-circle-dots" /> {chat.username}</> : <><i className="ph-fill ph-users-three" /> Amici</>}</h3>
        {chat && <button type="button" className="btn btn-secondary btn-small" onClick={() => setChat(null)}><i className="ph ph-arrow-left" /> Lista</button>}
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>

      {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}

      {chat ? (
        <div className="friends-chat">
          <div className="friends-chat-list" ref={listRef}>
            {thread.length === 0 && <p className="hotel-panel-hint">Nessun messaggio: scrivi tu per primo!</p>}
            {thread.map((m) => (
              <div key={m.id} className={`friends-msg${m.from === me?.id ? ' mine' : ''}`}>
                <span>{m.text}</span>
                <time>{m.at ? new Date(m.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</time>
              </div>
            ))}
          </div>
          <form className="friends-chat-form" onSubmit={sendMessage}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder={`Scrivi a ${chat.username}…`} aria-label="Messaggio" />
            <button type="submit" className="btn btn-primary btn-small" disabled={!text.trim()}><i className="ph-fill ph-paper-plane-tilt" /></button>
          </form>
        </div>
      ) : (
        <>
          <div className="friends-tabs">
            <button type="button" className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>Amici ({friends.length})</button>
            <button type="button" className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
              Richieste {requests.length > 0 && <b className="hotel-tool-badge">{requests.length}</b>}
            </button>
          </div>
          <form className="friends-add" onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(hotelApi.friendRequest(name.trim()), 'Richiesta mandata!'); setName(''); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome del giocatore" aria-label="Nome del giocatore da aggiungere" maxLength={50} />
            <button type="submit" className="btn btn-primary btn-small"><i className="ph-fill ph-user-plus" /> Aggiungi</button>
          </form>

          {tab === 'friends' && (
            <ul className="friends-list">
              {data && friends.length === 0 && <li className="hotel-panel-hint">Ancora nessun amico: aggiungine uno per nome, o dalla sua scheda.</li>}
              {friends.map((f) => (
                <li key={f.id} className={f.online ? 'online' : ''}>
                  <AvatarPreview look={f.look} scale={0.5} />
                  <div className="friends-who">
                    <strong>{f.username}</strong>
                    <span>{f.online ? (f.roomName ? `In ${f.roomName}` : 'Online') : 'Offline'}</span>
                  </div>
                  {f.unread > 0 && <b className="hotel-tool-badge">{f.unread}</b>}
                  {f.roomId && <button type="button" className="btn btn-secondary btn-small" onClick={() => onJoin(f.roomId)} title="Raggiungi"><i className="ph-fill ph-person-simple-walk" /></button>}
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => openChat(f)} title="Messaggio"><i className="ph-fill ph-chat-circle-dots" /></button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => act(hotelApi.removeFriend(f.id))} title="Rimuovi"><i className="ph ph-user-minus" /></button>
                </li>
              ))}
            </ul>
          )}
          {tab === 'requests' && (
            <ul className="friends-list">
              {requests.length === 0 && (data?.outgoing || []).length === 0 && <li className="hotel-panel-hint">Nessuna richiesta.</li>}
              {requests.map((r) => (
                <li key={r.id}>
                  <AvatarPreview look={r.look} scale={0.5} />
                  <div className="friends-who"><strong>{r.username}</strong><span>Vuole essere tuo amico</span></div>
                  <button type="button" className="btn btn-primary btn-small" onClick={() => act(hotelApi.acceptFriend(r.requestId), `Ora tu e ${r.username} siete amici!`)}>Accetta</button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => act(hotelApi.removeFriend(r.id))}>Rifiuta</button>
                </li>
              ))}
              {(data?.outgoing || []).map((r) => (
                <li key={r.id}>
                  <AvatarPreview look={r.look} scale={0.5} />
                  <div className="friends-who"><strong>{r.username}</strong><span>In attesa di risposta</span></div>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => act(hotelApi.removeFriend(r.id))}>Annulla</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
