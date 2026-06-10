/**
 * assets/js/utils/router.js
 * VinylDex — Minimal modular SPA router used by app.js
 *
 * - Exposes VinylDexRouter constructor on window
 * - Hash-based navigation
 * - Registers named routes with callbacks: (container, params)
 * - Renders into a single container with id 'app-view'
 */
(function () {
  'use strict';

  function VinylDexRouter() {
    this.routes = {};
    this.containerId = 'app-view';
    this.onRouteChange = null;
    this.container = null;
  }

  VinylDexRouter.prototype.addRoute = function (name, callback) {
    this.routes[name] = callback;
  };

  VinylDexRouter.prototype.init = function () {
    // Resolve container
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      // Fallback: try previous id 'app' or body
      this.container = document.getElementById('app') || document.body;
    }

    // Listen to hash changes
    window.addEventListener('hashchange', () => {
      this._renderFromHash();
    });

    // Initial render
    this._renderFromHash();
  };

  VinylDexRouter.prototype.navigate = function (name, params) {
    if (typeof params === 'object' && Object.keys(params).length) {
      // Simple querystring encoding for params (flat)
      const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      window.location.hash = `${name}?${qs}`;
    } else {
      window.location.hash = name;
    }
  };

  VinylDexRouter.prototype._renderFromHash = function () {
    const raw = (window.location.hash || '#home').replace('#', '');
    const [routePart, qsPart] = raw.split('?');
    const route = routePart || 'home';

    // parse simple query string into params (flat)
    const params = {};
    if (qsPart) {
      qsPart.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    const callback = this.routes[route];

    // Update navigation link active state (if present)
    try {
      document.querySelectorAll('[data-route]').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-route') === route);
      });
    } catch (e) {
      // ignore if DOM not ready
    }

    // notify route change
    if (typeof this.onRouteChange === 'function') {
      try { this.onRouteChange(route, params); } catch (e) { console.error('onRouteChange error', e); }
    }

    if (callback) {
      // Clear container and render
      this.container.innerHTML = '';
      try {
        callback(this.container, params);
      } catch (e) {
        console.error('Route callback error for', route, e);
        this.container.innerHTML = `<div class="route-error">Errore nel render della route "${route}". Controlla la console.</div>`;
      }
    } else {
      this.container.innerHTML = `<div class="route-missing">Route "${route}" non trovata.</div>`;
    }

    // Normalize URL hash (keep params if present)
    const normalized = qsPart ? `${route}?${qsPart}` : route;
    if ((window.location.hash || '').replace('#', '') !== normalized) {
      window.location.hash = normalized;
    }
  };

  window.VinylDexRouter = VinylDexRouter;
})();