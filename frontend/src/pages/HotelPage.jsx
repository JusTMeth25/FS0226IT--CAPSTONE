import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { useHotel } from '../hotel/hotel-context.js';
import { furniApi } from '../services/furniApi.js';
import { tradeApi } from '../services/tradeApi.js';
import { roomApi } from '../services/roomApi.js';
import HotelCanvas from '../hotel/ui/HotelCanvas.jsx';
import ChatBar from '../hotel/ui/ChatBar.jsx';
import Navigator from '../hotel/ui/Navigator.jsx';
import Wardrobe from '../hotel/ui/Wardrobe.jsx';
import Shop from '../hotel/ui/Shop.jsx';
import Inventory from '../hotel/ui/Inventory.jsx';
import ItemMenu from '../hotel/ui/ItemMenu.jsx';
import CardPicker from '../hotel/ui/CardPicker.jsx';
import CardViewer from '../hotel/ui/CardViewer.jsx';
import RoomSettings from '../hotel/ui/RoomSettings.jsx';
import UserCard from '../hotel/ui/UserCard.jsx';
import PvpPanel from '../hotel/ui/PvpPanel.jsx';
import TradesPanel from '../hotel/ui/TradesPanel.jsx';
import { useSearchParams } from 'react-router-dom';
import HotelView from '../hotel/ui/HotelView.jsx';
import { DEFAULT_LOOK } from '../hotel/sprites/avatar.js';
import { TRACKS, getJukebox } from '../hotel/music.js';
import '../hotel/hotel.css';

