import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useGame } from '../../hooks/useGame.js';
import { useSound } from '../../hooks/useSound.js';
import { useCountUp } from '../../hooks/useCountUp.js';

export default function Topbar({ sidebarOpen, onToggleSidebar }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { gold } = useGame();
  const displayGold = useCountUp(gold);
  const { enabled, toggle } = useSound();

  return (
    <header className="topbar" id="app-header">
      <div className="header-inner">
        <button
          className={`hamburger-btn ${sidebarOpen ? 'hamburger-open' : ''}`}
          aria-label="Menu"
          onClick={onToggleSidebar}
        >
          <span /><span /><span />
        </button>

        <Link to="/home" className="nav-link topbar-brand">VinylLegends</Link>

        <span className="topbar-gold-pill"><i className="ph-fill ph-coin" /> {displayGold}</span>

        <button
          className="btn small"
          aria-label="Attiva/disattiva audio"
          title={enabled ? 'Disattiva audio' : 'Attiva audio'}
          onClick={toggle}
        >
          <i className={`ph-fill ${enabled ? 'ph-speaker-high' : 'ph-speaker-slash'}`} />
        </button>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{user.username}</span>
            <button className="btn small" onClick={logout}>Logout</button>
          </div>
        ) : (
          <Link to="/login" className="btn small">Accedi</Link>
        )}
      </div>
    </header>
  );
}
