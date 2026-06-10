/**
 * VinylDex - Sync Status UI
 *
 * - Injects a small sync badge into the header
 * - Listens to 'vinyldex:sync:status' events dispatched by SyncQueueService
 * - Shows queue length, processing state and last synced item summary
 * - Provides an inspector modal to view failed items (key: 'sync_failed') and current queue ('sync_queue')
 *
 * Lightweight, no external deps. Safe if Storage/Sync services are missing.
 */

(function () {
  const STYLE_ID = 'vinyldex-sync-status-styles';
  const CONTAINER_ID = 'vinyldex-sync-status';
  const MODAL_ID = 'vinyldex-sync-inspector';

  // Minimal styles injected to avoid editing global CSS
  const styles = `
  #${CONTAINER_ID} { display:flex; gap:8px; align-items:center; margin-left: 12px; }
  #${CONTAINER_ID} .sync-btn { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.03); color:var(--text-secondary); border:1px solid rgba(139,92,246,0.08); font-weight:700; font-size:0.9rem; }
  #${CONTAINER_ID} .sync-badge-dot { width:10px; height:10px; border-radius:50%; background:var(--neon-gold); display:inline-block; box-shadow: var(--glow-purple); }
  #${CONTAINER_ID} .sync-count { font-weight:900; color:var(--neon-cyan); min-width:20px; text-align:center; }
  /* Modal */
  #${MODAL_ID} { position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:12000; }
  #${MODAL_ID}.open { display:flex; }
  #${MODAL_ID} .overlay { position:absolute; inset:0; background:rgba(0,0,0,0.6); backdrop-filter: blur(3px); }
  #${MODAL_ID} .panel { position:relative; z-index:2; width:920px; max-width:94%; max-height:84%; overflow:auto; border-radius:12px; padding:18px; background:var(--bg-card); border:1px solid var(--glass-border); box-shadow:var(--shadow-lg); color:var(--text-primary); }
  #${MODAL_ID} .panel h3 { margin-bottom:8px; font-size:1.1rem; }
  #${MODAL_ID} .panel .section { margin-bottom:12px; }
  #${MODAL_ID} .failed-list, #${MODAL_ID} .queue-list { max-height:320px; overflow:auto; padding:8px; border-radius:8px; background:rgba(0,0,0,0.12); border:1px dashed rgba(139,92,246,0.06); }
  #${MODAL_ID} .item { padding:8px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:0.9rem; }
  #${MODAL_ID} .item:last-child { border-bottom:none; }
  #${MODAL_ID} .meta { color:var(--text-secondary); font-size:0.8rem; margin-top:6px; }
  #${MODAL_ID} .actions { display:flex; gap:8px; margin-top:12px; }
  #${MODAL_ID} .btn { padding:6px 10px; border-radius:8px; font-weight:700; }
  `;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = styles;
    document.head.appendChild(s);
  }

  function createUI() {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return null;

    // Avoid duplicate
    if (document.getElementById(CONTAINER_ID)) return document.getElementById(CONTAINER_ID);

    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    const badge = document.createElement('button');
    badge.className = 'sync-btn';
    badge.id = 'sync-badge';
    badge.title = 'Stato sincronizzazione';
    badge.innerHTML = '<span class="sync-badge-dot" aria-hidden="true"></span><span class="sync-label">Sync</span><span id="sync-count" class="sync-count">0</span>';

    const inspectorToggle = document.createElement('button');
    inspectorToggle.className = 'sync-btn';
    inspectorToggle.id = 'sync-inspector-toggle';
    inspectorToggle.title = 'Apri ispezione sync';
    inspectorToggle.textContent = 'Inspect';

    container.appendChild(badge);
    container.appendChild(inspectorToggle);

    // Append to header (right side)
    headerInner.appendChild(container);

    return { container, badge, inspectorToggle };
  }

  function createModal() {
    if (document.getElementById(MODAL_ID)) return document.getElementById(MODAL_ID);

    const modal = document.createElement('div');
    modal.id = MODAL_ID;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>Sync Inspector</h3>
        <button id="sync-inspector-close" class="btn">Chiudi</button>
      </div>
      <div class="section">
        <strong>Queue (persisted)</strong>
        <div class="queue-list" id="sync-queue-list">--</div>
      </div>
      <div class="section">
        <strong>Failed items (sync_failed)</strong>
        <div class="failed-list" id="sync-failed-list">--</div>
      </div>
      <div class="actions">
        <button id="sync-clear-failed" class="btn">Clear failed</button>
        <button id="sync-refresh" class="btn">Refresh</button>
      </div>
    `;

    modal.appendChild(overlay);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    // Close handlers
    overlay.addEventListener('click', () => modal.classList.remove('open'));
    panel.querySelector('#sync-inspector-close').addEventListener('click', () => modal.classList.remove('open'));

    return modal;
  }

  // Storage helpers (use VinylDexStorage if available)
  const storage = (window.VinylDexStorage ? new window.VinylDexStorage() : null);

  async function renderInspector() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const queueListEl = modal.querySelector('#sync-queue-list');
    const failedListEl = modal.querySelector('#sync-failed-list');

    // Read from storage or fallback to empty
    const queue = storage ? storage.get('sync_queue', []) : (window._vinyldex_sync_fake_queue || []);
    const failed = storage ? storage.get('sync_failed', []) : (window._vinyldex_sync_fake_failed || []);

    queueListEl.innerHTML = '';
    if (!queue.length) {
      queueListEl.textContent = 'Queue empty';
    } else {
      queue.forEach((it) => {
        const node = document.createElement('div');
        node.className = 'item';
        const opSummary = it.op ? `${it.op.type} ${it.op.path || ''} [${it.op.method || 'POST'}]` : JSON.stringify(it);
        node.innerHTML = `<div><strong>${it.id}</strong> — ${opSummary}</div>
                          <div class="meta">attempts: ${it.attempts || 0} • nextAttemptAt: ${new Date(it.nextAttemptAt).toLocaleString()}</div>`;
        queueListEl.appendChild(node);
      });
    }

    failedListEl.innerHTML = '';
    if (!failed.length) {
      failedListEl.textContent = 'No failed items';
    } else {
      failed.forEach((f) => {
        const node = document.createElement('div');
        node.className = 'item';
        const item = f.item || {};
        node.innerHTML = `<div><strong>${item.id || '(no id)'}</strong> — ${item.op ? item.op.type : ''}</div>
                          <div class="meta">failedAt: ${new Date(f.failedAt).toLocaleString()} • err: ${f.error?.message || 'unknown'}</div>`;
        failedListEl.appendChild(node);
      });
    }
  }

  function wire() {
    ensureStyles();
    const ui = createUI();
    const modal = createModal();
    if (!ui) return;

    const badgeCount = ui.container.querySelector('#sync-count');
    const badgeEl = ui.badge;
    const toggle = ui.inspectorToggle;

    // Update UI from an event detail object
    function updateFromDetail(detail) {
      try {
        const qlen = detail.queueLength != null ? detail.queueLength : (storage ? (storage.get('sync_queue', []).length) : 0);
        badgeCount.textContent = qlen;
        if (detail.processing) {
          badgeEl.style.borderColor = 'var(--neon-cyan)';
          badgeEl.style.boxShadow = 'var(--glow-purple)';
          badgeEl.style.color = 'var(--neon-cyan)';
        } else {
          badgeEl.style.borderColor = 'rgba(139,92,246,0.08)';
          badgeEl.style.boxShadow = '';
          badgeEl.style.color = 'var(--text-secondary)';
        }
        // Optionally show lastSynced summary as title
        if (detail.lastSynced) {
          badgeEl.title = `Last synced: ${detail.lastSynced.id || JSON.stringify(detail.lastSynced.op || {})}`;
        }
      } catch (e) {
        // ignore
      }
    }

    // Listen for global custom event
    window.addEventListener('vinyldex:sync:status', (ev) => {
      updateFromDetail(ev.detail || {});
    });

    // Initial hydration from storage
    const initialDetail = {
      queueLength: storage ? storage.get('sync_queue', []).length : 0,
      processing: false,
      timestamp: Date.now()
    };
    updateFromDetail(initialDetail);

    // Toggle inspector modal
    toggle.addEventListener('click', async () => {
      modal.classList.add('open');
      await renderInspector();
    });

    // Modal action buttons
    modal.querySelector('#sync-refresh').addEventListener('click', renderInspector);
    modal.querySelector('#sync-clear-failed').addEventListener('click', () => {
      if (!storage) {
        // fallback: clear global fake
        window._vinyldex_sync_fake_failed = [];
      } else {
        storage.set('sync_failed', []);
      }
      renderInspector();
    });

    // Expose helper
    window.VinylDexSyncUI = {
      openInspector: async () => {
        modal.classList.add('open');
        await renderInspector();
      },
      refresh: renderInspector
    };
  }

  // Wait for DOM ready (defer in index.html already so DOM likely ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    // slight delay to allow header-inner to be available even when scripts defer
    setTimeout(wire, 50);
  }
})();