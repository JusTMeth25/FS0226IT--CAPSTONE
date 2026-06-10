/**
 * Language: JavaScript
 * VinylDex - SyncQueueService
 *
 * Responsibilities:
 * - Persistente in LocalStorage di una coda di operazioni da sincronizzare col server
 * - Retry con backoff esponenziale e max attempts
 * - Trigger automatico on 'online' e polling periodico
 * - API semplice: enqueue(op), start(), stop(), getQueue(), clear()
 * - Event dispatch per stato (optional) via CustomEvent 'vinyldex:sync:status'
 *
 * Design notes:
 * - Single responsibility: questa classe gestisce solo la coda/sync; invia le richieste tramite VinylDexApiService
 * - Persistence: usa VinylDexStorage per salvare la coda sotto la chiave 'sync_queue'
 * - Resilienza: non blocca l'esperienza utente, ogni operazione è best-effort
 */

class SyncQueueService {
  constructor({ storage = null, api = null, pollInterval = 5000, maxAttempts = 5 } = {}) {
    this.storage = storage || (window.VinylDexStorage ? new window.VinylDexStorage() : null);
    this.api = api || (window.VinylDexApiService || null);
    this.pollInterval = pollInterval;
    this.maxAttempts = maxAttempts;
    this.timer = null;
    this.processing = false;
    this.queueKey = 'sync_queue';
    // load queue or init
    this._queue = this._loadQueue();
    // Bind online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  // ===== Persistence helpers =====
  _loadQueue() {
    try {
      if (!this.storage) return [];
      return this.storage.get(this.queueKey, []);
    } catch (e) {
      console.error('[SyncQueueService] loadQueue error', e);
      return [];
    }
  }

  _saveQueue() {
    try {
      if (!this.storage) return false;
      this.storage.set(this.queueKey, this._queue);
      return true;
    } catch (e) {
      console.error('[SyncQueueService] saveQueue error', e);
      return false;
    }
  }

  // ===== Public API =====

  /**
   * Enqueue an operation to sync later.
   * op: { type: string, path?: string, method?: 'POST'|'PUT'|'DELETE'|'PATCH', body?: Object, meta?: Object }
   * Returns the queued item (with id).
   */
  enqueue(op) {
    const now = Date.now();
    const item = {
      id: `sync_${now}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
      op: {
        type: op.type || 'generic',
        path: op.path || null,
        method: (op.method || 'POST').toUpperCase(),
        body: op.body || null,
        meta: op.meta || null
      }
    };
    this._queue.push(item);
    this._saveQueue();
    this._emitStatus();
    // kick processing if online
    if (navigator.onLine) {
      this.processQueue();
    }
    return item;
  }

  /**
   * Get current queue copy
   */
  getQueue() {
    return [...this._queue];
  }

  /**
   * Clear entire queue
   */
  clear() {
    this._queue = [];
    this._saveQueue();
    this._emitStatus();
  }

  /**
   * Start periodic processing
   */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.processQueue(), this.pollInterval);
    // Try immediate run
    this.processQueue();
  }

  /**
   * Stop periodic processing
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ===== Internal processing =====

  /**
   * Process queue items (single-concurrency).
   * Safe to call multiple times; if already processing, returns early.
   */
  async processQueue() {
    if (this.processing) return;
    if (!navigator.onLine) {
      this._emitStatus();
      return;
    }
    if (!this.api) {
      // If no API available, emit and skip
      console.warn('[SyncQueueService] No API service available - skipping sync');
      this._emitStatus();
      return;
    }

    this.processing = true;
    this._emitStatus();

    try {
      // Process items whose nextAttemptAt <= now
      for (let i = 0; i < this._queue.length; i++) {
        const item = this._queue[i];
        if (Date.now() < item.nextAttemptAt) continue;

        try {
          // Dispatch based on op.path/method; flexible for domain ops
          await this._send(item);
          // Success -> remove from queue
          this._queue.splice(i, 1);
          i -= 1; // adjust index after removal
          this._saveQueue();
          this._emitStatus({ lastSynced: item });
          // Small pause between items to avoid thundering herd
          await this._sleep(200);
        } catch (err) {
          // Failure: increment attempts, set backoff nextAttemptAt
          item.attempts = (item.attempts || 0) + 1;
          const backoffMs = this._computeBackoff(item.attempts);
          item.nextAttemptAt = Date.now() + backoffMs;
          // If exceed maxAttempts, move to dead-letter (or drop)
          if (item.attempts >= this.maxAttempts) {
            console.error('[SyncQueueService] Max attempts reached for item, dropping:', item, err);
            // Optionally persist failed items to a separate key for inspection
            this._pushToFailed(item, err);
            this._queue.splice(i, 1);
            i -= 1;
          } else {
            console.warn('[SyncQueueService] Sync attempt failed, will retry:', item, err);
          }
          this._saveQueue();
        }
      }
    } finally {
      this.processing = false;
      this._emitStatus();
    }
  }

  /**
   * Low-level send logic for an item.
   * Supports direct POST to endpoint or domain-specific dispatch.
   */
  async _send(item) {
    // If op.path provided, call that endpoint with given method
    const op = item.op;
    if (op.path) {
      // Use api.request to keep headers/timeout logic consistent
      const method = (op.method || 'POST').toUpperCase();
      // build options for api.request
      const opts = { method, body: op.body };
      // api.request expects path without baseUrl prefix
      const res = await this.api.request(op.path, opts);
      return res;
    }

    // Domain-specific fallback examples:
    // type: 'cards_sync' => POST /sync/cards
    if (op.type === 'cards_sync') {
      return this.api.post('/sync/cards', { cards: op.body });
    }

    // Generic fallback: POST /sync/op
    return this.api.post('/sync/op', { type: op.type, body: op.body, meta: op.meta });
  }

  /**
   * Compute exponential backoff (ms) with jitter
   */
  _computeBackoff(attempts) {
    const base = 1000; // 1s
    const max = 60 * 1000; // 1 minute cap
    const expo = Math.min(base * Math.pow(2, attempts - 1), max);
    // jitter 0..250ms
    const jitter = Math.floor(Math.random() * 250);
    return expo + jitter;
  }

  /**
   * Push a failed item for later inspection
   */
  _pushToFailed(item, err) {
    try {
      if (!this.storage) return;
      const failedKey = 'sync_failed';
      const arr = this.storage.get(failedKey, []);
      arr.push({ item, error: { message: err?.message || String(err), stack: err?.stack || null }, failedAt: Date.now() });
      this.storage.set(failedKey, arr);
    } catch (e) {
      console.error('[SyncQueueService] pushToFailed error', e);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== Diagnostics / Events =====

  /**
   * Emit simple CustomEvent with queue status
   */
  _emitStatus(extra = {}) {
    try {
      const evtDetail = {
        online: navigator.onLine,
        processing: !!this.processing,
        queueLength: this._queue.length,
        nextItem: this._queue.length ? this._queue[0] : null,
        timestamp: Date.now(),
        ...extra
      };
      const event = new CustomEvent('vinyldex:sync:status', { detail: evtDetail });
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(event);
      }
    } catch (e) {
      // ignore
    }
  }
}

// Export singleton for app usage
window.VinylDexSyncQueue = new SyncQueueService({
  storage: window.VinylDexStorage ? new window.VinylDexStorage() : null,
  api: window.VinylDexApiService || null,
  pollInterval: 5000,
  maxAttempts: 5
});