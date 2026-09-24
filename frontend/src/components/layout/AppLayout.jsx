import { useRef } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BottomNav from './BottomNav.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import GoldFlight from '../fx/GoldFlight.jsx';
import { useSurfaceFx } from '../../hooks/useSurfaceFx.js';
import { useScrollRestoration } from '../../hooks/useScrollRestoration.js';
import HotelProvider from '../../hotel/HotelProvider.jsx';

export default function AppLayout() {
  const location = useLocation();
  const viewRef = useRef(null);

  // Alone al passaggio del puntatore e comparsa allo scroll su ogni pannello di vetro.
  // Passa da qui e non dalle singole pagine: cosi' vale anche per i pannelli futuri.
  useSurfaceFx(viewRef, location.pathname);

  // Tornando indietro da una carta si riprende la collezione dal punto in cui si era,
  // invece di ripartire dall'inizio dell'elenco.
  useScrollRestoration();

  return (
    // La connessione all'hotel vive qui e non nella sua pagina: cambiando sezione si resta
    // nella stanza e si ricevono sfide e scambi.
    <HotelProvider>
      <GoldFlight />

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
              <Outlet />
            </ErrorBoundary>
          </main>

          <footer id="app-footer">
            <div className="footer-inner">
              <small>VinylDex — Contenuti originali</small>
            </div>
          </footer>
        </div>

        <BottomNav />
      </div>
    </HotelProvider>
  );
}
