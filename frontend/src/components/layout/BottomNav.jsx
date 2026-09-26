import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';

const TABS = [
  { to: '/home', label: 'Home', icon: 'ph-house' },
  { to: '/packs', label: 'Pacchetti', icon: 'ph-gift' },
  { to: '/collection', label: 'Collezione', icon: 'ph-cards' },
  { to: '/battle', label: 'Battaglie', icon: 'ph-sword' }
];

const MORE_ITEMS = [
  { to: '/hotel', label: 'Hotel', icon: 'ph-buildings' },
  { to: '/profile', label: 'Profilo', icon: 'ph-user-circle' },
  { to: '/marketplace', label: 'Mercato', icon: 'ph-storefront' },
  { to: '/trades', label: 'Scambi', icon: 'ph-arrows-left-right' },
  { to: '/missions', label: 'Missioni', icon: 'ph-target' },
  { to: '/sets', label: 'Set', icon: 'ph-stack' },
  { to: '/events', label: 'Eventi', icon: 'ph-calendar-star' },
  { to: '/leaderboard', label: 'Classifica', icon: 'ph-trophy' },
  { to: '/news', label: 'Novità', icon: 'ph-megaphone' }
];

/**
 * Navigazione principale per mobile/tablet (sostituisce sidebar+hamburger sotto i 992px):
 * 4 tab dirette + "Altro", che apre uno sheet dal basso con le sezioni secondarie.
 */
export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useBodyScrollLock(moreOpen);

  const moreItems = user?.role === 'ADMIN'
    ? [...MORE_ITEMS, { to: '/admin', label: 'Admin', icon: 'ph-shield-star' }]
    : MORE_ITEMS;
  const moreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  // Posizione dell'indicatore. Le tab hanno tutte flex: 1, quindi l'indice basta a
  // ricavare lo spostamento in percentuale, senza misurare nulla nel DOM.
  // -1 sulle pagine che non corrispondono a nessuna voce (per esempio il dettaglio
  // di una carta): li' l'indicatore resta nascosto invece di puntare a caso.
  const tabIndex = TABS.findIndex((tab) => location.pathname.startsWith(tab.to));
  const activeIndex = tabIndex >= 0 ? tabIndex : (moreActive ? TABS.length : -1);

  function goTo(to) {
    setMoreOpen(false);
    navigate(to);
  }

  return (
    <>
      <nav className="bottom-nav" aria-label="Navigazione principale">
        {activeIndex >= 0 && (
          <span
            className="bottom-nav-indicator"
            aria-hidden="true"
            style={{ '--nav-index': activeIndex, '--nav-count': TABS.length + 1 }}
          />
        )}
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <i className={`ph-fill ${tab.icon}`} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav-item bottom-nav-more-btn${moreActive ? ' active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="true"
          aria-expanded={moreOpen}
        >
          <i className="ph-fill ph-list" />
          <span>Altro</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="more-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <h3 className="more-sheet-title">Altre sezioni</h3>
            <div className="more-sheet-grid">
              {moreItems.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  className={`more-sheet-item${location.pathname.startsWith(item.to) ? ' active' : ''}`}
                  onClick={() => goTo(item.to)}
                >
                  <i className={`ph-fill ${item.icon}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-secondary more-sheet-close" onClick={() => setMoreOpen(false)}>
              Chiudi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
