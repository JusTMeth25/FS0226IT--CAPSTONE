/**
 * VinylDex - Hash-based SPA Router
 * 
 * Gestisce la navigazione lato client usando l'hash dell'URL.
 * Mappa ogni hash a una funzione render che popola #app-view.
 */
class Router {
  constructor() {
    /** @type {Object<string, Function>} Mappa route -> render function */
    this.routes = {};
    
    /** @type {string|null} Ultima route attiva */
    this.currentRoute = null;

    /** @type {Function|null} Callback eseguito ad ogni cambio route */
    this.onRouteChange = null;

    // Bind handler hashchange
    this._handleHashChange = this._handleHashChange.bind(this);
    window.addEventListener('hashchange', this._handleHashChange);
  }

  /**
   * Registra una nuova route.
   * @param {string} hash - L'hash senza # (es. 'home', 'packs', 'collection')
   * @param {Function} renderFn - Funzione che riceve il container #app-view e popola il contenuto
   */
  addRoute(hash, renderFn) {
    this.routes[hash] = renderFn;
  }

  /**
   * Avvia il router navigando alla route corrente o fallback a home.
   */
  init() {
    // Se non c'è hash, naviga a #home
    if (!window.location.hash) {
      window.location.hash = '#home';
    } else {
      this._handleHashChange();
    }
  }

  /**
   * Gestisce il cambio hash e renderizza la view corrispondente.
   */
  _handleHashChange() {
    // Rimuovi il # iniziale
    const hash = window.location.hash.slice(1) || 'home';
    
    // Route params: supporto per #detail/card-id
    let route = hash;
    let params = {};
    
    if (hash.includes('/')) {
      const parts = hash.split('/');
      route = parts[0];
      params = { id: parts.slice(1).join('/') };
    }

    const renderFn = this.routes[route];

    if (renderFn) {
      this.currentRoute = route;
      const container = document.getElementById('app-view');
      
      if (container) {
        renderFn(container, params);
      }

      // Aggiorna nav link attivi
      this._updateActiveNav(route);

      // Callback
      if (this.onRouteChange) {
        this.onRouteChange(route, params);
      }
    } else {
      // Route non trovata → redirect a home
      window.location.hash = '#home';
    }
  }

  /**
   * Aggiorna la classe active sui link di navigazione.
   * @param {string} route - Route corrente
   */
  _updateActiveNav(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkHash = link.getAttribute('href').replace('#', '');
      link.classList.toggle('active', linkHash === route);
    });
  }

  /**
   * Naviga a una route specifica.
   * @param {string} hash - Hash senza #
   */
  navigate(hash) {
    window.location.hash = `#${hash}`;
  }

  /**
   * Pulisce l'event listener.
   */
  destroy() {
    window.removeEventListener('hashchange', this._handleHashChange);
  }
}

// Export per utilizzo globale
window.VinylDexRouter = Router;