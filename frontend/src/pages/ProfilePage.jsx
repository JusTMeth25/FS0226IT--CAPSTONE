import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import { CARDS } from '../data/cards.js';
import { authApi } from '../services/authApi.js';
import { AVATARS, getAvatarUrl } from '../utils/avatarUtils.js';
import UserAvatar from '../components/common/UserAvatar.jsx';
import AnimatedNumber from '../components/fx/AnimatedNumber.jsx';
import PhotoGallery from '../components/common/PhotoGallery.jsx';
import InstallApp from '../components/common/InstallApp.jsx';
import TwoFactorPanel from '../components/profile/TwoFactorPanel.jsx';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import '../styles/pages/social-phantom.css';
import '../styles/pages/social-account.css';

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const game = useGame();
  const [savingAvatar, setSavingAvatar] = useState(null);
  const [avatarError, setAvatarError] = useState(null);

  // Per gli utenti autenticati il totale reale del catalogo (tutte le fonti) arriva dal server;
  // in modalità ospite l'unico universo possibile resta il catalogo statico locale delle carte originali.
  const totalCatalogCards = game.catalogSize ?? CARDS.length;
  const uniqueCount = useMemo(() => new Set(game.collection.map((c) => c.id)).size, [game.collection]);
  const progressPercent = totalCatalogCards > 0 ? Math.round((uniqueCount / totalCatalogCards) * 100) : 0;

  async function handleSelectAvatar(avatar) {
    if (savingAvatar || avatar === user.avatar) return;
    setAvatarError(null);
    setSavingAvatar(avatar);
    try {
      await authApi.updateAvatar(avatar);
      await refreshUser();
    } catch {
      setAvatarError('Non è stato possibile salvare l\'avatar. Riprova.');
    } finally {
      setSavingAvatar(null);
    }
  }

  // Scheda dei numeri, come la pagina di stato di un personaggio: etichetta a sinistra, valore a destra.
  const stats = [
    { key: 'gold', label: 'Gold', value: <AnimatedNumber value={game.gold} />, tone: 'gold' },
    { key: 'album', label: 'Album', value: <><AnimatedNumber value={uniqueCount} /><small>/{totalCatalogCards}</small></>, bar: progressPercent },
    { key: 'packs', label: 'Pacchetti aperti', value: <AnimatedNumber value={game.stats.totalPacksOpened || 0} /> },
    { key: 'wins', label: 'Battaglie vinte', value: <AnimatedNumber value={game.stats.totalBattlesWon || 0} /> },
    { key: 'legend', label: 'Leggendarie', value: <AnimatedNumber value={game.stats.legendaryCount || 0} /> },
    { key: 'streak', label: 'Serie login', value: <AnimatedNumber value={game.loginStreak} /> }
  ];

  return (
    <section className="profile-page sp-page">
      <header className="sp-head">
        <PhantomTitle as="h2" text="Profilo" />
      </header>

      <div className="glass-panel profile-header sr-card">
        <div className="sr-avatar">
          <UserAvatar avatar={user.avatar} className="auth-profile-avatar" fallbackIcon="ph-vinyl-record" />
          <span className="sr-lv" aria-label={`Livello ${game.levelInfo.level}`}>
            <small aria-hidden="true">Lv</small><span aria-hidden="true">{game.levelInfo.level}</span>
          </span>
        </div>
        <div className="sr-id">
          <div className="auth-profile-username">{user.username}</div>
          <div className="auth-profile-email">{user.email}</div>
        </div>
        <button type="button" className="btn btn-secondary sr-logout" onClick={logout}><i className="ph ph-sign-out" /> Logout</button>
      </div>

      <div className="glass-panel sr-stats-panel">
        <h3 className="panel-title"><i className="ph-fill ph-chart-bar" /> Statistiche</h3>
        <dl className="sr-stats">
          {stats.map((s) => (
            <div key={s.key} className={`sr-stat${s.tone ? ` is-${s.tone}` : ''}`}>
              <dt>{s.label}{s.bar !== undefined && <span className="sr-stat-pct"> {s.bar}%</span>}</dt>
              <dd>{s.value}</dd>
              {s.bar !== undefined && (
                <span className="sr-stat-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(s.bar, s.bar > 0 ? 2 : 0))}%` }} /></span>
              )}
            </div>
          ))}
        </dl>
      </div>

      <div className="glass-panel avatar-picker-panel">
        <h3 className="panel-title"><i className="ph-fill ph-image" /> Scegli il tuo avatar</h3>
        {avatarError && <div className="auth-message auth-message-error">{avatarError}</div>}
        <div className="avatar-picker-grid">
          {AVATARS.map((avatar) => {
            const selected = user.avatar === avatar;
            return (
              <button
                key={avatar}
                type="button"
                className={`avatar-picker-item${selected ? ' selected' : ''}`}
                disabled={!!savingAvatar}
                onClick={() => handleSelectAvatar(avatar)}
                aria-pressed={selected}
                aria-label={`Seleziona ${avatar}`}
              >
                <img src={getAvatarUrl(avatar)} alt="" loading="lazy" />
                {selected && <span className="avatar-picker-check"><i className="ph-fill ph-check" /></span>}
                {savingAvatar === avatar && <span className="avatar-picker-spinner" />}
              </button>
            );
          })}
        </div>
      </div>

      <TwoFactorPanel onChange={refreshUser} />
      <InstallApp />
      <PhotoGallery />
    </section>
  );
}
