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

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const game = useGame();
  const [savingAvatar, setSavingAvatar] = useState(null);
  const [avatarError, setAvatarError] = useState(null);

  // Per gli utenti autenticati il totale reale del catalogo (tutte le fonti) arriva dal server;
  // in modalità ospite l'unico universo possibile resta il catalogo statico locale (43 carte).
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

  return (
    <section className="profile-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-user-circle" /> Profilo</h2>

      <div className="glass-panel profile-header">
        <UserAvatar avatar={user.avatar} className="auth-profile-avatar" fallbackIcon="ph-vinyl-record" />
        <div>
          <div className="auth-profile-username">{user.username}</div>
          <div className="auth-profile-email">{user.email}</div>
        </div>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={logout}>Logout</button>
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
                {selected && <span className="avatar-picker-check"><i className="ph-fill ph-check-circle" /></span>}
                {savingAvatar === avatar && <span className="avatar-picker-spinner" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.levelInfo.level} /></span>
          <span className="profile-stat-label">Livello</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.gold} /></span>
          <span className="profile-stat-label">Gold</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={uniqueCount} />/{totalCatalogCards}</span>
          <span className="profile-stat-label">Album ({progressPercent}%)</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.stats.totalPacksOpened || 0} /></span>
          <span className="profile-stat-label">Pacchetti aperti</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.stats.totalBattlesWon || 0} /></span>
          <span className="profile-stat-label">Battaglie vinte</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.stats.legendaryCount || 0} /></span>
          <span className="profile-stat-label">Leggendarie</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.favorites.length} /></span>
          <span className="profile-stat-label">Preferite</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value"><AnimatedNumber value={game.loginStreak} /></span>
          <span className="profile-stat-label">Serie login</span>
        </div>
      </div>
      <InstallApp />
      <PhotoGallery />
    </section>
  );
}
