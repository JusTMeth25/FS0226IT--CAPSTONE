import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Chiude la sidebar mobile ad ogni cambio pagina.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intenzionale su navigazione
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'sidebar-overlay-visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <div className="app-content">
        <Topbar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

        <main id="app-view" className="app-main" role="main" aria-live="polite" key={location.pathname}>
          <Outlet />
        </main>

        <footer id="app-footer">
          <div className="footer-inner">
            <small>VinylLegends — Contenuti originali</small>
          </div>
        </footer>
      </div>
    </div>
  );
}
