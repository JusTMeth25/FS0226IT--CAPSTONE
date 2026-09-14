import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useGame } from '../../hooks/useGame.js';
import { useSound } from '../../hooks/useSound.js';
import { useCountUp } from '../../hooks/useCountUp.js';
import UserAvatar from '../common/UserAvatar.jsx';
import ShinyText from '../fx/ShinyText.jsx';

/**
 * HUD in stile "game top bar" (logo, gold, audio, profilo/logout): su mobile/tablet è l'unica
 * barra di navigazione superiore, la sidebar/hamburger è sostituita dalla bottom nav.
 */
export default function Topbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { gold } = useGame();
  const displayGold = useCountUp(gold);
  const { enabled, toggle } = useSound();

  return (
    <header className="topbar" id="app-header">
      <div className="header-inner">
        <Link to="/home" className="topbar-brand">
          <span className="topbar-brand-icon"><i className="ph-fill ph-vinyl-record" /></span>
          <ShinyText className="topbar-brand-text" speed={5}>VinylDex</ShinyText>
        </Link>

        <div className="topbar-actions">
          <span className="topbar-gold-pill" title="Il tuo gold">
            <i className="ph-fill ph-coin" />
            <strong>{displayGold}</strong>
          </span>

          <button
            className="topbar-icon-btn"
            aria-label="Attiva/disattiva audio"
            title={enabled ? 'Disattiva audio' : 'Attiva audio'}
            onClick={toggle}
          >
            <i className={`ph-fill ${enabled ? 'ph-speaker-high' : 'ph-speaker-slash'}`} />
          </button>

          {isAuthenticated ? (
            <>
              <Link to="/profile" className="topbar-profile-link" title="Profilo">
                <UserAvatar avatar={user.avatar} className="topbar-avatar" />
                <span className="topbar-username">{user.username}</span>
              </Link>
              <button className="topbar-icon-btn topbar-logout-btn" onClick={logout} title="Logout" aria-label="Logout">
                <i className="ph-fill ph-sign-out" />
              </button>
            </>
          ) : (
            <Link to="/login" className="topbar-icon-btn" title="Accedi" aria-label="Accedi">
              <i className="ph-fill ph-sign-in" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
