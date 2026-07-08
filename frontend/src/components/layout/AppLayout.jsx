import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BottomNav from './BottomNav.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-content">
        <Topbar />

        <main id="app-view" className="app-main" role="main" aria-live="polite" key={location.pathname}>
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
  );
}
