/**
 * Language: JavaScript
 * VinylDex - ApiService (fetch wrapper)
 *
 * Responsibilities:
 * - Centralize HTTP calls to backend (/api)
 * - Attach JWT from StorageService automatically
 * - Provide convenience methods: get, post, put, delete, openPack
 * - Small, testable, single-responsibility class
 *
 * Usage:
 *   const api = new window.VinylDexApiService({ baseUrl: '/api' });
 *   await api.post('/auth/login', { email, password });
 *
 * Exports:
 *   window.VinylDexApiService (instance)
 */

class ApiService {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base API url (defaults to '/api')
   * @param {StorageService} options.storage - Optional storage instance
   */
  constructor({ baseUrl = '/api', storage = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // trim trailing slash
    // Use provided storage, otherwise create a local instance of VinylDexStorage
    this.storage = storage || (window.VinylDexStorage ? new window.VinylDexStorage() : null);
    this.TOKEN_KEY = 'auth_token';
    // Simple exponential-backoff retry config for idempotent GETs if needed
    this.defaultTimeout = 10000; // ms
  }

  setToken(token) {
    if (!this.storage) return false;
    return this.storage.set(this.TOKEN_KEY, token);
  }

  getToken() {
    if (!this.storage) return null;
    return this.storage.get(this.TOKEN_KEY, null);
  }

  clearToken() {
    if (!this.storage) return false;
    return this.storage.remove(this.TOKEN_KEY);
  }

  _buildUrl(path, params) {
    const p = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.baseUrl}${p}`;
    if (params && typeof params === 'object' && Object.keys(params).length) {
      const qs = Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
      url += `?${qs}`;
    }
    return url;
  }

  async request(path, { method = 'GET', headers = {}, body = null, timeout = this.defaultTimeout } = {}) {
    const url = this._buildUrl(path);
    const token = this.getToken();
    const baseHeaders = {
      'Accept': 'application/json',
      ...headers,
    };
    if (body !== null && !(body instanceof FormData)) baseHeaders['Content-Type'] = 'application/json';
    if (token) baseHeaders['Authorization'] = `Bearer ${token}`;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const opts = {
      method,
      headers: baseHeaders,
    };
    if (controller) opts.signal = controller.signal;
    if (body !== null) opts.body = (body instanceof FormData) ? body : JSON.stringify(body);

    // timeout
    let timer;
    if (controller && timeout > 0) {
      timer = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const resp = await fetch(url, opts);
      if (timer) clearTimeout(timer);
      const text = await resp.text();
      const data = text ? JSON.parse(text) : null;
      if (!resp.ok) {
        const err = new Error(data?.message || resp.statusText || 'API_ERROR');
        err.status = resp.status;
        err.payload = data;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const e = new Error('Request timeout');
        e.code = 'ETIMEOUT';
        throw e;
      }
      throw err;
    }
  }

  // Convenience methods
  async get(path, params = null, opts = {}) {
    const urlPath = params ? `${path}${this._serializeParams(params)}` : path;
    return this.request(urlPath, { method: 'GET', ...opts });
  }

  async post(path, body = null, opts = {}) {
    return this.request(path, { method: 'POST', body, ...opts });
  }

  async put(path, body = null, opts = {}) {
    return this.request(path, { method: 'PUT', body, ...opts });
  }

  async delete(path, body = null, opts = {}) {
    return this.request(path, { method: 'DELETE', body, ...opts });
  }

  _serializeParams(params) {
    if (!params || typeof params !== 'object') return '';
    const qs = Object.keys(params)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
    return qs ? `?${qs}` : '';
  }

  // Domain-specific helper: open a pack
  // Expects backend endpoint POST /open-pack { packId }
  // Returns backend response or throws on error
  async openPack(packId) {
    if (!packId) throw new Error('packId required');
    return this.post('/open-pack', { packId });
  }

  // Auth helpers
  async login(email, password) {
    const res = await this.post('/auth/login', { email, password });
    if (res?.token) this.setToken(res.token);
    return res;
  }

  async register(username, email, password) {
    const res = await this.post('/auth/register', { username, email, password });
    if (res?.token) this.setToken(res.token);
    return res;
  }

  async profile() {
    return this.get('/auth/profile');
  }
}

// Export instance for app use
window.VinylDexApiService = new ApiService({ baseUrl: typeof window.VinylDexConfig !== 'undefined' ? (window.VinylDexConfig.apiBaseUrl || '/api') : '/api' });