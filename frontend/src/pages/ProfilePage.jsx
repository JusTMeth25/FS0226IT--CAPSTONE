import { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useGame } from '../hooks/useGame.js';
import { CARDS } from '../data/cards.js';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const game = useGame();

  const uniqueCount = useMemo(() => new Set(game.collection.map((c) => c.id)).size, [game.collection]);
  const progressPercent = CARDS.length > 0 ? Math.round((uniqueCount / CARDS.length) * 100) : 0;

  return (
    <section className="profile-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-user-circle" /> Profilo</h2>

      <div className="glass-panel profile-header">
        <div className="auth-profile-avatar"><i className="ph-fill ph-vinyl-record" /></div>
        <div>
          <div className="auth-profile-username">{user.username}</div>
          <div className="auth-profile-email">{user.email}</div>
        </div>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={logout}>Logout</button>
      </div>

      <div className="profile-stats-grid">
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.levelInfo.level}</span>
          <span className="profile-stat-label">Livello</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.gold}</span>
          <span className="profile-stat-label">Gold</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{uniqueCount}/{CARDS.length}</span>
          <span className="profile-stat-label">Album ({progressPercent}%)</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.stats.totalPacksOpened || 0}</span>
          <span className="profile-stat-label">Pacchetti aperti</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.stats.totalBattlesWon || 0}</span>
          <span className="profile-stat-label">Battaglie vinte</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.stats.legendaryCount || 0}</span>
          <span className="profile-stat-label">Leggendarie</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.favorites.length}</span>
          <span className="profile-stat-label">Preferite</span>
        </div>
        <div className="glass-panel profile-stat-box">
          <span className="profile-stat-value">{game.loginStreak}</span>
          <span className="profile-stat-label">Serie login</span>
        </div>
      </div>
    </section>
  );
}