const ERRORS = {
  room_full: 'La stanza e\' piena. Riprova tra poco.',
  room_closed: 'La porta di questa stanza e\' chiusa.',
  room_not_found: 'Questa stanza non esiste piu\'.',
  chat_muted: 'Stai scrivendo troppo in fretta: aspetta 30 secondi.',
  user_not_here: 'Quella persona non e\' in questa stanza.',
  not_your_room: 'Puoi arredare solo la tua stanza.',
  not_your_item: 'Questo mobile non e\' tuo.',
  card_not_owned: 'Puoi esporre solo carte che possiedi (una vetrina per copia).',
  cant_place_outside: 'Il mobile esce dalla stanza.',
  cant_place_uneven: 'Il mobile deve stare tutto sullo stesso livello.',
  cant_place_door: 'Non si puo\' bloccare la porta.',
  cant_place_occupied: 'Quello spazio e\' gia\' occupato.',
  cant_place_no_wall: 'Qui non c\'e\' una parete.',
  no_respects_left: 'Hai gia\' dato tutti i rispetti di oggi (3 al giorno).',
  already_respected: 'Oggi gli hai gia\' dato rispetto.',
  too_far: 'Non riesco ad arrivare al bancone: e\' tutto occupato.',
  jukebox_cooldown: 'Un attimo: il brano e\' appena cambiato.',
  no_jukebox: 'In questa stanza non c\'e\' un jukebox.',
  not_usable: 'Questo mobile non si usa.',
  cannot_challenge_yourself: 'Non puoi sfidare te stesso.',
  already_in_match: 'Sei gia\' in una sfida.',
  opponent_busy: 'Quel giocatore e\' gia\' impegnato in una sfida.',
  challenge_expired: 'La sfida e\' scaduta.',
  invalid_team: 'Scegli 3 carte diverse.',
  invalid_move: 'Mossa non valida in questo momento.',
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
 * La pagina tiene lo stato "da pannello" (stanza, presenti, mobili, pannelli aperti). Tutto
 * cio' che cambia a ogni fotogramma (camminate, fumetti, luci) lo gestisce il motore del canvas.
 */
export default function HotelPage() {
  const { user, refreshUser } = useAuth();
  const { gold } = useGame();
  const { sound } = useSound();
  const canvasRef = useRef(null);
  const hotel = useHotel();
  const { status, send } = hotel;
  // Ultima stanza nota al provider, letta dai gestori dei messaggi senza dipendere dal render.
  const hotelRoomRef = useRef(hotel.roomId);
  useEffect(() => { hotelRoomRef.current = hotel.roomId; }, [hotel.roomId]);
  // Vero da quando si chiede lo stato della stanza al ritorno sulla pagina fino alla risposta.
  const syncPending = useRef(false);
  const [searchParams] = useSearchParams();

  const [me, setMe] = useState(() => hotel.me);
  const [room, setRoom] = useState(null);
  const [people, setPeople] = useState({});
  const [items, setItems] = useState({});
  const [catalog, setCatalog] = useState([]);
  // Con ?panel=trades (dall'avviso di uno scambio) si apre subito il pannello scambi.
  const [panel, setPanel] = useState(() => (searchParams.get('panel') === 'trades' ? 'trades' : hotel.roomId ? null : 'navigator'));
  const [buildMode, setBuildMode] = useState(false);
  const [pendingTrades, setPendingTrades] = useState(0);
  const [selected, setSelected] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [pickingCardFor, setPickingCardFor] = useState(null);
  const [viewingCard, setViewingCard] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [whisperTo, setWhisperTo] = useState(null);
  const [notice, setNotice] = useState(null);
  const [zoom, setZoom] = useState(() => (window.innerWidth < 600 ? 1 : 2));
  const [jukebox, setJukebox] = useState({ track: -1 });
  const [likes, setLikes] = useState(null);
  const [respectVersion, setRespectVersion] = useState(0);
  const [pvp, setPvp] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const noticeTimer = useRef(0);
  const meRef = useRef(null);
  const peopleRef = useRef({});
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { peopleRef.current = people; }, [people]);

  // Uscendo dall'hotel la musica si ferma.
  useEffect(() => () => getJukebox().set(-1, 0), []);

  const catalogByType = useMemo(() => new Map(catalog.map((d) => [d.type, d])), [catalog]);

  useEffect(() => {
    furniApi.catalog().then((res) => setCatalog(res.furni || [])).catch(() => setCatalog([]));
  }, []);

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
        syncPending.current = false;
        setRoom(message.room);
        setPeople(Object.fromEntries(message.users.map((u) => [u.id, u])));
        setItems(Object.fromEntries((message.items || []).map((i) => [i.id, i])));
        setJukebox({ track: message.jukebox?.track ?? -1 });
        getJukebox().set(message.jukebox?.track ?? -1, message.jukebox?.startedAt ?? 0, message.serverTime);
        setPanel((current) => (current === 'trades' ? current : null));
        setSelected(null);
        setSelectedItemId(null);
        setPlacement(null);
        setBuildMode(false);
        break;
      case 'not_in_room':
        setRoom(null);
        setPanel((current) => current || 'navigator');
        break;
      case 'user_away':
        setPeople((p) => (p[message.id] ? { ...p, [message.id]: { ...p[message.id], away: message.away } } : p));
        break;
      case 'trade_event':
        if (message.kind === 'received') showNotice(`${message.other} ti ha proposto uno scambio: aprilo da Scambi.`);
        if (message.kind === 'accepted') showNotice(`${message.other} ha accettato il tuo scambio!`);
        if (message.kind === 'rejected') showNotice(`${message.other} ha rifiutato il tuo scambio.`);
        break;
      case 'room_updated':
        setRoom((r) => (r ? { ...r, ...message.room } : r));
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
      case 'item_added':
      case 'item_updated':
        setItems((i) => ({ ...i, [message.item.id]: message.item }));
        break;
      case 'item_removed':
        setItems((i) => {
          const next = { ...i };
          delete next[message.id];
          return next;
        });
        setSelectedItemId((id) => (id === message.id ? null : id));
        break;
      case 'jukebox':
        setJukebox({ track: message.track });
        getJukebox().set(message.track, message.startedAt, message.serverTime);
        break;
      case 'respect': {
        const from = peopleRef.current[message.from]?.username || 'Qualcuno';
        const to = peopleRef.current[message.to]?.username || 'qualcuno';
        if (message.to === meRef.current?.id) showNotice(`${from} ti ha dato rispetto! Ne hai ${message.total}.`);
        else if (message.from !== meRef.current?.id) showNotice(`${from} ha dato rispetto a ${to}.`);
        setRespectVersion((v) => v + 1);
        break;
      }
      case 'respects_left':
        showNotice(`Rispetto dato! Te ne restano ${message.left} per oggi.`);
        break;
      // ---- sfide fra giocatori: lo stato del pannello segue i messaggi del server
      case 'challenge_received':
        setPvp({ stage: 'incoming', challengeId: message.challengeId, from: message.from });
        sound.coin();
        break;
      case 'challenge_sent':
        setPvp({ stage: 'sent', to: message.to });
        break;
      case 'challenge_declined':
        setPvp(null);
        showNotice(`${message.by} ha rifiutato la sfida.`);
        break;
      case 'challenge_expired':
        setPvp((p) => (p && (p.stage === 'incoming' || p.stage === 'sent') ? null : p));
        break;
      case 'pvp_start':
        setClockOffset(message.serverTime - Date.now());
        setPvp({ stage: 'team', matchId: message.matchId, opponent: message.opponent, deadline: message.teamDeadline });
        setSelected(null);
        break;
      case 'pvp_team_ok':
        setPvp((p) => (p ? { ...p, teamSent: true } : p));
        break;
      case 'pvp_opponent_ready':
        setPvp((p) => (p ? { ...p, opponentReady: true } : p));
        break;
      case 'pvp_round':
        setClockOffset(message.serverTime - Date.now());
        setPvp((p) => ({
          ...p, stage: 'round', round: message.round, chooser: message.chooser, category: null,
          deadline: message.deadline || null, team: message.team, used: message.used, boostUsed: message.boostUsed,
          score: message.score, picked: false, pickedIndex: null, opponentPicked: false
        }));
        break;
      case 'pvp_category':
        setPvp((p) => (p ? { ...p, stage: 'round', category: message.category, deadline: message.deadline } : p));
        break;
      case 'pvp_card_ok':
        setPvp((p) => (p ? { ...p, picked: true, pickedIndex: message.index } : p));
        break;
      case 'pvp_opponent_picked':
        setPvp((p) => (p ? { ...p, opponentPicked: true } : p));
        break;
      case 'pvp_reveal':
        setPvp((p) => (p ? { ...p, stage: 'reveal', reveal: message, score: message.score, deadline: null } : p));
        if (message.winner === 'you') sound.roundWin();
        else if (message.winner === 'opponent') sound.roundLose();
        else sound.roundDraw();
        break;
      case 'pvp_end':
        setPvp((p) => ({ ...p, stage: 'end', result: message.result, score: message.score, reward: message.reward, forfeit: message.forfeit, deadline: null }));
        if (message.result === 'win') sound.battleWin();
        else if (message.result === 'loss') sound.battleLose();
        else sound.battleDraw();
        refreshUser();
        break;
      case 'pvp_cancelled':
        setPvp(null);
        showNotice('Sfida annullata: nessuno ha scelto la squadra in tempo.');
        break;
      case 'pvp_result': {
        const mine = [message.a, message.b].includes(meRef.current?.username);
        if (!mine) {
          showNotice(message.winner
            ? `${message.winner} ha vinto la sfida ${message.a} contro ${message.b} (${message.scoreA}-${message.scoreB})${message.forfeit ? ' a tavolino' : ''}!`
            : `Sfida ${message.a} contro ${message.b}: pareggio!`);
        }
        break;
      }
      case 'inventory_changed':
        setInventoryVersion((v) => v + 1);
        break;
      case 'kicked':
        setRoom(null);
        setPanel('navigator');
        showNotice('Il proprietario ti ha accompagnato fuori dalla stanza.');
        break;
      case 'error':
        // Un server che non conosce ancora "sync" (per esempio avviato prima dell'aggiornamento):
        // invece di un errore si rientra nella stanza in cui si era.
        if (message.code === 'unknown_command' && syncPending.current) {
          syncPending.current = false;
          if (hotelRoomRef.current) send({ type: 'join', roomId: hotelRoomRef.current });
          else setPanel((current) => current || 'navigator');
          break;
        }
        showNotice(ERRORS[message.code] || ERRORS.server_error);
        break;
      default:
        break;
    }
  }, [showNotice, sound, refreshUser, send]);

  // Iscrizione ai messaggi dell'hotel finche' la pagina e' aperta. La connessione resta del
  // provider: uscendo si resta nella stanza, segnati come assenti; tornando si chiede lo stato
  // attuale della stanza invece di rientrare dalla porta.
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => {
    hotel.activate();
    const unsubscribe = hotel.subscribe((message) => onMessageRef.current(message));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- iscrizione una volta sola per montaggio
  }, []);

  const online = status === 'online';
  useEffect(() => {
    if (!online) return undefined;
    syncPending.current = true;
    send({ type: 'sync' });
    send({ type: 'away', on: false });
    return () => send({ type: 'away', on: true });
  }, [online, send]);

  // Scambi ricevuti in attesa: il numero sul pulsante Scambi, aggiornato a ogni evento.
  useEffect(() => {
    let cancelled = false;
    tradeApi.getIncoming()
      .then((res) => {
        if (!cancelled) setPendingTrades((res.trades || []).filter((t) => t.status?.toLowerCase() === 'pending').length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hotel.tradeVersion]);

  // Una sfida arrivata mentre si era su un'altra pagina.
  useEffect(() => {
    const challenge = hotel.pendingChallenge;
    if (!challenge) return;
    hotel.takePendingChallenge();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stato ricevuto dal provider mentre la pagina era chiusa
    setPvp({ stage: 'incoming', challengeId: challenge.challengeId, from: challenge.from });
  }, [hotel]);

  const join = (roomId) => send({ type: 'join', roomId });
  const myLook = me?.look || user?.hotelLook || DEFAULT_LOOK;
  const myStatus = me ? people[me.id]?.status : null;
  const isOwner = !!(room && me && room.ownerId === me.id);
  const selectedItem = selectedItemId ? items[selectedItemId] : null;

  const toggleStatus = (value) => send({ type: 'status', status: myStatus === value ? 'idle' : value });

  useEffect(() => {
    if (!room?.id) return undefined;
    let cancelled = false;
    roomApi.likes(room.id).then((res) => { if (!cancelled) setLikes(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, [room?.id]);

  async function toggleLike() {
    try {
      setLikes(await roomApi.like(room.id));
    } catch {
      showNotice('Non e\' stato possibile mettere "mi piace".');
    }
  }

  const canUseJukebox = !!room && (room.isPublic || isOwner);

  async function goToMyRoom() {
    try {
      const res = await roomApi.mine();
      join(res.room.id);
    } catch {
      showNotice('Non riesco ad aprire la tua stanza. Riprova.');
    }
  }

  // Durante il posizionamento: R ruota, Esc annulla.
  useEffect(() => {
    if (!placement) return undefined;
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'r' || event.key === 'R') setPlacement((p) => ({ ...p, rot: p.rot === 2 ? 0 : 2 }));
      if (event.key === 'Escape') setPlacement(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placement]);

  function onItemClick(item, tile) {
    const def = catalogByType.get(item.type);
    // In modalita' arredo il proprietario seleziona il mobile per ruotarlo, spostarlo, raccoglierlo.
    if (isOwner && buildMode) {
      setSelected(null);
      setSelectedItemId(item.id);
      return;
    }
    // Bancone: si riceve una bibita (camminandoci accanto se serve). Jukebox: cambia brano.
    if (item.type === 'bar_counter' || item.type === 'jukebox') {
      send({ type: 'use_item', itemId: item.id });
      return;
    }
    // Pista e tappeti si calpestano: fuori dalla modalita' arredo il clic vale come camminare li'.
    if (def?.walkable && tile) {
      send({ type: 'move', x: tile.x, y: tile.y });
      return;
    }
    // Sedie e divani: ci si va a sedere, anche nella propria stanza.
    if (def?.sitDir >= 0) {
      send({ type: 'move', x: item.x, y: item.y });
      return;
    }
    if (item.card) {
      setViewingCard(item.card);
      return;
    }
    // Fuori dalla modalita' arredo gli altri mobili non fanno nulla: si cammina li' accanto.
    if (tile) send({ type: 'move', x: tile.x, y: tile.y });
  }

  return (
    <section className="hotel-page" onPointerDown={() => getJukebox().unlock()}>
      <div className="hotel-stage">
        <HotelCanvas
          ref={canvasRef}
          zoom={zoom}
          catalog={catalog}
          placement={placement}
          buildMode={isOwner && buildMode}
          onTileClick={(tile) => send({ type: 'move', x: tile.x, y: tile.y })}
          onAvatarClick={(u) => { setSelectedItemId(null); setSelected(u); }}
          onItemClick={onItemClick}
          onPlace={(tile, current) => {
            send({ type: 'place', itemId: current.itemId, x: tile.x, y: tile.y, rot: current.rot });
            setPlacement(null);
          }}
        />

        {!room && <HotelView />}

        {room && (
          <div className="hotel-room-info">
            <strong>{room.name}</strong>
            <span>{room.ownerName ? `Stanza di ${room.ownerName}` : 'Stanza pubblica'} · <i className="ph-fill ph-user" /> {Object.keys(people).length}</span>
            <div className="hotel-room-info-actions">
              {likes && (
                <button type="button" className={`hotel-like${likes.liked ? ' liked' : ''}`} onClick={toggleLike} disabled={isOwner}
                  title={isOwner ? 'I "mi piace" degli altri alla tua stanza' : 'Mi piace questa stanza'}>
                  <i className={likes.liked ? 'ph-fill ph-heart' : 'ph ph-heart'} /> {likes.likes}
                </button>
              )}
              {jukebox.track >= 0 && (
                <span className="hotel-now-playing">
                  <i className="ph-fill ph-music-notes" /> {TRACKS[jukebox.track]?.name}
                  {canUseJukebox && (
                    <button type="button" onClick={() => send({ type: 'jukebox', on: false })} title="Spegni il jukebox"><i className="ph-fill ph-stop" /></button>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {!online && <div className="hotel-status">{STATUS_LABELS[status]}</div>}
        {notice && <div className="hotel-notice" role="status">{notice}</div>}

        {placement && (
          <div className="hotel-placement-bar" role="status">
            <span><i className="ph-fill ph-hand-grabbing" /> {catalogByType.get(placement.type)?.name}: clicca una casella</span>
            {!catalogByType.get(placement.type)?.wall && (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setPlacement((p) => ({ ...p, rot: p.rot === 2 ? 0 : 2 }))}>
                <i className="ph-fill ph-arrow-clockwise" /> Ruota (R)
              </button>
            )}
            {catalogByType.get(placement.type)?.wall && (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setPlacement((p) => ({ ...p, rot: p.rot === 2 ? 0 : 2 }))}>
                <i className="ph-fill ph-swap" /> Cambia parete (R)
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setPlacement(null)}>Annulla</button>
          </div>
        )}

        {selected && (
          <UserCard
            user={selected}
            look={people[selected.id]?.look}
            isMe={selected.id === me?.id}
            isOwner={isOwner}
            respectVersion={respectVersion}
            onClose={() => setSelected(null)}
            onWhisper={() => { setWhisperTo(selected.username); setSelected(null); }}
            onRespect={() => send({ type: 'respect', userId: selected.id })}
            onKick={() => { send({ type: 'kick', userId: selected.id }); setSelected(null); }}
            onVisit={(roomId) => { join(roomId); setSelected(null); }}
            onViewCard={(card) => setViewingCard(card)}
            onChallenge={pvp ? null : () => { send({ type: 'challenge', userId: selected.id }); setSelected(null); }}
          />
        )}

        {pvp && <PvpPanel pvp={pvp} clockOffset={clockOffset} send={send} onClose={() => setPvp(null)} />}

        {selectedItem && (
          <ItemMenu
            item={selectedItem}
            def={catalogByType.get(selectedItem.type)}
            isOwner={isOwner}
            onClose={() => setSelectedItemId(null)}
            onViewCard={() => setViewingCard(selectedItem.card)}
            onChooseCard={() => { setPickingCardFor(selectedItem); setSelectedItemId(null); }}
            onRotate={() => send({ type: 'place', itemId: selectedItem.id, x: selectedItem.x, y: selectedItem.y, rot: selectedItem.rot === 2 ? 0 : 2 })}
            onMove={() => { setPlacement({ itemId: selectedItem.id, type: selectedItem.type, rot: selectedItem.rot }); setSelectedItemId(null); }}
            onPickup={() => { send({ type: 'pickup', itemId: selectedItem.id }); setSelectedItemId(null); }}
            jukeboxOn={jukebox.track >= 0}
            onJukebox={(on) => send({ type: 'jukebox', on })}
          />
        )}

        {pickingCardFor && (
          <CardPicker
            current={items[pickingCardFor.id]?.card}
            onClose={() => setPickingCardFor(null)}
            onClear={() => { send({ type: 'set_display', itemId: pickingCardFor.id, cardId: null }); setPickingCardFor(null); }}
            onPick={(card) => { send({ type: 'set_display', itemId: pickingCardFor.id, cardId: card.id }); setPickingCardFor(null); }}
          />
        )}

        {panel === 'navigator' && (
          <Navigator
            currentRoomId={room?.id}
            onJoin={join}
            onMyRoom={goToMyRoom}
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
        {panel === 'shop' && (
          <Shop
            catalog={catalog}
            gold={gold}
            onClose={() => setPanel(null)}
            onBought={(def) => {
              refreshUser();
              setInventoryVersion((v) => v + 1);
              showNotice(`${def.name} aggiunto all'inventario!`);
            }}
          />
        )}
        {panel === 'inventory' && (
          <Inventory
            catalogByType={catalogByType}
            canPlace={isOwner}
            version={inventoryVersion}
            onClose={() => setPanel(null)}
            onPlace={(item) => { setPlacement({ itemId: item.id, type: item.type, rot: 0 }); setPanel(null); }}
          />
        )}
        {panel === 'settings' && room && isOwner && <RoomSettings room={room} onClose={() => setPanel(null)} />}
        {panel === 'trades' && (
          <TradesPanel version={hotel.tradeVersion} onPendingChange={setPendingTrades} onClose={() => setPanel(null)}
            onViewCard={(card) => setViewingCard(card)} />
        )}
        {buildMode && isOwner && !placement && (
          <div className="hotel-placement-bar hotel-build-bar" role="status">
            <span><i className="ph-fill ph-hammer" /> Modalita' arredo: clicca un mobile per modificarlo</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => { setBuildMode(false); setSelectedItemId(null); }}>Fine</button>
          </div>
        )}
      </div>

      {viewingCard && <CardViewer card={viewingCard} onClose={() => setViewingCard(null)} />}

      <div className="hotel-toolbar">
        <button type="button" className={`hotel-tool${panel === 'navigator' ? ' active' : ''}`} onClick={() => setPanel(panel === 'navigator' ? null : 'navigator')} title="Navigatore">
          <i className="ph-fill ph-compass" /><span>Stanze</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'shop' ? ' active' : ''}`} onClick={() => setPanel(panel === 'shop' ? null : 'shop')} title="Negozio">
          <i className="ph-fill ph-storefront" /><span>Negozio</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'inventory' ? ' active' : ''}`} onClick={() => setPanel(panel === 'inventory' ? null : 'inventory')} title="Inventario">
          <i className="ph-fill ph-package" /><span>Borsa</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'wardrobe' ? ' active' : ''}`} onClick={() => setPanel(panel === 'wardrobe' ? null : 'wardrobe')} title="Guardaroba">
          <i className="ph-fill ph-t-shirt" /><span>Look</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'trades' ? ' active' : ''}`} onClick={() => setPanel(panel === 'trades' ? null : 'trades')} title="Scambi">
          <i className="ph-fill ph-arrows-left-right" /><span>Scambi</span>
          {pendingTrades > 0 && <b className="hotel-tool-badge">{pendingTrades}</b>}
        </button>
        {isOwner && (
          <button type="button" className={`hotel-tool${buildMode ? ' active' : ''}`}
            onClick={() => { setBuildMode((b) => !b); setSelectedItemId(null); }}
            title="Modalita' arredo: clicca un mobile per ruotarlo, spostarlo o rimetterlo nell'inventario">
            <i className="ph-fill ph-hammer" /><span>Arreda</span>
          </button>
        )}
        {isOwner && (
          <button type="button" className={`hotel-tool${panel === 'settings' ? ' active' : ''}`} onClick={() => setPanel(panel === 'settings' ? null : 'settings')} title="Impostazioni stanza">
            <i className="ph-fill ph-gear-six" /><span>Stanza</span>
          </button>
        )}

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
