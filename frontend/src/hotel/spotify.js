/**
 * Spotify per il jukebox delle stanze: chi ha Spotify Premium collega il suo account e sente le
 * canzoni della coda intere, a tempo con gli altri (Web Playback SDK). Gli altri sentono
 * l'anteprima di Apple Music dello stesso brano.
 *
 * Il login e' il flusso PKCE di Spotify: tutto nel browser, nessun segreto sul server. I token
 * restano nel localStorage di questo browser. Serve il Client ID di un'app creata su
 * developer.spotify.com (VITE_SPOTIFY_CLIENT_ID); l'app in "modalita' sviluppo" la usano solo
 * gli account Spotify aggiunti a mano dal proprietario (al massimo 5) e solo con Premium.
 */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
const TOKEN_KEY = 'vinyldex_spotify_token';
const VERIFIER_KEY = 'vinyldex_spotify_verifier';
const STATE_KEY = 'vinyldex_spotify_state';
const RETURN_KEY = 'vinyldex_spotify_return';
const API = 'https://api.spotify.com/v1';

/** Indirizzo a cui Spotify rimanda dopo il login: va registrato uguale nell'app di Spotify. */
export function redirectUri() {
  return import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;
}

export function spotifyConfigured() {
  return Boolean(CLIENT_ID);
}

function readToken() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Senza localStorage il collegamento dura finche' resta aperta la pagina.
  }
  memoryToken = token;
  listeners.forEach((fn) => fn());
}

let memoryToken = readToken();
const listeners = new Set();

export function spotifyConnected() {
  return Boolean(memoryToken?.refresh_token || memoryToken?.access_token);
}

export function onSpotifyChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64Url(bytes).slice(0, length);
}

/** Porta alla pagina di login di Spotify; al ritorno handleSpotifyCallback finisce il lavoro. */
export async function connectSpotify() {
  if (!CLIENT_ID) throw new Error('spotify_not_configured');
  const verifier = randomString(64);
  const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, window.location.hash || '#/hotel');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function tokenRequest(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body })
  });
  if (!res.ok) throw new Error('spotify_token');
  const data = await res.json();
  return { ...data, expires_at: Date.now() + (data.expires_in - 60) * 1000 };
}

/**
 * Ritorno dal login di Spotify (?code=...&state=...): scambia il codice con i token e torna
 * alla pagina da cui si era partiti. Da chiamare all'avvio dell'app, prima del router.
 */
export async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const expected = sessionStorage.getItem(STATE_KEY);
  if (!expected || !state || (!code && !params.get('error'))) return false;
  const back = sessionStorage.getItem(RETURN_KEY) || '#/hotel';
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  if (code && state === expected) {
    try {
      saveToken(await tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: sessionStorage.getItem(VERIFIER_KEY) || ''
      }));
    } catch {
      // Login non riuscito: si torna all'hotel come prima.
    }
  }
  sessionStorage.removeItem(VERIFIER_KEY);
  // Via ?code dall'indirizzo: si torna alla radice dell'app, sulla pagina di prima.
  const root = window.location.pathname.replace(/callback\/?$/, '');
  window.history.replaceState(null, '', `${root}${back}`);
  return true;
}

export function disconnectSpotify() {
  player?.disconnect();
  player = null;
  deviceId = null;
  saveToken(null);
}

/** Token valido, rinnovato se scaduto (null se non collegato o se Spotify lo rifiuta). */
async function accessToken() {
  const token = memoryToken;
  if (!token) return null;
  if (token.access_token && token.expires_at > Date.now()) return token.access_token;
  if (!token.refresh_token) return null;
  try {
    const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
    saveToken({ ...fresh, refresh_token: fresh.refresh_token || token.refresh_token });
    return fresh.access_token;
  } catch {
    saveToken(null);
    return null;
  }
}

