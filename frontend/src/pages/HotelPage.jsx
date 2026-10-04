import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { useHotel } from '../hotel/hotel-context.js';
import { furniApi } from '../services/furniApi.js';
import { tradeApi } from '../services/tradeApi.js';
import { roomApi } from '../services/roomApi.js';
import { WEATHER_ICONS, isOutdoor } from '../hotel/weather.js';
import HotelCanvas from '../hotel/ui/HotelCanvas.jsx';
import ChatBar from '../hotel/ui/ChatBar.jsx';
import Navigator from '../hotel/ui/Navigator.jsx';
import Wardrobe from '../hotel/ui/Wardrobe.jsx';
import LuxuryShop from '../hotel/ui/LuxuryShop.jsx';
import TravelPanel, { TravelOverlay } from '../hotel/ui/TravelPanel.jsx';
import Shop from '../hotel/ui/Shop.jsx';
import Inventory from '../hotel/ui/Inventory.jsx';
import ItemMenu from '../hotel/ui/ItemMenu.jsx';
import JukeboxPanel from '../hotel/ui/JukeboxPanel.jsx';
import CasinoPanel from '../hotel/ui/casino/CasinoPanel.jsx';
import { CASINO_FURNI } from '../hotel/ui/casino/casinoUtils.js';
import { pokerBus } from '../hotel/ui/casino/pokerBus.js';
import { onSpotifyQueueAdd } from '../hotel/spotify.js';
import CardPicker from '../hotel/ui/CardPicker.jsx';
import CardViewer from '../hotel/ui/CardViewer.jsx';
import useDraggablePanels from '../hotel/useDraggablePanels.js';
import HotelTutorial from '../hotel/ui/HotelTutorial.jsx';
import FriendsPanel from '../hotel/ui/FriendsPanel.jsx';
import EventsPanel, { EventBanner } from '../hotel/ui/EventsPanel.jsx';
import AuctionTab from '../hotel/ui/AuctionTab.jsx';
import GalleryTab from '../hotel/ui/GalleryTab.jsx';
import QuestsTab from '../hotel/ui/QuestsTab.jsx';
import QuizOverlay from '../hotel/ui/QuizOverlay.jsx';
import MatchBar from '../hotel/ui/MatchBar.jsx';
import ClubPanel from '../hotel/ui/ClubPanel.jsx';
import StallPanel from '../hotel/ui/StallPanel.jsx';
import { SeasonTab, TournamentTab } from '../hotel/ui/SportTabs.jsx';
import PhotoModal from '../hotel/ui/PhotoModal.jsx';
import { hotelApi } from '../services/hotelApi.js';
import RoomSettings from '../hotel/ui/RoomSettings.jsx';
import UserCard from '../hotel/ui/UserCard.jsx';
import PvpPanel from '../hotel/ui/PvpPanel.jsx';
import TradesPanel from '../hotel/ui/TradesPanel.jsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HotelView from '../hotel/ui/HotelView.jsx';
import NpcCard from '../hotel/ui/NpcCard.jsx';
import { NpcTradeOffer, NpcTradePanel } from '../hotel/ui/NpcTrade.jsx';
import Newsstand from '../hotel/ui/Newsstand.jsx';
import HotelPackOpening from '../hotel/ui/HotelPackOpening.jsx';
import Minigame from '../hotel/ui/Minigame.jsx';
import { PACKS } from '../data/packs.js';
import { footprintOf, nextRotation } from '../hotel/sprites/furni.js';
import { DEFAULT_LOOK, RIDES, formatLook, parseLook } from '../hotel/sprites/avatar.js';
import { RIDE_WALLS } from '../hotel/sprites/vehicles.js';
import { authApi } from '../services/authApi.js';
import { QUEUE_TRACK, RADIO_TRACK, TRACKS, getJukebox } from '../hotel/music.js';
import { isLiteDevice } from '../utils/perfMode.js';
import '../hotel/hotel.css';

/** L'Arena: solo qui si gioca contro gli NPC sfidanti. */
const ARENA_ID = '00000000-0000-0000-0000-00000000a002';

/** Cosa si fa con l'oggetto in mano: il verbo del pulsante e la sua icona. */
const CONSUME = {
  pizza: ['Mangia', 'ph-pizza'], gelato: ['Mangia', 'ph-ice-cream'], book: ['Leggi', 'ph-book-open'],
  popcorn: ['Mangia', 'ph-popcorn'], water: ['Bevi', 'ph-drop']
};

/** Mobili che si usano cliccandoli: bibite, cibo, jukebox. */
const USABLE = ['bar_counter', 'cafe_counter', 'coffee_machine', 'icecream_cart', 'pizza_oven', 'jukebox',
  'beach_bar', 'popcorn_machine', 'water_cooler',
  // Minigiochi: panca, tapis roulant, sacco da boxe, pesca-peluche, cabinato arcade, biliardo,
  // canestri dello stadio, piste da bowling e buche del minigolf.
  'weight_bench', 'treadmill', 'punching_bag', 'claw_machine', 'arcade', 'pool_table',
  'basket_hoop', 'bowling_lane', ...[1, 2, 3, 4, 5, 6].map((hole) => `golf_hole_${hole}`),
  // Curl con i manubri della rastrelliera e i biliardi grandi.
  'dumbbell_rack', 'billiard_table',
  // Palco del karaoke, paletti da pesca e go-kart.
  'karaoke_stage', 'fishing_post', 'go_kart',
  // Ping pong e freccette in sala giochi.
  'ping_pong_table', 'dart_board',
  // Pedana della gara di ballo della Disco anni 80, bersaglio dei tiri al palaghiaccio, bancone della caffetteria.
  'dance_contest', 'hockey_target', 'espresso_bar',
  // Pedane della gara rock e della gara di batteria del Locale Rock.
  'guitar_duel', 'drum_duel',
  // Semaforo della gara in citta' nel quartiere.
  'race_start'];

/** Colore dell'auto nella gara in citta' (le auto 5-9 dei negozi), rossa del noleggio per chi non ne ha. */
const CAR_COLORS = { 5: '#d91a1a', 6: '#f5c518', 7: '#f4f4f5', 8: '#18181b', 9: '#2563eb' };

/** Il chiosco e l'espositore dell'edicola aprono il banco dei pacchetti. */
const NEWSSTAND_ITEMS = ['newsstand', 'pack_display'];

/** Nome del lotto all'asta: la carta, o il pezzo di lusso numerato. */
function lotName(lot) {
  if (lot?.luxury) return `${lot.luxury.brand} ${lot.luxury.name} (edizione limitata #${lot.luxury.serial})`;
  return lot?.card?.name || 'un lotto';
}

/** Quartiere: le facciate portano dentro ai negozi e alle arene (id delle stanze pubbliche). */
const DISTRICT_ID = '00000000-0000-0000-0000-00000000a015';
const DISTRICT_DOORS = {
  facade_atelier: '00000000-0000-0000-0000-00000000a016',
  facade_watches: '00000000-0000-0000-0000-00000000a017',
  facade_skate: '00000000-0000-0000-0000-00000000a018',
  facade_bikes: '00000000-0000-0000-0000-00000000a019',
  facade_cars: '00000000-0000-0000-0000-00000000a01a',
  facade_cafe: '00000000-0000-0000-0000-00000000a01b',
  arena_hockey: '00000000-0000-0000-0000-00000000a01c',
  arena_basket: '00000000-0000-0000-0000-00000000a01d',
  facade_rock: '00000000-0000-0000-0000-00000000a01e',
  facade_guitars: '00000000-0000-0000-0000-00000000a01f'
};
/** Stanze che si affacciano sul quartiere: da li' un pulsante riporta in strada. */
const DISTRICT_ROOMS = new Set(Object.values(DISTRICT_DOORS));

/** Banconi dei negozi del quartiere: aprono il negozio (capi, orologi, skate, bici, auto). */
const LUXURY_COUNTERS = {
  atelier_counter: 'atelier', watch_counter: 'orologi', skate_counter: 'skate', bike_counter: 'bici', car_counter: 'auto',
  guitar_counter: 'chitarre', rock_counter: 'rock'
};

/** Schermo intero vero dove il browser lo permette; altrimenti (iPhone) la pagina copre tutto. */
const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

