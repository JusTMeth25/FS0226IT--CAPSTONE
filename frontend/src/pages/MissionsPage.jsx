import { useMemo } from 'react';
import { useGame } from '../hooks/useGame.js';
import { generateMissions, todayString } from '../utils/missionUtils.js';

function MissionRow({ mission, onClaim }) {
  const progress = Math.min(mission.progress, mission.target);
  const percent = mission.target > 0 ? Math.round((progress / mission.target) * 100) : 0;
  const completed = progress >= mission.target;

  return (
    <div className={`missions-item ${completed ? 'missions-completed' : ''} ${mission.claimed ? 'missions-claimed' : ''}`}>
      <span className="missions-item-icon">
        <i className={`ph-fill ${mission.claimed ? 'ph-check-circle' : completed ? mission.icon : 'ph-lock'}`} />
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
        {completed && !mission.claimed && <button className="btn btn-gold btn-small" onClick={() => onClaim(mission)}>Reclama</button>}
        {mission.claimed && <span className="missions-claimed-badge">Reclamato</span>}
      </div>
    </div>
  );
}

export default function MissionsPage() {
  const game = useGame();
  const missions = useMemo(() => generateMissions(game), [game]);

  const unclaimedLevels = useMemo(() => {
    const result = [];
    for (let lv = 1; lv < game.levelInfo.level; lv++) {
      if (!game.claimedLevelRewards.includes(lv)) result.push(lv);
    }
    return result;
  }, [game.levelInfo.level, game.claimedLevelRewards]);

  const canClaimLogin = game.lastLoginDate !== todayString();

  return (
    <section className="missions-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-target" /> Missioni e Livelli</h2>

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

        {unclaimedLevels.length > 0 && (
          <div className="missions-level-rewards">
            <span><i className="ph-fill ph-gift" /> Ricompense livello da reclamare:</span>
            {unclaimedLevels.map((lv) => (
              <button key={lv} className="btn btn-gold btn-small" onClick={() => game.claimLevelReward(lv)}>Livello {lv} — Reclama</button>
            ))}
          </div>
        )}
      </div>

      <div className={`missions-login-card glass-panel ${canClaimLogin ? 'missions-login-available' : ''}`} onClick={() => canClaimLogin && game.claimLoginReward()}>
        <span className="missions-login-icon"><i className={`ph-fill ${canClaimLogin ? 'ph-gift' : 'ph-check-circle'}`} /></span>
        <div className="missions-login-info">
          <span className="missions-login-title">Login Giornaliero</span>
          <span className="missions-login-desc">{canClaimLogin ? 'Clicca per ritirare la tua ricompensa giornaliera!' : 'Già reclamato oggi. Torna domani!'}</span>
        </div>
        <span className="missions-login-streak"><i className="ph-fill ph-fire" /> Giorno {game.loginStreak + (canClaimLogin ? 1 : 0)}</span>
      </div>

      {['daily', 'weekly', 'progress'].map((type) => (
        <div className="glass-panel" key={type}>
          <h3 className="missions-section-title">
            <i className={`ph-fill ${type === 'daily' ? 'ph-calendar' : type === 'weekly' ? 'ph-calendar-dots' : 'ph-trophy'}`} />
            {' '}{type === 'daily' ? 'Daily' : type === 'weekly' ? 'Settimanali' : 'Progresso'}
          </h3>
          <div className="missions-list">
            {missions.filter((m) => m.type === type).map((m) => (
              <MissionRow key={m.id} mission={m} onClaim={game.claimMission} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