async function api(path, options = {}) {
  const token = await accessToken();
  if (!token) throw new Error('spotify_not_connected');
  const res = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (res.status === 204) return null;
  if (!res.ok) {
    const error = new Error(`spotify_${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.status === 202 ? null : res.json().catch(() => null);
}

/** Cerca canzoni su Spotify (al massimo 10 risultati, limite di Spotify). */
function trackOf(t, album) {
  const images = (album || t.album)?.images || [];
  return {
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    artwork: images[1]?.url || images[0]?.url || null,
    spotifyUri: t.uri,
    durationMs: t.duration_ms,
    explicit: t.explicit
  };
}

const imageOf = (images) => images?.[1]?.url || images?.[0]?.url || null;

/**
 * Cerca su Spotify brani, album o artisti (al massimo 10 risultati per volta, limite di Spotify
 * per le app in modalita' sviluppo; `offset` per le pagine dopo).
 */
export async function searchSpotify(query, type = 'track', offset = 0) {
  const data = await api(`/search?${new URLSearchParams({ q: query, type, limit: '10', offset: String(offset) })}`);
  if (type === 'album') {
    return (data?.albums?.items || []).filter(Boolean).map((a) => ({
      id: a.id,
      title: a.name,
      artist: a.artists.map((x) => x.name).join(', '),
      artwork: imageOf(a.images),
      images: a.images,
      year: (a.release_date || '').slice(0, 4),
      total: a.total_tracks
    }));
  }
  if (type === 'artist') {
    return (data?.artists?.items || []).filter(Boolean).map((a) => ({ id: a.id, title: a.name, artwork: imageOf(a.images) }));
  }
  return (data?.tracks?.items || []).filter(Boolean).map((t) => trackOf(t));
}

/** I brani di un album, con la copertina dell'album. */
export async function albumTracks(album) {
  const data = await api(`/albums/${encodeURIComponent(album.id)}/tracks?limit=50`);
  return (data?.items || []).filter(Boolean).map((t) => trackOf(t, { images: album.images }));
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueByTitle(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    const key = t.title.toLowerCase().split(' (')[0].split(' - ')[0];
    return !seen.has(key) && seen.add(key);
  });
}

/**
 * Radio di un artista: Spotify non da' piu' alle app nuove i "brani piu' ascoltati" ne' i
 * consigli, quindi la radio si fa con i brani dei suoi album e singoli, mescolati.
 */
export async function artistAlbums(artist) {
  const data = await api(`/artists/${encodeURIComponent(artist.id)}/albums?${new URLSearchParams({ include_groups: 'album,single', limit: '10' })}`);
  return (data?.items || []).filter(Boolean).map((a) => ({
    id: a.id,
    title: a.name,
    artist: a.artists.map((x) => x.name).join(', '),
    artwork: imageOf(a.images),
    images: a.images,
    year: (a.release_date || '').slice(0, 4),
    total: a.total_tracks
  }));
}

export async function artistRadio(artist, size = 40) {
  const albums = (await artistAlbums(artist)).slice(0, 8);
  const lists = await Promise.all(albums.map((a) => albumTracks(a).catch(() => [])));
  return shuffle(uniqueByTitle(lists.flat())).slice(0, size);
}

/** Radio libera: i brani di una ricerca (un genere, un umore, un anno...), qualche pagina mescolata. */
export async function searchRadio(query, size = 40) {
  const pagesOf = (q) => Promise.all([0, 10, 20, 30, 40].map((offset) => searchSpotify(q, 'track', offset).catch(() => [])));
  // Prima come genere (genre:"dubstep"), se trova poco anche come ricerca libera.
  let tracks = uniqueByTitle((await pagesOf(`genre:"${query.replace(/"/g, '')}"`)).flat());
  if (tracks.length < 15) tracks = uniqueByTitle([...tracks, ...(await pagesOf(query)).flat()]);
  return shuffle(tracks).slice(0, size);
}

/** Il profilo collegato: serve a sapere se e' Premium (il player suona solo con Premium). */
export async function spotifyProfile() {
  return api('/me');
}

// ------------------------------------------------------------------ player

let sdkPromise = null;
let player = null;
let deviceId = null;
let playerPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      if (window.Spotify) {
        resolve();
        return;
      }
      window.onSpotifyWebPlaybackSDKReady = resolve;
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/** Il lettore di Spotify di questa pagina (un "dispositivo" in piu' sull'account), pronto a suonare. */
async function ensurePlayer() {
  if (deviceId && player) return player;
  if (!playerPromise) {
    playerPromise = (async () => {
      await loadSdk();
      const p = new window.Spotify.Player({
        name: 'VinylDex Hotel',
        getOAuthToken: (cb) => { accessToken().then((t) => t && cb(t)); },
        volume: 0.6
      });
      const ready = new Promise((resolve, reject) => {
        p.addListener('ready', ({ device_id: id }) => { deviceId = id; resolve(); });
        p.addListener('player_state_changed', onPlayerState);
        p.addListener('account_error', () => reject(new Error('spotify_premium_required')));
        p.addListener('authentication_error', () => reject(new Error('spotify_not_connected')));
        p.addListener('initialization_error', () => reject(new Error('spotify_unsupported')));
        setTimeout(() => reject(new Error('spotify_timeout')), 15_000);
      });
      await p.connect();
      await ready;
      player = p;
      return p;
    })().finally(() => { playerPromise = null; });
  }
  return playerPromise;
}

/** I brani che il lettore di Spotify ha in lista adesso (il primo e' quello in onda). */
let playing = [];

/**
 * Suona il brano in onda dal punto in cui e' arrivata la stanza, con dietro i brani in coda del
 * jukebox: cosi' nell'app di Spotify (anche sul telefono) si vedono come "in coda". Se il brano
 * e' gia' quello giusto si corregge solo il tempo; i brani aggiunti in fondo si mettono in coda
 * senza far ripartire quello in onda.
 */
