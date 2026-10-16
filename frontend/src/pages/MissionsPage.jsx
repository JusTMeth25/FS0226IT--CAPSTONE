import { useGame } from '../hooks/useGame.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { missionApi } from '../services/missionApi.js';
import { todayString } from '../utils/missionUtils.js';
import { useState } from 'react';
import { m } from 'motion/react';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import StarBurst from '../components/phantom/StarBurst.jsx';
import '../styles/pages/game-ranks.css';

function missionGroup(missionId) {
  if (missionId.startsWith('daily-')) return 'daily';
  if (missionId.startsWith('weekly-')) return 'weekly';
  return 'progress';
}

function MissionRow({ mission, onClaim }) {
  // Il timbro "Ritirata!" piomba solo sulla missione appena ritirata, non su quelle gia' vecchie.
  const [justClaimed, setJustClaimed] = useState(false);
  const progress = Math.min(mission.progress, mission.target);
  const percent = mission.target > 0 ? Math.round((progress / mission.target) * 100) : 0;
  const completed = progress >= mission.target;

  return (
    <div className={`missions-item ${completed ? 'missions-completed' : ''} ${mission.claimed ? 'missions-claimed' : ''}`}>
      <span className="missions-item-icon">
        <i className={`ph-fill ${mission.claimed ? 'ph-check-circle' : completed ? mission.icon || 'ph-target' : 'ph-lock'}`} />
      </span>
      <div className="missions-item-info">
        <span className="missions-item-title">{mission.title}</span>
        <span className="missions-item-desc">{mission.description}</span>
        <div className="missions-item-progress">
          <div className="missions-item-bar"><div className="missions-item-fill" style={{ width: `${percent}%` }} /></div>
          <span className="missions-item-text">{progress}/{mission.target}</span>
        </div>
      </div>
      <div className="missions-item-rewards">
        {mission.rewardGold > 0 && <span className="missions-reward"><i className="ph-fill ph-coin" /> {mission.rewardGold}</span>}
        {mission.rewardXP > 0 && <span className="missions-reward"><i className="ph-fill ph-lightning" /> {mission.rewardXP}</span>}
        {mission.pack && <span className="missions-reward"><i className="ph-fill ph-gift" /> {mission.pack === 'pack-premium' ? 'Premium' : 'Deluxe'}</span>}
        {completed && !mission.claimed && (
          <button className="btn btn-gold btn-small" onClick={() => { setJustClaimed(true); onClaim(mission); }}>Reclama</button>
        )}
        {mission.claimed && <span className="missions-claimed-badge">Reclamato</span>}
      </div>
      {completed && !mission.claimed && <span className="missions-done-tag">Completata!</span>}
      {mission.claimed && justClaimed && (
        <m.span
          className="missions-stamp"
          aria-hidden="true"
          initial={{ scale: 2.2, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -10, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 22 }}
        >
          <StarBurst size={34} fill="var(--neon-gold)" stroke="#000" /> Ritirata!
        </m.span>
      )}
    </div>
  );
}

export default function MissionsPage() {
  const game = useGame();

  // Le missioni arrivano sempre dal server: la pagina e' raggiungibile solo da
  // autenticati, quindi non esiste piu' un elenco generato in locale.
  const server = useApiResource(() => missionApi.getMissions(), [game.collection, game.stats]);
  const missions = server.data?.missions || [];

  const canClaimLogin = game.lastLoginDate !== todayString();

  async function handleClaim(mission) {
    await game.claimMission(mission);
    server.reload({ silent: true });
  }

  async function handleClaimLogin() {
    await game.claimLoginReward();
    server.reload({ silent: true });
  }

  return (
    <section className="missions-page">
      <PhantomTitle text="Missioni" className="game-page-title" />

      <div className="missions-level-card glass-panel">
        <div className="missions-level-top">
          <div className="missions-level-info">
            <span className="missions-level-label">LIVELLO</span>
            <span className="missions-level-number">{game.levelInfo.level}</span>
          </div>
          <div className="missions-level-stats">
            <div className="missions-level-stat"><span><i className="ph-fill ph-coin" /></span><span>{game.gold}</span></div>
            <div className="missions-level-stat"><span><i className="ph-fill ph-lightning" /></span><span>{game.xp} XP</span></div>
          </div>
        </div>
        <div className="missions-xp-bar-container">
          <div className="missions-xp-bar"><div className="missions-xp-fill" style={{ width: `${game.levelInfo.xpForNext > 0 ? Math.round((game.levelInfo.xpRemaining / game.levelInfo.xpForNext) * 100) : 100}%` }} /></div>
          <span className="missions-xp-text">{game.levelInfo.xpRemaining} / {game.levelInfo.xpForNext} XP</span>
        </div>

      </div>

      {/* Un bottone vero (tastiera, controller); disattivato quando il premio di oggi e' gia' preso. */}
      <button type="button" className={`missions-login-card glass-panel ${canClaimLogin ? 'missions-login-available' : ''}`}
        disabled={!canClaimLogin} onClick={handleClaimLogin}>
        <span className="missions-login-icon"><i className={`ph-fill ${canClaimLogin ? 'ph-gift' : 'ph-check-circle'}`} /></span>
        <div className="missions-login-info">
          <span className="missions-login-title">Login Giornaliero</span>
          <span className="missions-login-desc">{canClaimLogin ? 'Clicca per ritirare la tua ricompensa giornaliera!' : 'Già reclamato oggi. Torna domani!'}</span>
        </div>
        <span className="missions-login-streak"><i className="ph-fill ph-fire" /> Giorno {game.loginStreak + (canClaimLogin ? 1 : 0)}</span>
      </button>

      {server.loading ? (
        <LoadingSpinner label="Carico le missioni…" />
      ) : (
        ['daily', 'weekly', 'progress'].map((type) => (
          <div className="glass-panel missions-group" key={type}>
            <h3 className="missions-section-title">
              <i className={`ph-fill ${type === 'daily' ? 'ph-calendar' : type === 'weekly' ? 'ph-calendar-dots' : 'ph-trophy'}`} />
              {' '}{type === 'daily' ? 'Daily' : type === 'weekly' ? 'Settimanali' : 'Progresso'}
            </h3>
            <div className="missions-list">
              {missions
                .filter((m) => missionGroup(m.id) === type)
                .map((m) => (
                  <MissionRow key={m.id} mission={m} onClaim={handleClaim} />
                ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
