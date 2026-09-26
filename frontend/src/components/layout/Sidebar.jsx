import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useGame } from '../../hooks/useGame.js';
import { useCountUp } from '../../hooks/useCountUp.js';
import UserAvatar from '../common/UserAvatar.jsx';
import { useUnseenNews } from '../../hooks/useUnseenNews.js';

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: 'ph-house' },
  { to: '/packs', label: 'Apri pacchetti', icon: 'ph-gift' },
  { to: '/collection', label: 'Collezione', icon: 'ph-cards' },
  { to: '/sets', label: 'Set', icon: 'ph-stack' },
  { to: '/marketplace', label: 'Mercato', icon: 'ph-storefront' },
  { to: '/trades', label: 'Scambi', icon: 'ph-arrows-left-right' },
  { to: '/missions', label: 'Missioni', icon: 'ph-target' },
  { to: '/events', label: 'Eventi', icon: 'ph-calendar-star' },
  { to: '/leaderboard', label: 'Classifica', icon: 'ph-trophy' },
  { to: '/battle', label: 'Battaglie', icon: 'ph-sword' },
  { to: '/hotel', label: 'Hotel', icon: 'ph-buildings' },
  { to: '/profile', label: 'Profilo', icon: 'ph-user-circle' },
  { to: '/news', label: 'Novità', icon: 'ph-megaphone' }
];

/** Navigazione desktop (≥992px): a mobile/tablet la sostituisce interamente BottomNav. */
export default function Sidebar() {
  const { user } = useAuth();
  const { gold, levelInfo } = useGame();
  const displayGold = useCountUp(gold);
  const unseenNews = useUnseenNews();
  const xpPercent = levelInfo.xpForNext > 0 ? Math.round((levelInfo.xpRemaining / levelInfo.xpForNext) * 100) : 100;

  return (
    <aside className="sidebar" id="app-sidebar">
      <div className="sidebar-brand">
        <Link to="/home" className="nav-link">VinylDex</Link>
      </div>

      <div className="sidebar-user">
        <UserAvatar avatar={user?.avatar} className="sidebar-avatar" fallbackIcon="ph-vinyl-record" />
        <div className="sidebar-user-info">
          <span className="sidebar-username">{user?.username}</span>
          <span className="sidebar-level">Livello {levelInfo.level}</span>
        </div>
      </div>

      <div className="sidebar-xp">
        <div className="progress-bar sidebar-xp-bar">
          <div className="progress-fill" style={{ width: `${xpPercent}%` }} />
        </div>
        <span className="sidebar-xp-text">{levelInfo.xpRemaining} / {levelInfo.xpForNext} XP</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <i className={`ph-fill ${item.icon}`} /> {item.label}
                {item.to === '/news' && unseenNews && <span className="nav-new-dot" aria-label="Novità da vedere" />}
              </NavLink>
            </li>
          ))}
          {user?.role === 'ADMIN' && (
            <li>
              <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <i className="ph-fill ph-shield-star" /> Admin
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-gold-pill"><i className="ph-fill ph-coin" /> {displayGold}</span>
      </div>
    </aside>
  );
}