export async function spotifyPlay(uris, positionMs, volume) {
  const p = await ensurePlayer();
  await p.setVolume(volume);
  const position = Math.max(0, Math.round(positionMs));
  const state = await p.getCurrentState();
  const onAir = state?.track_window?.current_track?.uri;
  if (state && onAir === uris[0] && playing[0] === uris[0]) {
    if (Math.abs(state.position - position) > 2500) await p.seek(position);
    if (state.paused) await p.resume();
    const sameStart = playing.slice(0, uris.length).join() === uris.join();
    const appended = uris.slice(0, playing.length).join() === playing.join() && uris.length > playing.length;
    if (sameStart && !appended) {
      // Coda accorciata (brani tolti in fondo) o uguale: niente da rifare.
      if (uris.length === playing.length) return;
    }
    if (appended) {
      for (const uri of uris.slice(playing.length)) {
        if (known.has(uri)) continue;
        known.add(uri);
        await api(`/me/player/queue?${new URLSearchParams({ uri, device_id: deviceId })}`, { method: 'POST' }).catch(() => {});
      }
      playing = uris;
      startPolling();
      return;
    }
    if (sameStart) {
      playing = uris;
      return;
    }
  }
  // Spotify passa da solo al brano dopo: se la stanza e' arrivata li', la lista e' gia' giusta.
  if (state && onAir === uris[0] && playing.indexOf(uris[0]) > 0) {
    const rest = playing.slice(playing.indexOf(uris[0]));
    if (rest.join() === uris.slice(0, rest.length).join()) {
      if (Math.abs(state.position - position) > 2500) await p.seek(position);
      playing = rest;
      if (uris.length > rest.length) {
        for (const uri of uris.slice(rest.length)) {
          await api(`/me/player/queue?${new URLSearchParams({ uri, device_id: deviceId })}`, { method: 'POST' }).catch(() => {});
        }
        playing = uris;
      }
      return;
    }
  }
  playing = uris;
  uris.forEach((uri) => known.add(uri));
  await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris, position_ms: position })
  });
  resetBaseline();
  startPolling();
}

// ------------------------------------------------- dal telefono al jukebox

/**
 * Brani scelti dall'app di Spotify (per esempio sul telefono, con "VinylDex Hotel" come
 * dispositivo): finiscono nella coda del jukebox della stanza, cosi' li vedono e li sentono tutti.
 * - "Aggiungi in coda" nell'app: l'hotel legge ogni pochi secondi la coda di Spotify e prende i
 *   brani nuovi (quelli che non c'erano quando la lista l'ha mandata l'hotel).
 * - Un brano fatto partire dall'app: va in coda nel jukebox e il lettore torna al brano della stanza.
 */
const queueListeners = new Set();
/** Brani della coda di Spotify gia' noti (messi dall'hotel, suggeriti da Spotify o gia' passati al jukebox). */
let known = new Set();
let baselineReady = false;
let pollTimer = 0;
let lastResync = 0;
let resyncHandler = null;

export function onSpotifyQueueAdd(fn) {
  queueListeners.add(fn);
  return () => queueListeners.delete(fn);
}

/** Chi rimette il lettore a tempo con la stanza (music.js) quando l'app ha cambiato brano. */
export function onSpotifyResync(fn) {
  resyncHandler = fn;
}

function report(track) {
  if (!track?.uri || known.has(track.uri)) return;
  known.add(track.uri);
  const song = trackOf(track);
  queueListeners.forEach((fn) => fn(song));
}

/** Dopo ogni lista mandata dall'hotel, la coda di Spotify del giro dopo fa da riferimento. */
function resetBaseline() {
  baselineReady = false;
}

async function pollQueue() {
  if (!playing.length || !deviceId) return;
  let data;
  try {
    data = await api('/me/player/queue');
  } catch {
    return;
  }
  const items = (data?.queue || []).filter((t) => t?.uri);
  if (!baselineReady) {
    // Quello che c'e' adesso (i brani dell'hotel e i suggerimenti di Spotify) non conta.
    items.forEach((t) => known.add(t.uri));
    baselineReady = true;
    return;
  }
  // I brani aggiunti a mano nell'app stanno in testa, fra (o prima di) quelli dell'hotel; dopo
  // l'ultimo brano dell'hotel ci sono solo i suggerimenti automatici di Spotify, che non contano.
  let last = -1;
  items.forEach((t, i) => { if (playing.includes(t.uri)) last = i; });
  const limit = last >= 0 ? last : Math.min(items.length, 3);
  items.slice(0, limit).filter((t) => !playing.includes(t.uri)).forEach(report);
}

function startPolling() {
  if (!pollTimer) pollTimer = setInterval(pollQueue, 5000);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = 0;
}

/** Il lettore e' passato a un brano che l'hotel non gli aveva chiesto: scelto dall'app. */
function onPlayerState(state) {
  const uri = state?.track_window?.current_track?.uri;
  if (!uri || !playing.length || playing.includes(uri)) return;
  // Spotify che passa da solo al brano dopo nella lista dell'hotel non e' una scelta.
  if (state.track_window?.previous_tracks?.some((t) => t.uri === playing[0]) && playing[1] === uri) return;
  report(state.track_window.current_track);
  const now = Date.now();
  if (resyncHandler && now - lastResync > 3000) {
    lastResync = now;
    playing = [];
    setTimeout(() => resyncHandler?.(), 500);
  }
}

export async function spotifyPause() {
  stopPolling();
  playing = [];
  if (player) await player.pause().catch(() => {});
}

export async function spotifyVolume(volume) {
  if (player) await player.setVolume(volume).catch(() => {});
}