/** I brani dopo quello in onda: prima la coda del jukebox, poi la radio accesa. */
function upcomingSongs(jukebox) {
  return [...(jukebox?.queue || []), ...(jukebox?.station?.next || [])];
}

const ERRORS = {
  jukebox_queue_full: 'La coda del jukebox e\' piena: aspetta che finisca qualche canzone.',
  jukebox_queue_mine: 'Hai gia\' 5 canzoni in coda: lascia spazio anche agli altri!',
  jukebox_bad_song: 'Questa canzone non si puo\' mettere in coda.',
  jukebox_not_yours: 'Puoi togliere o saltare solo le canzoni che hai scelto tu.',
  radio_admin_only: 'La musica della Disco anni 80 la sceglie la regia: puoi solo silenziarla per te.',
  quiz_running: 'C\'e\' gia\' un quiz in corso: scrivi la risposta in chat!',
  quiz_cooldown: 'Un attimo: il prossimo quiz parte fra qualche secondo.',
  show_card_cooldown: 'Aspetta qualche secondo prima di mostrare un\'altra carta.',
  room_full: 'La stanza e\' piena. Riprova tra poco.',
  room_closed: 'La porta di questa stanza e\' chiusa.',
  room_not_found: 'Questa stanza non esiste piu\'.',
  chat_muted: 'Stai scrivendo troppo in fretta: aspetta 30 secondi.',
  user_not_here: 'Quella persona non e\' in questa stanza.',
  npc_not_found: 'Quel personaggio non e\' piu\' qui.',
  npc_no_respect: 'Il rispetto si da\' ai giocatori, non al personale dell\'hotel.',
  npc_no_challenge: 'Con gli NPC si gioca solo in Arena, contro gli sfidanti.',
  npc_no_trade: 'Questo personaggio non scambia carte.',
  npc_trade_unfair: 'Scambio rifiutato: offri una carta di valore piu\' alto.',
  npc_trade_limit: 'Per oggi hai gia\' fatto tutti gli scambi con gli NPC.',
  npc_trade_not_offered: 'Quella carta non e\' piu\' nella sua vetrina.',
  npc_trade_expired: 'L\'offerta di scambio e\' scaduta.',
  nothing_in_hand: 'Non hai niente in mano.',
  not_your_room: 'Puoi arredare solo la tua stanza.',
  not_your_item: 'Questo mobile non e\' tuo.',
  card_not_owned: 'Non possiedi quella carta, o non ne hai abbastanza copie (serve una copia per ogni vetrina).',
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
  not_at_newsstand: 'I pacchetti si comprano in Edicola.',
  item_busy: 'C\'e\' gia\' qualcuno che lo sta usando: aspetta il tuo turno.',
  minigame_too_fast: 'Partita troppo breve: il punteggio non vale.',
  chat_muted_admin: 'Un moderatore ti ha silenziato per un po’: non puoi scrivere in chat.',
  minigame_not_running: 'La partita e\' gia\' finita.',
  pack_not_found: 'Questo pacchetto non e\' piu\' in vendita.',
  pack_not_for_sale: 'Questo pacchetto non si compra: arriva solo in regalo.',
  insufficient_gold: 'Non hai abbastanza gold.',
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
  const navigate = useNavigate();
  const { gold, refreshCollection, freePacks, openPack, refreshPacks } = useGame();
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
  const [selectedNpc, setSelectedNpc] = useState(null);
  const [npcOffer, setNpcOffer] = useState(null);
  const [tradingNpc, setTradingNpc] = useState(null);
  const [npcShowcase, setNpcShowcase] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [pickingCardFor, setPickingCardFor] = useState(null);
  const [viewingCard, setViewingCard] = useState(null);
  // Quiz "Indovina la carta" in corso nella stanza e il suo esito; carta da mostrare sopra la testa.
  const [quiz, setQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [showingCard, setShowingCard] = useState(false);
  // Scelta di una carta chiesta da un pannello (per esempio le carte sopra la testa): { title, resolve }.
  const [cardPick, setCardPick] = useState(null);
  // Regalo a un amico dalla sua scheda: apre la posta con il destinatario gia' scelto.
  const [giftTo, setGiftTo] = useState('');
  /** Tutorial della prima visita: si chiede al server se e' gia' stato visto. */
  const [tutorial, setTutorial] = useState(false);
  /** Amici: messaggi e richieste non ancora visti, ultimo messaggio privato arrivato. */
  const [friendsUnread, setFriendsUnread] = useState(0);
  const [lastDm, setLastDm] = useState(null);
  const [friendsVersion, setFriendsVersion] = useState(0);
  /** Eventi a orario in corso (per la striscia in alto) e contatore per ricaricare la classifica. */
  const [liveEvents, setLiveEvents] = useState([]);
  const [eventsVersion, setEventsVersion] = useState(0);
  const [auctionVersion, setAuctionVersion] = useState(0);
  /** Posta: pacchi non ancora ritirati e contatore per ricaricare la casella. */
  const [mailUnread, setMailUnread] = useState(0);
  const [mailVersion, setMailVersion] = useState(0);
  /** Tornei e stagione: contatore per ricaricare le schede quando il server avvisa. */
  const [sportVersion, setSportVersion] = useState(0);
  /** Banchetto aperto (id del mobile) e foto appena scattata. */
  const [stallItem, setStallItem] = useState(null);
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let cancelled = false;
    hotelApi.mail().then((res) => { if (!cancelled) setMailUnread(res.unread); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  /**
   * Go-kart: avversari in pista (ultima posizione, velocita' e nome), letti dal minigioco a ogni
   * fotogramma tramite un getter, senza ridisegnare la pagina.
   */
  const kartRivalsRef = useRef(new Map());
  const kartExtra = useMemo(() => ({
    get kartRivals() {
      const now = performance.now();
      return [...kartRivalsRef.current.values()]
        .filter((r) => now - r.at < 4000)
        .map((r) => ({ name: r.name, lap: r.lap, u: (r.u + r.v * Math.min(0.6, (now - r.at) / 1000)) % 1 }));
    }
  }), []);
  useEffect(() => {
    let cancelled = false;
    const load = () => hotelApi.events().then((res) => { if (!cancelled) setLiveEvents(res.current); }).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [eventsVersion]);
  useEffect(() => {
    let cancelled = false;
    hotelApi.tutorial().then((res) => { if (!cancelled && !res.done) setTutorial(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [placement, setPlacement] = useState(null);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [whisperTo, setWhisperTo] = useState(null);
  const [notice, setNotice] = useState(null);
  const [zoom, setZoom] = useState(() => (window.innerWidth < 600 ? 0.5 : 1));
  const [jukebox, setJukebox] = useState({ track: -1 });
  // Radio della Disco silenziata solo per me: il brano continua a tempo con gli altri.
  const [radioMuted, setRadioMuted] = useState(() => getJukebox().radioMuted);
  const [likes, setLikes] = useState(null);
  const [respectVersion, setRespectVersion] = useState(0);
  const [pvp, setPvp] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [buyingPack, setBuyingPack] = useState(null);
  const [inventoryTab, setInventoryTab] = useState('furni');
  const [packOpening, setPackOpening] = useState(null);
  const [openingBusy, setOpeningBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [minigame, setMinigame] = useState(null);
  const [luxuryShop, setLuxuryShop] = useState('atelier');
  const [casinoGame, setCasinoGame] = useState('cashier');
  // Veicoli comprati (per il pulsante Sali/Scendi): si rileggono chiudendo un pannello.
  const [ownedRides, setOwnedRides] = useState([]);
  const [rideBusy, setRideBusy] = useState(false);
  const [travelMode, setTravelMode] = useState('bus');
  const [travel, setTravel] = useState(null);
  const [minigameResult, setMinigameResult] = useState(null);
  // Minigioco aperto: la stanza dietro scende a 20 fotogrammi al secondo, il gioco resta fluido.
  // Su telefoni e dispositivi leggeri la stanza va a 30: il movimento resta fluido, la batteria dura il doppio.
  useEffect(() => {
    canvasRef.current?.setMaxFps(minigame ? 20 : (isLiteDevice() ? 30 : null));
  }, [minigame]);
  /** Punteggio della partita nello stadio: { blue, red }, null nelle stanze senza pallone. */
  const [football, setFootball] = useState(null);
  /** Partita a squadre dello stadio: squadre, fase e fine (ora del server). */
  const [match, setMatch] = useState(null);
  /** Stagione e tempo di oggi (HotelWeather): uguali in tutto l'hotel. */
  const [weather, setWeather] = useState(null);
  const pageRef = useRef(null);
  // I pannelli si spostano trascinandoli per la testata.
  useDraggablePanels(pageRef);
  // Tastiera: Esc chiude il pannello aperto; il pannello appena aperto prende il focus, cosi' chi
  // usa la tastiera o un lettore di schermo ci arriva subito.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      setPanel((current) => (current ? null : current));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!panel) return undefined;
    const frame = requestAnimationFrame(() => {
      const dialog = pageRef.current?.querySelector('.hotel-panel[role="dialog"], .hotel-panel');
      if (!dialog) return;
      if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
      dialog.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [panel]);
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
        // Cambiando stanza le sfide in arrivo o in attesa decadono (il server le ha gia' annullate).
        setPvp((p) => (p && (p.stage === 'incoming' || p.stage === 'sent') ? null : p));
        setRoom(message.room);
        setPeople(Object.fromEntries(message.users.map((u) => [u.id, u])));
        setItems(Object.fromEntries((message.items || []).map((i) => [i.id, i])));
        setJukebox({ track: message.jukebox?.track ?? -1, radio: message.jukebox?.radio || null, queue: message.jukebox?.queue || null, station: message.jukebox?.station || null, booth: !!message.jukebox?.booth });
        setFootball(message.ball ? { blue: message.ball.blue, red: message.ball.red } : null);
        setMatch(message.match || null);
        setQuiz(message.quiz || null);
        setQuizResult(null);
        if (message.weather) setWeather(message.weather);
        getJukebox().set(message.jukebox?.track ?? -1, message.jukebox?.startedAt ?? 0, message.serverTime, message.jukebox?.radio, upcomingSongs(message.jukebox));
        setPanel((current) => (current === 'trades' ? current : null));
        setSelected(null);
        setSelectedNpc(null);
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
      case 'casino_win': {
        const what = message.currency === 'gold' ? 'gold' : 'fiches';
        showNotice(`${message.by} ha vinto ${new Intl.NumberFormat('it-IT').format(message.amount)} ${what} a ${message.game}!`);
        break;
      }
      case 'jukebox':
        setJukebox({ track: message.track, radio: message.radio || null, queue: message.queue || null, station: message.station || null, booth: !!message.booth });
        getJukebox().set(message.track, message.startedAt, message.serverTime, message.radio, upcomingSongs(message));
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
      // ---- oggetti in mano e scambi con gli NPC
      case 'hand_item':
        setPeople((p) => (p[message.id] ? { ...p, [message.id]: { ...p[message.id], handItem: message.item, handLeft: message.left } } : p));
        break;
      case 'consume':
        setPeople((p) => (p[message.id] ? { ...p, [message.id]: { ...p[message.id], handLeft: message.left } } : p));
        break;
      case 'npc_trade_offer':
        setNpcOffer(message);
        sound.coin();
        break;
      case 'npc_trade_expired':
        setNpcOffer((o) => (o?.offerId === message.offerId ? null : o));
        break;
      case 'npc_showcase':
        setNpcShowcase(message);
        break;
      case 'npc_trade_done':
        setTradingNpc(null);
        showNotice('Scambio fatto! Trovi la carta nuova nella tua collezione.');
        sound.coin();
        refreshCollection();
        break;
      case 'challenge_received':
        setPvp({ stage: 'incoming', challengeId: message.challengeId, from: message.from,
          expiresAt: Date.now() + (message.expiresIn || 20_000) });
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
        setPvp((p) => (p && (p.stage === 'incoming' || p.stage === 'sent')
          && (!p.challengeId || p.challengeId === message.challengeId) ? null : p));
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
          deadline: message.deadline || null, team: message.team, synergies: message.synergies, used: message.used, boostUsed: message.boostUsed,
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
      case 'minigame_start':
        setMinigame({ ...message, key: Date.now() });
        setMinigameResult(null);
        setPanel(null);
        break;
      case 'minigame':
        // Il server ha chiuso la partita (ci si e' mossi, o e' scaduta): il pannello si chiude,
        // a meno che non stia gia' mostrando il risultato.
        if (message.id === meRef.current?.id && !message.game) {
          setMinigame((m) => (m && !m.finished ? null : m));
        }
        break;
      case 'minigame_reward':
        setMinigameResult((r) => ({ ...r, reward: message }));
        if (message.gold > 0) {
          sound.coin();
          showNotice(`Record premiato: +${message.gold} gold! Premi rimasti oggi: ${message.left}.`);
          refreshUser();
        }
        break;
      case 'rock_duel':
        showNotice(`Sfida ${message.game === 'drums' ? 'di batteria' : 'rock'}: ${message.winner} batte ${message.loser} ${message.winnerScore} a ${message.loserScore}!`);
        break;
      case 'minigame_score': {
        if (message.id === meRef.current?.id) setMinigameResult(message);
        if (message.record) {
          showNotice(`${message.username}: ${message.score} ${message.unit} a ${message.title}, nuovo record della stanza!`);
          if (message.id === meRef.current?.id) sound.coin();
        }
        break;
      }
      case 'ball':
        setFootball({ blue: message.blue, red: message.red });
        break;
      case 'weather':
        setWeather(message);
        break;
      case 'dm':
        setLastDm(message);
        setFriendsUnread((n) => n + 1);
        showNotice(`Messaggio da ${message.fromName}: ${message.text}`);
        break;
      case 'hotel_event':
        if (message.phase === 'start') {
          showNotice(`E' iniziato l'evento "${message.title}" (${message.room})! Apri la Piazza per la classifica.`);
          setEventsVersion((v) => v + 1);
        } else if (message.phase === 'end') {
          const podium = message.winners.map((w, i) => `${i + 1}. ${w.username}`).join(', ');
          showNotice(`Fine di "${message.title}": ${podium}`);
          setEventsVersion((v) => v + 1);
        } else {
          setEventsVersion((v) => v + 1);
        }
        break;
      case 'auction':
        setAuctionVersion((v) => v + 1);
        if (message.phase === 'lot') showNotice(`All'asta: ${lotName(message.lot)}! Apri la Piazza per offrire.`);
        else if (message.phase === 'outbid') {
          showNotice(`${message.by} ha rilanciato a ${message.amount} gold: i tuoi gold sono tornati.`);
          refreshUser();
        } else if (message.phase === 'sold') {
          if (message.lot.bidderId === meRef.current?.id) {
            // Le carte vinte vanno subito nella collezione (i gold erano gia' stati scalati all'offerta).
            showNotice(message.lot.luxury ? `Hai vinto l'asta! ${lotName(message.lot)} e' nel tuo guardaroba.` : `Hai vinto l'asta! ${message.lot.card?.name} è già nella tua collezione.`);
            sound.success();
            refreshCollection();
          } else {
            showNotice(`Aggiudicata! ${lotName(message.lot)} va a ${message.lot.bidderName} per ${message.lot.currentBid} gold.`);
          }
        }
        break;
      case 'fish_card':
        sound.success();
        setViewingCard(message.card);
        refreshCollection();
        showNotice(`Pesce raro! Dentro c'era una carta: ${message.card?.name}. Oggi ne puoi pescare ancora ${message.left}.`);
        break;
      case 'fish_catch':
        if (message.byId !== meRef.current?.id) showNotice(`${message.by} ha pescato una carta: ${message.card?.name}!`);
        break;
      case 'announcement':
        showNotice(`Annuncio: ${message.text}`);
        break;
      case 'moderation':
        showNotice(message.muted ? `Un moderatore ti ha silenziato per ${message.minutes} minuti.` : 'Puoi di nuovo scrivere in chat.');
        break;
      case 'tournament':
        setSportVersion((v) => v + 1);
        if (message.phase === 'start') showNotice(`${message.title}: si parte! Guarda il tabellone nella Piazza.`);
        else if (message.phase === 'round') showNotice(`${message.title}: nuovo turno sul tabellone.`);
        else if (message.phase === 'end') showNotice(`${message.title}: vince ${message.winner}!`);
        else if (message.phase === 'score') showNotice(`${message.title}: il tuo punteggio (${message.score}) vale per il torneo.`);
        break;
      case 'season':
        if (message.phase === 'end') showNotice(`Stagione ${message.season} finita: vince ${message.winners[0]?.username}!`);
        setSportVersion((v) => v + 1);
        break;
      case 'mail':
        setMailUnread((n) => n + 1);
        setMailVersion((v) => v + 1);
        showNotice(`${message.from} ti ha spedito un regalo: guarda la posta negli Amici!`);
        break;
      case 'party':
        if (message.phase === 'start') showNotice(`Festa! "${message.title}" da ${message.host}: la trovi in cima al navigatore.`);
        break;
      case 'party_xp':
        showNotice(`Festa: +${message.xp} XP`);
        refreshUser();
        break;
      case 'stall_sold':
        showNotice(`Al tuo banchetto ${message.buyer} ha comprato ${message.card} per ${message.gold} gold!`);
        refreshUser();
        break;
      case 'game_fx':
        if (message.game === 'kart' && message.fx?.kind === 'kart' && message.id !== meRef.current?.id) {
          kartRivalsRef.current.set(message.id, {
            name: peopleRef.current[message.id]?.username || 'Pilota',
            u: message.fx.u || 0, v: (message.fx.v || 0) / 100, lap: message.fx.x || 0, at: performance.now()
          });
        }
        break;
      case 'kart_race':
        kartRivalsRef.current.clear();
        if (message.racers.length > 1 && message.racers.some((r) => r.id === meRef.current?.id)) {
          showNotice(`Gara di go-kart: ${message.racers.map((r) => r.name).join(', ')} in griglia!`);
        }
        break;
      case 'kart_race_end': {
        const podium = message.ranking.filter((r) => r.score > 0).slice(0, 3).map((r, i) => `${i + 1}. ${r.name}`).join('  ');
        showNotice(`Traguardo! ${podium || 'Nessuno ha finito la gara.'}`);
        if (message.ranking[0]?.id === meRef.current?.id) sound.success();
        break;
      }
      case 'quiz_start':
        setQuizResult(null);
        setQuiz(message);
        break;
      case 'quiz_end':
        setQuiz(null);
        setQuizResult(message);
        if (message.winnerId && message.winnerId === meRef.current?.id) sound.success();
        break;
      case 'match':
        setMatch(message);
        if (message.notice) showNotice(message.notice);
        break;
      case 'match_end':
        sound.success();
        showNotice(message.winner
          ? `Fischio finale: vincono i ${message.label} ${message.blue}-${message.red}!`
          : `Fischio finale: pareggio ${message.blue}-${message.red}.`);
        break;
      case 'match_reward':
        showNotice(`${message.note}: +${message.gold} gold`);
        refreshUser();
        break;
      case 'gallery':
        if (message.phase === 'end') showNotice(`Mostra della settimana: vince ${message.winners[0]?.username}!`);
        break;
      case 'friend_event':
        setFriendsVersion((v) => v + 1);
        setFriendsUnread((n) => n + (message.kind === 'request' ? 1 : 0));
        showNotice(message.kind === 'request' ? `${message.from} vuole essere tuo amico!` : `${message.from} ha accettato la tua amicizia!`);
        break;
      case 'goal':
        setFootball({ blue: message.blue, red: message.red });
        sound.success();
        showNotice(message.winner
          ? `${message.by} segna il gol della vittoria: vincono i ${message.label} ${message.blue}-${message.red}!`
          : `Gol di ${message.by}! Blu ${message.blue} - ${message.red} Rossi`);
        break;
      case 'pack_bought':
        setBuyingPack(null);
        sound.coin();
        showNotice(`${message.name} nella borsa! Ne hai ${message.owned}.`);
        refreshUser();
        refreshPacks();
        break;
      case 'inventory_changed':
        setInventoryVersion((v) => v + 1);
        break;
      case 'kicked':
        setRoom(null);
        setPanel('navigator');
        showNotice('Il proprietario ti ha accompagnato fuori dalla stanza.');
        break;
      case 'error':
        setBuyingPack(null);
        // Un server che non conosce ancora "sync" (per esempio avviato prima dell'aggiornamento):
        // invece di un errore si rientra nella stanza in cui si era.
        if (message.code === 'unknown_command' && syncPending.current) {
          syncPending.current = false;
          if (hotelRoomRef.current) send({ type: 'join', roomId: hotelRoomRef.current });
          else setPanel((current) => current || 'navigator');
          break;
        }
        // Gli errori del tavolo del poker li mostra il tavolo stesso.
        if (message.code?.startsWith('poker_') && panel === 'casino') {
          pokerBus.error(message.code);
          break;
        }
        showNotice(ERRORS[message.code] || ERRORS.server_error);
        break;
      case 'poker_state':
        pokerBus.state(message.table);
        break;
      case 'poker_cashout':
        pokerBus.cashout(message.chips, message.reason);
        if (panel !== 'casino') showNotice(message.reason === 'busted' ? 'Hai finito le fiches al tavolo del poker.' : `Ti sei alzato dal poker con ${message.chips} fiches.`);
        refreshUser();
        break;
      default:
        break;
    }
  }, [showNotice, sound, refreshUser, refreshCollection, refreshPacks, send, panel]);

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
    // Arrivata mentre si era altrove: si mostra solo se non e' gia' scaduta.
    const expiresAt = challenge.receivedAt + (challenge.expiresIn || 20_000);
    if (Date.now() >= expiresAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stato ricevuto dal provider mentre la pagina era chiusa
    setPvp({ stage: 'incoming', challengeId: challenge.challengeId, from: challenge.from, expiresAt });
  }, [hotel]);

  const join = (roomId) => send({ type: 'join', roomId });
  const myLook = me?.look || user?.hotelLook || DEFAULT_LOOK;
  const myStatus = me ? people[me.id]?.status : null;
  const myHand = me ? people[me.id]?.handItem : null;
  const isOwner = !!(room && me && room.ownerId === me.id);
  const selectedItem = selectedItemId ? items[selectedItemId] : null;
  const bagPacks = PACKS.reduce((sum, pack) => sum + (freePacks[pack.id] || 0), 0);

  const toggleStatus = (value) => send({ type: 'status', status: myStatus === value ? 'idle' : value });

  useEffect(() => {
    if (!room?.id) return undefined;
    let cancelled = false;
    roomApi.likes(room.id).then((res) => { if (!cancelled) setLikes(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, [room?.id]);

  // Quartiere: le ville mostrano le stanze dei giocatori piu' frequentate (e piu' amate).
  useEffect(() => {
    if (room?.id !== DISTRICT_ID) return undefined;
    let cancelled = false;
    roomApi.navigator().then((res) => {
      if (!cancelled) canvasRef.current?.setVillas((res.userRooms || []).filter((r) => r.ownerName));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [room?.id]);

  useEffect(() => {
    if (panel) return undefined;
    let cancelled = false;
    hotelApi.wardrobe().then((res) => {
      if (!cancelled) setOwnedRides((res.owned || []).filter((k) => /^r\d+$/.test(k)).map((k) => Number(k.slice(1))));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [panel]);

  const currentRide = parseLook(myLook).r;

  /** Sali o scendi al volo: si torna sull'ultimo veicolo usato (o sul primo comprato). */
  async function toggleRide() {
    let next = 0;
    if (currentRide) {
      try { localStorage.setItem('vinyldex_last_ride', String(currentRide)); } catch { /* niente da ricordare */ }
    } else {
      let last = 0;
      try { last = Number(localStorage.getItem('vinyldex_last_ride')) || 0; } catch { /* nessun ricordo */ }
      next = ownedRides.includes(last) ? last : ownedRides[0];
    }
    setRideBusy(true);
    try {
      await authApi.updateLook(formatLook({ ...parseLook(myLook), r: next }));
      send({ type: 'refresh_profile' });
      refreshUser();
    } catch {
      showNotice('Non riesco a cambiare veicolo. Riprova.');
    } finally {
      setRideBusy(false);
    }
  }

  async function toggleLike() {
    try {
      setLikes(await roomApi.like(room.id));
    } catch {
      showNotice('Non e\' stato possibile mettere "mi piace".');
    }
  }

  const canUseJukebox = !!room && (room.isPublic || isOwner);
  const isAdmin = user?.role === 'ADMIN';
  // Chi gestisce la coda: in Disco la regia (admin), nelle stanze il proprietario.
  const jukeboxManager = jukebox.booth ? isAdmin : isOwner;
  // Brani messi in coda dall'app di Spotify (anche dal telefono): vanno nella coda del jukebox
  // della stanza, dove si puo' (stanze dei giocatori; in Disco solo la regia).
  const songQueueOpen = !!room && (!room.isPublic || (jukebox.booth && isAdmin));
  useEffect(() => (!songQueueOpen ? undefined : onSpotifyQueueAdd((song) => {
    send({ type: 'jukebox_add', track: { title: song.title, artist: song.artist, artwork: song.artwork, spotifyUri: song.spotifyUri, durationMs: song.durationMs } });
    showNotice(`Dal tuo Spotify: ${song.title} in coda nel jukebox.`);
  })), [songQueueOpen, send, showNotice]);

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
      if (event.key === 'r' || event.key === 'R') setPlacement((p) => ({ ...p, rot: nextRotation(catalogByType.get(p.type), p.rot) }));
      if (event.key === 'Escape') setPlacement(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placement, catalogByType]);

  /** Compra in edicola: la risposta (pack_bought o un errore) arriva dal server. */
  function buyPack(packId) {
    setBuyingPack(packId);
    send({ type: 'buy_pack', packId });
  }

  /** Apre un pacchetto della borsa con la stessa animazione della pagina Pacchetti. */
  async function openBagPack(packId) {
    if (openingBusy) return;
    setOpeningBusy(true);
    const res = await openPack(packId, 'gift');
    setOpeningBusy(false);
    if (res.error) {
      sound.error();
      showNotice(res.error === 'no_gift_available'
        ? 'Non hai piu\' pacchetti di questo tipo nella borsa.'
        : 'Non riesco ad aprire il pacchetto. Riprova.');
      return;
    }
    setPanel(null);
    setPackOpening({ id: Date.now(), packId, cards: res.cards });
  }

  /** Carta venduta al negozio o all'edicola: gold e collezione cambiano, e forse le carte in mostra. */
  function cardSold(sale, card, quantity) {
    sound.coin();
    showNotice(`${quantity > 1 ? `Vendute ${quantity} copie di` : 'Venduta'} ${card.name}: +${sale.earned} gold!`);
    refreshUser();
    refreshCollection();
    // Le carte sopra la testa possono cambiare: il server le rilegge.
    send({ type: 'refresh_profile' });
  }

  function openBag(tab) {
    setInventoryTab(tab);
    setPanel('inventory');
  }

  // Schermo intero come su Habbo: la stanza occupa tutto lo schermo, pannelli compresi.
  useEffect(() => {
    const onChange = () => setFullscreen(!!pageRef.current && document.fullscreenElement === pageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Senza l'API (iPhone) lo schermo intero e' solo una classe: Esc la toglie come farebbe il browser.
  useEffect(() => {
    if (!fullscreen || canFullscreen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  async function toggleFullscreen() {
    if (!canFullscreen) {
      setFullscreen((f) => !f);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await pageRef.current?.requestFullscreen();
    } catch {
      showNotice('Il browser non permette lo schermo intero.');
    }
  }

  function onItemClick(item, tile) {
    const def = catalogByType.get(item.type);
    // In modalita' arredo il proprietario seleziona il mobile per ruotarlo, spostarlo, raccoglierlo.
    if (isOwner && buildMode) {
      setSelected(null);
      setSelectedItemId(item.id);
      return;
    }
    // Casino: tavoli, slot e cassa aprono il gioco.
    if (CASINO_FURNI[item.type]) {
      setCasinoGame(CASINO_FURNI[item.type]);
      setPanel('casino');
      return;
    }
    // Nelle stanze dei giocatori jukebox e giradischi aprono la scelta delle canzoni vere.
    if ((item.type === 'jukebox' || item.type === 'turntable') && room && !room.isPublic) {
      setPanel('jukebox');
      return;
    }
    // Bancone: si riceve una bibita (camminandoci accanto se serve). Jukebox: cambia brano.
    if (USABLE.includes(item.type)) {
      send({ type: 'use_item', itemId: item.id });
      return;
    }
    if (NEWSSTAND_ITEMS.includes(item.type)) {
      setPanel('newsstand');
      return;
    }
    // Quartiere: si entra nei negozi e nelle arene cliccando la facciata, nelle ville dei giocatori
    // cliccando la villa.
    if (DISTRICT_DOORS[item.type]) {
      join(DISTRICT_DOORS[item.type]);
      return;
    }
    // Fermata dell'autobus e posteggio dei taxi: si viaggia verso una stanza pubblica.
    if (item.type === 'bus_stop' || item.type === 'taxi_stand') {
      setTravelMode(item.type === 'taxi_stand' ? 'taxi' : 'bus');
      setPanel('travel');
      return;
    }
    if (item.type === 'villa') {
      if (item.villa) join(item.villa.id);
      else showNotice('Questa villa e\' ancora in vendita: arreda la tua stanza e i giocatori la vedranno qui!');
      return;
    }
    if (LUXURY_COUNTERS[item.type]) {
      setLuxuryShop(LUXURY_COUNTERS[item.type]);
      setPanel('luxury');
      return;
    }
    if (item.type === 'card_stall') {
      setStallItem(item.id);
      setPanel('stall');
      return;
    }
    // Pista e tappeti si calpestano: fuori dalla modalita' arredo il clic vale come camminare li'.
    if (def?.walkable && tile) {
      send({ type: 'move', x: tile.x, y: tile.y });
      return;
    }
    // Sedie e divani: ci si va a sedere, anche nella propria stanza. Sul divano si va sul posto
    // cliccato; se e' preso, il server manda sull'altro.
    if (def?.sitDir >= 0) {
      const { fx, fy } = footprintOf(def, item.rot);
      const onItem = tile && tile.x >= item.x && tile.y >= item.y && tile.x < item.x + fx && tile.y < item.y + fy;
      send({ type: 'move', x: onItem ? tile.x : item.x, y: onItem ? tile.y : item.y });
      return;
    }
    // Vetrina, quadro o teca 3D nella propria stanza ancora vuoti: si sceglie subito la carta.
    if (isOwner && def?.cardDisplay && !item.card) {
      setPickingCardFor(item);
      return;
    }
    if (item.card) {
      setViewingCard(isOwner && def?.cardDisplay ? { ...item.card, displayItemId: item.id } : item.card);
      return;
    }
    // Fuori dalla modalita' arredo gli altri mobili non fanno nulla: si cammina li' accanto.
    if (tile) send({ type: 'move', x: tile.x, y: tile.y });
  }

  return (
    <section
      ref={pageRef}
      className={`hotel-page${fullscreen ? ' is-fullscreen' : ''}${fullscreen && !canFullscreen ? ' is-pseudo-fullscreen' : ''}`}
      onPointerDown={() => getJukebox().unlock()}
    >
      <div className="hotel-stage">
        <HotelCanvas
          ref={canvasRef}
          walkKeys={!minigame}
          zoom={zoom}
          onZoom={setZoom}
          catalog={catalog}
          placement={placement}
          buildMode={isOwner && buildMode}
          onTileClick={(tile) => send({ type: 'move', x: tile.x, y: tile.y })}
          onAvatarClick={(u) => { setSelectedItemId(null); if (u.npc) { setSelected(null); setSelectedNpc(u); } else { setSelectedNpc(null); setSelected(u); } }}
          onItemClick={onItemClick}
          onCardClick={(card) => setViewingCard(card)}
          onPlace={(tile, current) => {
            send({ type: 'place', itemId: current.itemId, x: tile.x, y: tile.y, rot: current.rot });
            setPlacement(null);
          }}
        />

        {!room && <HotelView />}

        {room && football && (
          <div className="hotel-scoreboard" title="Passa sul pallone per calciarlo: di corsa va lontano. Si vince a 5 gol.">
            <span className="hotel-scoreboard-team is-blue">Blu</span>
            <strong>{football.blue}</strong>
            <span className="hotel-scoreboard-sep">-</span>
            <strong>{football.red}</strong>
            <span className="hotel-scoreboard-team is-red">Rossi</span>
          </div>
        )}
        {room && football && <MatchBar match={match} me={me} clockOffset={clockOffset} send={send} />}
        {room && <EventBanner events={liveEvents} onOpen={() => setPanel('events')} />}
        {tutorial && room && (
          <HotelTutorial onDone={() => { setTutorial(false); hotelApi.tutorialDone().catch(() => {}); }} />
        )}

        {room && (
          <div className="hotel-room-info">
            <strong>{room.name}</strong>
            <span>
              {room.ownerName ? `Stanza di ${room.ownerName}` : 'Stanza pubblica'}
              {' · '}<span title="Giocatori"><i className="ph-fill ph-user" /> {Object.values(people).filter((p) => !p.npc).length}</span>
              {Object.values(people).some((p) => p.npc) && (
                <>{' · '}<span title="Personaggi dell'hotel (NPC)"><i className="ph-fill ph-robot" /> {Object.values(people).filter((p) => p.npc).length}</span></>
              )}
            </span>
            {weather && (
              <span className={`hotel-weather${isOutdoor(room) ? ' is-outdoor' : ''}`}
                title={`${weather.seasonLabel}${weather.holiday === 'christmas' ? ' · Natale' : weather.holiday === 'halloween' ? ' · Halloween' : ''} · vento ${weather.wind} km/h${isOutdoor(room) ? '' : ' · fuori'}`}>
                <i className={`ph-fill ${WEATHER_ICONS[weather.condition] || 'ph-cloud'}`} /> {weather.label} {weather.temperature}°C
              </span>
            )}
            <div className="hotel-room-info-actions">
              {DISTRICT_ROOMS.has(room.id) && (
                <button type="button" className="hotel-like" onClick={() => join(DISTRICT_ID)} title="Esci in strada">
                  <i className="ph-fill ph-road-horizon" /> Quartiere
                </button>
              )}
              {likes && (
                <button type="button" className={`hotel-like${likes.liked ? ' liked' : ''}`} onClick={toggleLike} disabled={isOwner}
                  title={isOwner ? 'I "mi piace" degli altri alla tua stanza' : 'Mi piace questa stanza'}>
                  <i className={likes.liked ? 'ph-fill ph-heart' : 'ph ph-heart'} /> {likes.likes}
                </button>
              )}
              {jukebox.track === RADIO_TRACK && jukebox.radio && (
                <span className="hotel-now-playing hotel-radio">
                  {jukebox.radio.artwork && <img src={jukebox.radio.artwork} alt="" />}
                  <span className="hotel-radio-text">
                    <strong>{jukebox.radio.title}</strong>
                    <small>{jukebox.radio.artist} · {jukebox.radio.role === 'singer' ? 'al microfono' : 'in consolle'} {jukebox.radio.dj} (omaggio a {jukebox.radio.tribute})</small>
                  </span>
                  {/* Le anteprime vengono da Apple Music: il link al brano e' obbligatorio. */}
                  <a href={jukebox.radio.url} target="_blank" rel="noopener noreferrer" className="hotel-radio-apple" title="Ascolta il brano intero su Apple Music">
                    <i className="ph-fill ph-apple-logo" /> Apple Music
                  </a>
                  <button type="button" onClick={() => {
                    getJukebox().setRadioMuted(!radioMuted);
                    setRadioMuted(!radioMuted);
                  }} title={radioMuted ? 'Riattiva la musica (solo per te)' : 'Silenzia la musica (solo per te)'}>
                    <i className={radioMuted ? 'ph-fill ph-speaker-slash' : 'ph-fill ph-speaker-high'} />
                  </button>
                  {/* Cambiarla o spegnerla vale per tutta la stanza: solo la regia (admin). */}
                  {user?.role === 'ADMIN' && (
                    <>
                      <button type="button" onClick={() => setPanel('jukebox')} title="Regia: metti le tue canzoni in tutte le discoteche"><i className="ph ph-queue" /></button>
                      <button type="button" onClick={() => send({ type: 'jukebox', on: true })} title="Brano successivo (per tutti)"><i className="ph-fill ph-skip-forward" /></button>
                      <button type="button" onClick={() => send({ type: 'jukebox', on: false })} title="Spegni la musica (per tutti)"><i className="ph-fill ph-stop" /></button>
                    </>
                  )}
                </span>
              )}
              {jukebox.track === QUEUE_TRACK && jukebox.radio && (
                <span className="hotel-now-playing hotel-radio">
                  {jukebox.radio.artwork && <img src={jukebox.radio.artwork} alt="" />}
                  <span className="hotel-radio-text">
                    <strong>{jukebox.radio.title}</strong>
                    <small>{jukebox.radio.artist} · {jukebox.booth ? `regia di ${jukebox.radio.addedBy}` : `scelta da ${jukebox.radio.addedBy}`}</small>
                  </span>
                  {jukebox.radio.spotifyUrl ? (
                    <a href={jukebox.radio.spotifyUrl} target="_blank" rel="noopener noreferrer" className="hotel-radio-apple hotel-radio-spotify" title="Apri il brano su Spotify">
                      <i className="ph-fill ph-spotify-logo" /> Spotify
                    </a>
                  ) : jukebox.radio.url && (
                    <a href={jukebox.radio.url} target="_blank" rel="noopener noreferrer" className="hotel-radio-apple" title="Ascolta il brano intero su Apple Music">
                      <i className="ph-fill ph-apple-logo" /> Apple Music
                    </a>
                  )}
                  {(!jukebox.booth || isAdmin) && (
                    <button type="button" onClick={() => setPanel('jukebox')} title="Jukebox: cerca e metti in coda"><i className="ph ph-queue" /></button>
                  )}
                  <button type="button" onClick={() => {
                    getJukebox().setRadioMuted(!radioMuted);
                    setRadioMuted(!radioMuted);
                  }} title={radioMuted ? 'Riattiva la musica (solo per te)' : 'Silenzia la musica (solo per te)'}>
                    <i className={radioMuted ? 'ph-fill ph-speaker-slash' : 'ph-fill ph-speaker-high'} />
                  </button>
                  {(jukeboxManager || (!jukebox.booth && jukebox.radio.addedById === me?.id)) && (
                    <button type="button" onClick={() => send({ type: 'jukebox_skip' })} title="Brano successivo"><i className="ph-fill ph-skip-forward" /></button>
                  )}
                  {jukeboxManager && (
                    <button type="button" onClick={() => send({ type: 'jukebox', on: false })} title="Spegni il jukebox"><i className="ph-fill ph-stop" /></button>
                  )}
                </span>
              )}
              {jukebox.track >= 0 && jukebox.track !== RADIO_TRACK && jukebox.track !== QUEUE_TRACK && (
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
        <div className="sr-only" aria-live="polite">{notice}</div>
        {notice && <div className="hotel-notice" role="status" aria-hidden="true">{notice}</div>}

        {placement && (
          <div className="hotel-placement-bar" role="status">
            <span><i className="ph-fill ph-hand-grabbing" /> {catalogByType.get(placement.type)?.name}: clicca una casella</span>
            {!catalogByType.get(placement.type)?.wall && (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setPlacement((p) => ({ ...p, rot: nextRotation(catalogByType.get(p.type), p.rot) }))}>
                <i className="ph-fill ph-arrow-clockwise" /> Ruota (R)
              </button>
            )}
            {catalogByType.get(placement.type)?.wall && (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setPlacement((p) => ({ ...p, rot: nextRotation(catalogByType.get(p.type), p.rot) }))}>
                <i className="ph-fill ph-swap" /> Cambia parete (R)
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setPlacement(null)}>Annulla</button>
          </div>
        )}

        {selectedNpc && (
          <NpcCard
            npc={people[selectedNpc.id] || selectedNpc}
            send={send}
            inArena={room?.id === ARENA_ID}
            onClose={() => setSelectedNpc(null)}
            onWhisper={() => { setWhisperTo(selectedNpc.username); setSelectedNpc(null); }}
            onChallenge={pvp ? null : () => { send({ type: 'challenge', userId: selectedNpc.id }); setSelectedNpc(null); }}
            onTrade={() => { setTradingNpc(selectedNpc); setSelectedNpc(null); }}
            onBuyPacks={() => { setPanel('newsstand'); setSelectedNpc(null); }}
          />
        )}

        {tradingNpc && (
          <NpcTradePanel npc={tradingNpc} showcase={npcShowcase} send={send} onClose={() => setTradingNpc(null)} />
        )}

        {npcOffer && <NpcTradeOffer key={npcOffer.offerId} offer={npcOffer} send={send} onClose={() => setNpcOffer(null)} />}

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
            onAddFriend={() => hotelApi.friendRequest(selected.username)
              .then(() => showNotice(`Richiesta di amicizia mandata a ${selected.username}!`))
              .catch((err) => showNotice(err?.code === 'already_friends' ? "Siete gia' amici." : err?.code === 'friend_already_requested' ? "Richiesta gia' mandata." : 'Richiesta non riuscita.'))}
            onViewCard={(card) => setViewingCard(card)}
            onGift={selected.id === me?.id ? null : () => { setGiftTo(selected.id); setPanel('friends'); setSelected(null); }}
            onWearBadge={selected.id === me?.id ? (code) => hotelApi.wearBadge(code).then((res) => {
              // Il server rilegge il profilo e aggiorna l'avatar per tutti nella stanza.
              send({ type: 'refresh_profile' });
              showNotice(res.wornBadge ? 'Distintivo in mostra accanto al nome!' : 'Distintivo tolto.');
              return res;
            }) : null}
            onChallenge={pvp ? null : () => { send({ type: 'challenge', userId: selected.id }); setSelected(null); }}
            onPickCard={selected.id === me?.id ? (title) => new Promise((resolve) => setCardPick({ title, resolve })) : null}
            onChooseTopCards={selected.id === me?.id ? (codes) => hotelApi.topCards(codes).then((res) => {
              // Come per il distintivo: il server rilegge le carte e le mostra a tutta la stanza.
              send({ type: 'refresh_profile' });
              showNotice(res.topCardsCustom ? 'Carte sopra la testa aggiornate!' : 'Carte sopra la testa scelte dal gioco.');
              return res;
            }) : null}
          />
        )}

        {(quiz || quizResult) && (
          <QuizOverlay quiz={quiz} result={quizResult} clockOffset={clockOffset} onClose={() => setQuizResult(null)} />
        )}
        {cardPick && (
          <CardPicker title={cardPick.title}
            onClose={() => { cardPick.resolve(null); setCardPick(null); }}
            onPick={(card) => { cardPick.resolve(card); setCardPick(null); }}
          />
        )}
        {showingCard && (
          <CardPicker title="Mostra una carta"
            onClose={() => setShowingCard(false)}
            onPick={(card) => { send({ type: 'show_card', cardId: card.id }); setShowingCard(false); }}
          />
        )}

        {pvp && <PvpPanel pvp={pvp} clockOffset={clockOffset} send={send} onClose={() => setPvp(null)} />}

        {minigame && (
          <Minigame
            onFx={(fx) => send({ type: 'minigame_fx', fx })}
            extra={minigame.game === 'rock' ? { guitar: parseLook(myLook).g }
              : minigame.game === 'street' ? { carColor: CAR_COLORS[parseLook(myLook).r] || '#e11d48' } : kartExtra}
            clockOffset={clockOffset}
            key={minigame.key}
            start={minigame}
            result={minigameResult}
            onPulse={() => canvasRef.current?.pulse()}
            onFinish={(score, meta) => {
              setMinigame((m) => (m ? { ...m, finished: true } : m));
              send({ type: 'minigame_result', score, ...(meta || {}) });
            }}
            onReplay={() => send({ type: 'use_item', itemId: minigame.itemId })}
            onClose={() => {
              if (!minigame.finished) send({ type: 'minigame_quit' });
              setMinigame(null);
            }}
          />
        )}

        {selectedItem && (
          <ItemMenu
            item={selectedItem}
            def={catalogByType.get(selectedItem.type)}
            isOwner={isOwner}
            onClose={() => setSelectedItemId(null)}
            onViewCard={() => setViewingCard(selectedItem.card)}
            onChooseCard={() => { setPickingCardFor(selectedItem); setSelectedItemId(null); }}
            onRotate={() => send({ type: 'place', itemId: selectedItem.id, x: selectedItem.x, y: selectedItem.y, rot: nextRotation(catalogByType.get(selectedItem.type), selectedItem.rot) })}
            onMove={() => { setPlacement({ itemId: selectedItem.id, type: selectedItem.type, rot: selectedItem.rot }); setSelectedItemId(null); }}
            onPickup={() => { send({ type: 'pickup', itemId: selectedItem.id }); setSelectedItemId(null); }}
            jukeboxOn={jukebox.track >= 0}
            onJukebox={(on) => send({ type: 'jukebox', on })}
            onSongs={room && !room.isPublic ? () => { setPanel('jukebox'); setSelectedItemId(null); } : null}
          />
        )}

        {pickingCardFor && (
          <CardPicker title={pickingCardFor.type === 'card_case' ? 'Carta per la Teca 3D' : 'Carta da esporre'}
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
            onCardSold={cardSold}
            onPetChange={(message) => { refreshUser(); if (message) showNotice(message); }}
          />
        )}
        {panel === 'inventory' && (
          <Inventory
            catalogByType={catalogByType}
            canPlace={isOwner}
            version={inventoryVersion}
            packs={freePacks}
            initialTab={inventoryTab}
            onClose={() => setPanel(null)}
            onPlace={(item) => { setPlacement({ itemId: item.id, type: item.type, rot: 0 }); setPanel(null); }}
            onOpenPack={openBagPack}
          />
        )}
        {panel === 'travel' && (
          <TravelPanel
            mode={travelMode}
            currentRoomId={room?.id}
            onClose={() => setPanel(null)}
            onGo={(target) => {
              setPanel(null);
              setTravel({ mode: travelMode, to: target.name });
              setTimeout(() => {
                join(target.id);
                setTravel(null);
              }, 1600);
            }}
          />
        )}
        {travel && <TravelOverlay mode={travel.mode} to={travel.to} />}
        {panel === 'casino' && (
          <CasinoPanel key={casinoGame} game={casinoGame} send={send} onClose={() => setPanel(null)} onGoldChange={() => refreshUser()} />
        )}
        {panel === 'jukebox' && (
          <JukeboxPanel jukebox={jukebox} meId={me?.id} isOwner={jukeboxManager} send={send} onClose={() => setPanel(null)} />
        )}
        {panel === 'luxury' && (
          <LuxuryShop
            shop={luxuryShop}
            look={myLook}
            gold={gold}
            onBought={(item) => {
              refreshUser();
              showNotice(`Hai comprato ${item.brand} ${item.name}!`);
            }}
            onWear={() => {
              send({ type: 'refresh_profile' });
              refreshUser();
            }}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'newsstand' && (
          <Newsstand
            gold={gold}
            owned={freePacks}
            buying={buyingPack}
            onBuy={buyPack}
            onOpenBag={() => openBag('packs')}
            onCardSold={cardSold}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'settings' && room && isOwner && <RoomSettings room={room} onClose={() => setPanel(null)} />}
        {panel === 'friends' && (
          <FriendsPanel me={me} incoming={lastDm} version={friendsVersion} onUnreadChange={setFriendsUnread}
            gold={gold} mailVersion={mailVersion} onMailUnread={setMailUnread} onMailChanged={refreshUser}
            key={giftTo || 'friends'} initialTab={giftTo ? 'mail' : 'friends'} mailTo={giftTo}
            onJoin={(roomId) => { join(roomId); setPanel(null); }} onClose={() => setPanel(null)} />
        )}
        {panel === 'clubs' && (
          <ClubPanel gold={gold} onClose={() => setPanel(null)} onJoinRoom={(roomId) => { join(roomId); setPanel(null); }}
            onChanged={refreshUser} />
        )}
        {panel === 'stall' && stallItem && (
          <StallPanel itemId={stallItem} me={me} gold={gold} onClose={() => setPanel(null)}
            onBought={() => { refreshUser(); refreshCollection(); }} onViewCard={setViewingCard} />
        )}
        {photo && <PhotoModal image={photo} roomName={room?.name} onClose={() => setPhoto(null)} />}
        {panel === 'events' && (
          <EventsPanel me={me} version={eventsVersion} onClose={() => setPanel(null)}
            tabs={[
              { key: 'quests', label: 'Incarichi', icon: 'ph-scroll', render: () => <QuestsTab onDone={() => { refreshUser(); refreshCollection(); }} onGoToRoom={(roomId) => { join(roomId); setPanel(null); }} /> },
              { key: 'auction', label: 'Asta', icon: 'ph-gavel', render: () => <AuctionTab me={me} gold={gold} live={auctionVersion} onChange={refreshUser} onViewCard={setViewingCard} /> },
              { key: 'gallery', label: 'Mostra', icon: 'ph-frame-corners', render: () => <GalleryTab me={me} onViewCard={setViewingCard} /> },
              { key: 'tournament', label: 'Tornei', icon: 'ph-tree-structure', render: () => <TournamentTab me={me} version={sportVersion} /> },
              { key: 'season', label: 'Stagione', icon: 'ph-medal', render: () => <SeasonTab me={me} version={sportVersion} /> }
            ]} />
        )}
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

      {viewingCard && (
        <CardViewer card={viewingCard} onClose={() => setViewingCard(null)}
          onChange={viewingCard.displayItemId && items[viewingCard.displayItemId]
            ? () => { setPickingCardFor(items[viewingCard.displayItemId]); setViewingCard(null); } : null} />
      )}


      {packOpening && (
        <HotelPackOpening
          opening={packOpening}
          left={freePacks[packOpening.packId] || 0}
          onAgain={() => openBagPack(packOpening.packId)}
          onClose={() => setPackOpening(null)}
          onSummary={() => send({ type: 'pack_opened' })}
        />
      )}

      <div className="hotel-toolbar">
        {/* Strumenti: in riga sotto la stanza, o in colonna a destra con il telefono in orizzontale. */}
        <div className="hotel-rail">
        {/* Telefono in orizzontale: l'hotel copre tutto lo schermo, qui si esce e si vedono i gold. */}
        <button type="button" className="hotel-tool hotel-tool-exit" onClick={() => navigate('/home')} title="Esci dall'hotel">
          <i className="ph-fill ph-house" />
        </button>
        <span className="hotel-gold-pill" title="I tuoi gold"><i className="ph-fill ph-coin" /> {new Intl.NumberFormat('it-IT').format(user?.gold ?? 0)}</span>
        <button type="button" className={`hotel-tool${panel === 'navigator' ? ' active' : ''}`} onClick={() => setPanel(panel === 'navigator' ? null : 'navigator')} title="Navigatore">
          <i className="ph-fill ph-compass" /><span>Stanze</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'shop' ? ' active' : ''}`} onClick={() => setPanel(panel === 'shop' ? null : 'shop')} title="Negozio">
          <i className="ph-fill ph-storefront" /><span>Negozio</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'inventory' ? ' active' : ''}`}
          onClick={() => (panel === 'inventory' ? setPanel(null) : openBag(bagPacks > 0 ? 'packs' : 'furni'))} title="Borsa: mobili e pacchetti">
          <i className="ph-fill ph-package" /><span>Borsa</span>
          {bagPacks > 0 && <b className="hotel-tool-badge">{bagPacks}</b>}
        </button>
        {ownedRides.length > 0 && RIDE_WALLS.has(room?.wallStyle) && (
          <button type="button" className={`hotel-tool${currentRide ? ' active' : ''}`} onClick={toggleRide} disabled={rideBusy}
            title={currentRide ? `Scendi da: ${RIDES[currentRide]}` : 'Sali sul tuo veicolo'}>
            <i className={`ph-fill ${currentRide ? 'ph-person-simple-walk' : 'ph-car-profile'}`} /><span>{currentRide ? 'Scendi' : 'Guida'}</span>
          </button>
        )}
        <button type="button" className={`hotel-tool${panel === 'wardrobe' ? ' active' : ''}`} onClick={() => setPanel(panel === 'wardrobe' ? null : 'wardrobe')} title="Guardaroba">
          <i className="ph-fill ph-t-shirt" /><span>Look</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'trades' ? ' active' : ''}`} onClick={() => setPanel(panel === 'trades' ? null : 'trades')} title="Scambi">
          <i className="ph-fill ph-arrows-left-right" /><span>Scambi</span>
          {pendingTrades > 0 && <b className="hotel-tool-badge">{pendingTrades}</b>}
        </button>
        <button type="button" className={`hotel-tool${panel === 'friends' ? ' active' : ''}`} onClick={() => { setGiftTo(''); setPanel(panel === 'friends' ? null : 'friends'); }} title="Amici">
          <i className="ph-fill ph-users-three" /><span>Amici</span>
          {friendsUnread + mailUnread > 0 && <b className="hotel-tool-badge">{friendsUnread + mailUnread}</b>}
        </button>
        <button type="button" className={`hotel-tool${panel === 'clubs' ? ' active' : ''}`} onClick={() => setPanel(panel === 'clubs' ? null : 'clubs')} title="Club">
          <i className="ph-fill ph-flag-banner" /><span>Club</span>
        </button>
        <button type="button" className="hotel-tool" disabled={!room}
          onClick={() => { const image = canvasRef.current?.snapshot(); if (image) setPhoto(image); else showNotice('Foto non riuscita.'); }} title="Scatta una foto della stanza">
          <i className="ph-fill ph-camera" /><span>Foto</span>
        </button>
        <button type="button" className={`hotel-tool${panel === 'events' ? ' active' : ''}`} onClick={() => setPanel(panel === 'events' ? null : 'events')} title="Piazza: eventi, asta e mostra">
          <i className="ph-fill ph-confetti" /><span>Piazza</span>
          {liveEvents.length > 0 && <b className="hotel-tool-badge">!</b>}
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


        <div className="hotel-emotes">
          {myHand && (
            <button type="button" className="hotel-tool hotel-tool-consume" onClick={() => send({ type: 'consume' })}
              title={`${(CONSUME[myHand] || ['Bevi'])[0]} (ne restano ${people[me.id]?.handLeft ?? 0})`}>
              <i className={`ph-fill ${(CONSUME[myHand] || ['Bevi', 'ph-coffee'])[1]}`} />
              <span>{(CONSUME[myHand] || ['Bevi'])[0]}</span>
            </button>
          )}
          <button type="button" className="hotel-tool" onClick={() => setShowingCard(true)} disabled={!room} title="Mostra una carta sopra la testa">
            <i className="ph-fill ph-cards" />
          </button>
          {room?.name === 'Arena' && (
            <button type="button" className={`hotel-tool${quiz ? ' active' : ''}`} onClick={() => send({ type: 'quiz_start' })} disabled={!!quiz}
              title="Quiz: indovina la carta">
              <i className="ph-fill ph-question" />
            </button>
          )}
          <button type="button" className="hotel-tool" onClick={() => send({ type: 'emote', emote: 'wave' })} disabled={!room} title="Saluta">
            <i className="ph-fill ph-hand-waving" />
          </button>
          <button type="button" className={`hotel-tool${myStatus === 'dance' ? ' active' : ''}`} onClick={() => toggleStatus('dance')} disabled={!room} title="Balla">
            <i className="ph-fill ph-music-notes" />
          </button>
          <button type="button" className={`hotel-tool${myStatus === 'sit' ? ' active' : ''}`} onClick={() => toggleStatus('sit')} disabled={!room} title="Siediti">
            <i className="ph-fill ph-armchair" />
          </button>
          <button type="button" className="hotel-tool" onClick={() => setZoom((z) => (z === 1 ? 0.5 : 1))} title="Zoom">
            <i className={`ph-fill ${zoom === 1 ? 'ph-magnifying-glass-minus' : 'ph-magnifying-glass-plus'}`} />
          </button>
          <button type="button" className={`hotel-tool${fullscreen ? ' active' : ''}`} onClick={toggleFullscreen}
            title={fullscreen ? 'Esci dallo schermo intero (Esc)' : 'Schermo intero'}>
            <i className={`ph-fill ${fullscreen ? 'ph-corners-in' : 'ph-corners-out'}`} />
          </button>
        </div>
        </div>

        <ChatBar send={send} whisperTo={whisperTo} onClearWhisper={() => setWhisperTo(null)} disabled={!online || !room} />
      </div>
    </section>
  );
}
