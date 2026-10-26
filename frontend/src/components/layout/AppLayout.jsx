import { useEffect, useRef } from 'react';
import { Suspense } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BottomNav from './BottomNav.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import GoldFlight from '../fx/GoldFlight.jsx';
import { useSurfaceFx } from '../../hooks/useSurfaceFx.js';
import { useScrollRestoration } from '../../hooks/useScrollRestoration.js';
import HotelProvider from '../../hotel/HotelProvider.jsx';
import PageTour from '../common/PageTour.jsx';
import { useFreePackNotifier } from '../../hooks/useFreePackNotifier.js';
import RotatePrompt from './RotatePrompt.jsx';
import { applyOrientation, onOrientationPref } from '../../services/orientation.js';
import { DONATE_URL, LEGAL_LINKS } from '../../data/links.js';

export default function AppLayout() {
  const location = useLocation();
  const viewRef = useRef(null);

  // Alone al passaggio del puntatore e comparsa allo scroll su ogni pannello di vetro.
  // Passa da qui e non dalle singole pagine: cosi' vale anche per i pannelli futuri.
  useSurfaceFx(viewRef, location.pathname);
  // Notifica "pacchetto gratis pronto" (se l'utente l'ha chiesta), su qualunque pagina.
  useFreePackNotifier();

  // Tornando indietro da una carta si riprende la collezione dal punto in cui si era,
  // invece di ripartire dall'inizio dell'elenco.
  useScrollRestoration();

  // Orientamento dello schermo: orizzontale nell'hotel, altrimenti quello scelto dal giocatore.
  const inHotel = location.pathname.startsWith('/hotel');
  useEffect(() => {
    applyOrientation(inHotel);
    document.body.classList.toggle('in-hotel', inHotel);
    return onOrientationPref(() => applyOrientation(inHotel));
  }, [inHotel]);

  return (
    // La connessione all'hotel vive qui e non nella sua pagina: cambiando sezione si resta
    // nella stanza e si ricevono sfide e scambi.
    <HotelProvider>
      <GoldFlight />
      {inHotel && <RotatePrompt />}
      <PageTour key={location.pathname} path={location.pathname} />

      <div className="app-shell">
        <Sidebar />

        <div className="app-content">
          <Topbar />

          <main
            id="app-view"
            ref={viewRef}
            className="app-main"
            role="main"
            aria-live="polite"
            key={location.pathname}
          >
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}><Outlet /></Suspense>
            </ErrorBoundary>
          </main>

          <footer id="app-footer">
            <div className="footer-inner">
              <small>VinylDex — Contenuti originali</small>
              {DONATE_URL && (
                <a className="footer-donate" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
                  <i className="ph-fill ph-paypal-logo" aria-hidden="true" /> Sostieni VinylDex
                  <span className="sr-only"> (si apre PayPal in una nuova scheda)</span>
                </a>
              )}
              <small className="app-footer-credits">
                Progetto didattico non ufficiale. Le carte importate e i relativi marchi appartengono ai
                rispettivi proprietari (Pokémon, Wizards of the Coast, Konami, Bandai, Disney, Riot Games).
                Dati e foto EA SPORTS FC™ 27: EA SPORTS FC Player Ratings, © Electronic Arts Inc. Non affiliato
                né approvato da Electronic Arts.
              </small>
              <nav className="footer-legal" aria-label="Note legali">
                {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
                <span>© 2026 JusTMeth25</span>
              </nav>
            </div>
          </footer>
        </div>

        <BottomNav />
      </div>
    </HotelProvider>
  );
}
