import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Il modulo decide al caricamento se gira nell'app nativa (Capacitor.isNativePlatform): per ogni
 * scenario si finge la piattaforma e se ne carica una copia nuova.
 */
async function loadClient({ native = false } = {}) {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
  return import('./apiClient.js');
}

/** Risposta finta di fetch con il corpo in JSON (o vuoto). */
function response(status, body, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body))
  };
}

let fetchMock;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('@capacitor/core');
});

describe('apiClient sul sito (cookie HttpOnly)', () => {
  it('GET: intestazione X-VinylDex-Client web, cookie dello stesso sito, niente Authorization', async () => {
    const { apiClient } = await loadClient();
    fetchMock.mockResolvedValue(response(200, { ok: true }));

    await expect(apiClient.get('cards')).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cards');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ Accept: 'application/json', 'X-VinylDex-Client': 'web' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('un token vecchio in localStorage viene cancellato e non parte mai come Bearer', async () => {
    localStorage.setItem('vinyldex_token', 'vecchio');
    const { apiClient, getToken, setToken } = await loadClient();
    expect(localStorage.getItem('vinyldex_token')).toBeNull();

    setToken('nuovo');
    expect(localStorage.getItem('vinyldex_token')).toBeNull();
    expect(getToken()).toBeNull();

    fetchMock.mockResolvedValue(response(200, {}));
    await apiClient.get('/me');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('POST con corpo: JSON e Content-Type, intestazioni del chiamante in aggiunta', async () => {
    const { apiClient } = await loadClient();
    fetchMock.mockResolvedValue(response(201, { id: 7 }));

    await expect(apiClient.post('/trades', { card: 'x' }, { headers: { 'X-Extra': '1' } })).resolves.toEqual({ id: 7 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ card: 'x' }));
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-Extra': '1', 'X-VinylDex-Client': 'web' });
  });

  it.each(['put', 'patch', 'delete'])('%s usa il metodo giusto', async (method) => {
    const { apiClient } = await loadClient();
    fetchMock.mockResolvedValue(response(200, {}));
    await apiClient[method]('/x', { a: 1 });
    expect(fetchMock.mock.calls[0][1].method).toBe(method.toUpperCase());
  });

  it('risposta vuota (204): null', async () => {
    const { apiClient } = await loadClient();
    fetchMock.mockResolvedValue(response(204));
    await expect(apiClient.delete('/x')).resolves.toBeNull();
  });

  it('dopo setHotelSession le richieste portano X-Hotel-Session', async () => {
    const { apiClient, setHotelSession } = await loadClient();
    fetchMock.mockResolvedValue(response(200, {}));
    setHotelSession('sessione-1');
    await apiClient.post('/casino/spin', {});
    expect(fetchMock.mock.calls[0][1].headers['X-Hotel-Session']).toBe('sessione-1');
    setHotelSession(null);
    await apiClient.get('/x');
    expect(fetchMock.mock.calls[1][1].headers['X-Hotel-Session']).toBeUndefined();
  });

  it('errore del server: ApiError con status, messaggio e codice dal payload', async () => {
    const { apiClient, ApiError } = await loadClient();
    fetchMock.mockResolvedValue(response(409, { error: 'insufficient_gold', message: 'Gold insufficienti' }, 'Conflict'));

    const err = await apiClient.post('/packs/open', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(409);
    expect(err.code).toBe('insufficient_gold');
    expect(err.message).toBe('Gold insufficienti');
    expect(err.payload).toEqual({ error: 'insufficient_gold', message: 'Gold insufficienti' });
  });

  it('errore senza message: si usa error, poi lo statusText', async () => {
    const { apiClient } = await loadClient();
    fetchMock.mockResolvedValueOnce(response(400, { error: 'bad_request' }, 'Bad Request'));
    await expect(apiClient.get('/a')).rejects.toMatchObject({ message: 'bad_request', status: 400 });

    fetchMock.mockResolvedValueOnce(response(500, undefined, 'Internal Server Error'));
    await expect(apiClient.get('/b')).rejects.toMatchObject({ message: 'Internal Server Error', status: 500, code: null, payload: null });
  });

  it('server irraggiungibile: ApiError con status 0', async () => {
    const { apiClient } = await loadClient();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiClient.get('/x')).rejects.toMatchObject({ status: 0, message: 'Impossibile contattare il server.' });
  });

  it('richiesta che non risponde entro il timeout: messaggio di richiesta scaduta', async () => {
    const { apiClient } = await loadClient();
    // fetch finta che resta in attesa finche' la richiesta non viene annullata.
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('annullata', 'AbortError')));
    }));
    await expect(apiClient.get('/lenta', { timeout: 20 })).rejects.toMatchObject({
      status: 0,
      message: 'Richiesta scaduta: il server non risponde.'
    });
  });

  it('sessione del sito: markSession, hasSession e logout con setToken(null)', async () => {
    const { hasSession, markSession, setToken } = await loadClient();
    expect(hasSession()).toBe(false);
    markSession();
    expect(localStorage.getItem('vinyldex_session')).toBe('1');
    expect(hasSession()).toBe(true);
    setToken(null);
    expect(hasSession()).toBe(false);
  });

  it('hasSession con localStorage che lancia eccezione: si chiede il profilo lo stesso', async () => {
    const { hasSession } = await loadClient();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('accesso negato');
    });
    expect(hasSession()).toBe(true);
  });

  it('token del dispositivo fidato: si salva e si toglie', async () => {
    const { getDeviceToken, setDeviceToken } = await loadClient();
    expect(getDeviceToken()).toBeNull();
    setDeviceToken('dev-1');
    expect(getDeviceToken()).toBe('dev-1');
    setDeviceToken(null);
    expect(getDeviceToken()).toBeNull();
  });
});

describe('apiClient nell\'app nativa (Capacitor)', () => {
  it('manda il token come Bearer e X-VinylDex-Client native', async () => {
    const { apiClient, setToken, getToken, hasSession } = await loadClient({ native: true });
    expect(hasSession()).toBe(false);
    setToken('jwt-nativo');
    expect(getToken()).toBe('jwt-nativo');
    expect(hasSession()).toBe(true);

    fetchMock.mockResolvedValue(response(200, {}));
    await apiClient.get('/me');
    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers.Authorization).toBe('Bearer jwt-nativo');
    expect(headers['X-VinylDex-Client']).toBe('native');
  });

  it('il token salvato resta all\'avvio e markSession non scrive niente', async () => {
    localStorage.setItem('vinyldex_token', 'salvato');
    const { getToken, markSession } = await loadClient({ native: true });
    expect(getToken()).toBe('salvato');
    markSession();
    expect(localStorage.getItem('vinyldex_session')).toBeNull();
  });

  it('senza token niente Authorization', async () => {
    const { apiClient } = await loadClient({ native: true });
    fetchMock.mockResolvedValue(response(200, {}));
    await apiClient.get('/cards/daily');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
