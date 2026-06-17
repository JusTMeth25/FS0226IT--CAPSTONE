/**
 * VinylDex - Application Entry Point
 * 
 * Inizializza il router SPA, registra le routes e avvia l'app.
 * Questo file viene caricato per ultimo (dopo models, data, services, utils, ui).
 */
(function() {
  'use strict';

  console.log('[VinylDex] 🎵 Avvio applicazione...');
  console.log('[VinylDex] Carte totali nel database:', window.VinylDexArtists.length);

  // ---- Init Storage ----
  const storage = new window.VinylDexStorage();
  // Condividi l'istanza di Storage con ApiService per evitare istanze duplicate
  if (window.VinylDexApiService && !window.VinylDexApiService.storage) {
    window.VinylDexApiService.storage = storage;
  }

  // ---- Init Sync Queue (background offline sync) ----
  if (window.VinylDexSyncQueue) {
    // Assicura che la SyncQueue utilizzi la stessa istanza di storage e l'ApiService corrente
    window.VinylDexSyncQueue.storage = storage;
    window.VinylDexSyncQueue.api = window.VinylDexApiService || null;
    // Avvia il processing periodico / on-online
    window.VinylDexSyncQueue.start();
  }

  // ---- Init App Shell (sidebar + topbar) ----
  if (window.VinylDexShell) {
    window.VinylDexShell.init();
  }

  // ---- Init Router ----
  const router = new window.VinylDexRouter();

  // ---- Route Callbacks (placeholder per ora) ----
  // Queste verranno implementate nelle feature successive

  // Home
  router.addRoute('home', (container, params) => {
    window.VinylDexHome.render(container, params);
  });

  // Packs (Feature 3 - Pack Opening)
  router.addRoute('packs', (container, params) => {
    window.VinylDexPackOpening.render(container, params);
  });

  // Collection (Feature 4)
  router.addRoute('collection', (container, params) => {
    window.VinylDexCollection.render(container, params);
  });

  // VinylDex (Feature 5)
  router.addRoute('vinyl-dex', (container, params) => {
    window.VinylDexPage.render(container, params);
  });

  // Battle PvP (Feature 7)
  router.addRoute('battle', (container, params) => {
    window.VinylDexBattle.render(container, params);
  });

  // Missions & Levels (Feature 8)
  router.addRoute('missions', (container, params) => {
    window.VinylDexMissions.render(container, params);
  });

  // Login / Register (client-only MVP)
  router.addRoute('login', (container, params) => {
    window.VinylDexAuth.render(container, params);
  });

  // ---- Route Change Callback ----
  router.onRouteChange = (route, params) => {
    // Pulisce timer della home
    if (window.VinylDexHome && typeof window.VinylDexHome.destroy === 'function') {
      window.VinylDexHome.destroy();
    }
    // Pulisce timer del pack opening
    if (window.VinylDexPackOpening && typeof window.VinylDexPackOpening.destroy === 'function') {
      window.VinylDexPackOpening.destroy();
    }
    // Aggiorna sidebar/topbar (gold, XP, livello possono essere cambiati nella route precedente)
    if (window.VinylDexShell) {
      window.VinylDexShell.update();
    }
    // Re-triggera la fade-in animation sulla view
    const view = document.getElementById('app-view');
    if (view) {
      view.style.animation = 'none';
      view.offsetHeight; // Trigger reflow
      view.style.animation = '';
    }
  };

  // ---- Avvio Router ----
  router.init();

  // ---- Debug Mode (premi D per aprire/chiudere pannello) ----
  window.VinylDexDebug.enable();

  console.log('[VinylDex] ✅ Applicazione avviata correttamente!');
  console.log('[VinylDex] 🔗 Naviga tra le sezioni usando il menu.');
  console.log('[VinylDex] 🐛 Premi D per aprire il Debug Panel.');

  // ---- Debug: Esponi oggetti globali per test in console ----
  window.__VINYLDEX_DEBUG = {
    router,
    storage,
    artists: window.VinylDexArtists,
    packs: window.VinylDexPacks,
    Card: window.VinylDexCard,
    Pack: window.VinylDexPack,
    Random: window.VinylDexRandom,
    syncQueue: window.VinylDexSyncQueue
  };

})();