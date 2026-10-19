import { Capacitor } from '@capacitor/core';

/**
 * Client HTTP centralizzato verso il backend (/api). Normalizza gli errori.
 *
 * Sessione:
 * - sito: il JWT sta in un cookie HttpOnly che mette il server (JavaScript non lo vede, quindi
 *   uno script estraneo non lo puo' rubare). Qui si ricorda solo "c'e' una sessione", per non
 *   chiedere il profilo a chi non ha mai fatto l'accesso;
 * - app nativa (Capacitor): il cookie per lei sarebbe di terze parti e iOS lo blocca, quindi
 *   il token resta salvato qui e va come Bearer.
 * L'intestazione X-VinylDex-Client accompagna ogni richiesta: il server la pretende per le
 * modifiche fatte col cookie (protezione CSRF) e la usa per sapere se rimandare il token.
 */

export const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const NATIVE = Capacitor.isNativePlatform();
const TOKEN_KEY = 'vinyldex_token';
const SESSION_KEY = 'vinyldex_session';

// Prima versione col cookie: il token salvato dalle versioni vecchie del sito non serve piu'.
if (!NATIVE) {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage non disponibile: niente da pulire.
  }
}

/** Token da mandare come Bearer: solo nell'app nativa (sul sito e' nel cookie). */
export function getToken() {
  if (!NATIVE) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Salva il token dell'app nativa; con null chiude la sessione (anche sul sito). */
export function setToken(token) {
  try {
    if (NATIVE && token) localStorage.setItem(TOKEN_KEY, token);
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // localStorage non disponibile (modalità privata, ecc.): ignora silenziosamente
  }
}

/** Accesso riuscito sul sito: il cookie c'e', si ricorda solo che la sessione e' aperta. */
export function markSession() {
  if (NATIVE) return;
  try {
    localStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Senza localStorage al prossimo avvio si chiede il profilo lo stesso: va bene.
  }
}

/** C'e' (forse) una sessione aperta? Il server lo conferma col profilo. */
export function hasSession() {
  if (NATIVE) return Boolean(getToken());
  try {
    return localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return true;
  }
}

const DEVICE_KEY = 'vinyldex_device';

/**
 * Token del dispositivo fidato (verifica in due passaggi): resta anche dopo il logout, cosi' al
 * prossimo accesso da qui il codice a 6 cifre non serve.
 */
export function getDeviceToken() {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token) {
  try {
    if (token) localStorage.setItem(DEVICE_KEY, token);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Senza localStorage il codice verra' chiesto di nuovo: niente di grave.
  }
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    /** Codice d'errore del backend (es. "insufficient_gold"), se c'e'. */
    this.code = payload?.error ?? null;
  }
}

/**
 * Id della connessione all'hotel di questo dispositivo (dal messaggio "hello"): le giocate del
 * casino lo mandano nell'header X-Hotel-Session e il server le accetta solo dal dispositivo
 * collegato adesso, non da uno sostituito aprendo l'hotel altrove.
 */
let hotelSessionId = null;
export function setHotelSession(id) {
  hotelSessionId = id || null;
}

async function request(path, { method = 'GET', body, headers = {}, timeout = 10000 } = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();

  const finalHeaders = { Accept: 'application/json', 'X-VinylDex-Client': NATIVE ? 'native' : 'web', ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (hotelSessionId) finalHeaders['X-Hotel-Session'] = hotelSessionId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Il cookie di sessione va con le richieste allo stesso sito (mai ad altri).
      credentials: 'same-origin',
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError('Richiesta scaduta: il server non risponde.', 0, null);
    }
    throw new ApiError('Impossibile contattare il server.', 0, null);
  }
  clearTimeout(timer);

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(data?.message || data?.error || response.statusText, response.status, data);
  }
  return data;
}

export const apiClient = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, body, opts) => request(path, { ...opts, method: 'DELETE', body })
};
