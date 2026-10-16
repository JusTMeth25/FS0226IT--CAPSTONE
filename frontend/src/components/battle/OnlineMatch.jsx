import { useEffect, useState } from 'react';
import CardTile from '../card/CardTile.jsx';
import RevealSpark from '../common/RevealSpark.jsx';
import { getRarityColor, getRarityCSSClass, resolveCardImage } from '../../utils/cardUtils.js';

const CATEGORIES = ['fans', 'style', 'influence', 'energy'];
const CATEGORY_NAMES = { fans: 'Fans', style: 'Style', influence: 'Influence', energy: 'Energy' };
const CATEGORY_ICONS = { fans: 'ph-microphone-stage', style: 'ph-palette', influence: 'ph-megaphone', energy: 'ph-lightning' };

/** Secondi rimasti a una scadenza del server, corretti per lo scarto fra i due orologi. */
function useSecondsLeft(deadline, clockOffset) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000));
}

function Header({ round, score, seconds, onForfeit, tournament }) {
  return (
    <div className="battle-round-header">
      <span className="battle-round-number">
        {tournament && <><i className="ph-fill ph-trophy" /> {tournament} · </>}
        {round ? `Round ${round} / 3` : tournament ? 'Partita del torneo' : 'Sfida online'}
      </span>
      <span className="battle-round-score">{score ? `${score.you} - ${score.opponent}` : ''}</span>
      {seconds != null && <span className="battle-online-timer"><i className="ph-fill ph-timer" /> {seconds}s</span>}
      {onForfeit && (
        <button type="button" className="btn btn-secondary btn-small" onClick={onForfeit} title="Abbandoni: perdi a tavolino">
          <i className="ph ph-flag" /> Abbandona
        </button>
      )}
    </div>
  );
}

/**
 * Sfida in tempo reale fra due giocatori nella pagina Battaglie, con le stesse schermate della
 * battaglia contro gli NPC: VS, scelta della categoria, scelta della carta (con l'abilita' +25%),
 * confronto del round e risultato finale. Le regole e i tempi li decide il server (PvpService):
 * la categoria del primo round la sceglie chi sfida, quella del secondo e' estratta, quella del
 * terzo la sceglie lo sfidato; le carte si giocano di nascosto e si scoprono insieme.
 */
export default function OnlineMatch({ pvp, clockOffset, send, myTeam, onExit }) {
  const opponent = pvp.opponent?.username || 'Avversario';
  const seconds = useSecondsLeft(pvp.deadline, clockOffset);
  const forfeit = () => send({ type: 'pvp_forfeit' });
  const cup = pvp.tournament || null;

  // ---------- VS: si aspetta che anche l'altro mandi la squadra ----------
  if (pvp.stage === 'team') {
    return (
      <section className="battle-vs-page">
        <div className="battle-vs-wrapper">
          <Header seconds={seconds} onForfeit={forfeit} tournament={cup} />
          <div className="battle-vs-content">
            <div className="battle-vs-player battle-vs-enter-left">
              <div className="battle-vs-avatar"><i className="ph-fill ph-vinyl-record" /></div>
              <h3>Il Tuo Team</h3>
              <div className="battle-vs-cards">
                {myTeam.filter(Boolean).map((c) => (
                  <div key={c.id} className={`battle-vs-mini ${getRarityCSSClass(c.rarity)}`}>
                    <div style={{ width: 30, height: 40, overflow: 'hidden', borderRadius: 4 }}>
                      <img src={resolveCardImage(c)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '0.55rem' }}>{c.name}</span>
                  </div>
                ))}
              </div>
              <span className="battle-vs-power">{pvp.teamSent ? <><i className="ph-fill ph-check" /> Squadra pronta</> : 'Invio la squadra…'}</span>
            </div>
            <div className="battle-vs-center">
              <span className="battle-vs-label">VS</span>
              <span className="battle-vs-round">{pvp.opponentReady ? 'Si comincia!' : `Aspetto che ${opponent} scelga la squadra…`}</span>
            </div>
            <div className="battle-vs-player battle-vs-ai battle-vs-enter-right">
              <div className="battle-vs-avatar"><i className="ph-fill ph-user" /></div>
              <h3>{opponent}</h3>
              <div className="battle-vs-cards">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="battle-vs-mini battle-vs-mystery">
                    <div className="battle-vs-mystery-icon"><i className="ph ph-question" /></div>
                    <span style={{ fontSize: '0.55rem' }}>???</span>
                  </div>
                ))}
              </div>
              <span className="battle-vs-power battle-vs-power-hidden">{pvp.opponentReady ? 'Squadra pronta' : 'Squadra nascosta'}</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------- ROUND: categoria, poi carta ----------
  if (pvp.stage === 'round') {
    if (!pvp.category) {
      if (pvp.chooser === 'you') {
        return (
          <section className="battle-round-page">
            <Header round={pvp.round} score={pvp.score} seconds={seconds} onForfeit={forfeit} tournament={cup} />
            <div className="glass-panel text-center">
              <h3>Scegli tu la categoria di questo round!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>Punta sul punto forte di una delle carte che ti restano.</p>
            </div>
            <div className="battle-category-pick-grid">
              {CATEGORIES.map((cat) => (
                <div key={cat} className="battle-category-pick-card" onClick={() => send({ type: 'pvp_category', category: cat })}>
                  <span className="battle-category-pick-name"><i className={`ph-fill ${CATEGORY_ICONS[cat]}`} /> {CATEGORY_NAMES[cat]}</span>
                </div>
              ))}
            </div>
          </section>
        );
      }
      return (
        <section className="battle-round-page">
          <Header round={pvp.round} score={pvp.score} seconds={seconds} onForfeit={forfeit} tournament={cup} />
          <div className="glass-panel text-center battle-online-wait">
            <h3>{pvp.chooser === 'server' ? 'Estraggo la categoria…' : `${opponent} sceglie la categoria…`}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {pvp.round === 2 ? 'Nel secondo round la categoria è a sorte.' : 'Nel primo round sceglie chi sfida, nel terzo chi è stato sfidato.'}
            </p>
          </div>
        </section>
      );
    }
    const team = pvp.team || [];
    const used = new Set(pvp.used || []);
    return (
      <section className="battle-round-page">
        <Header round={pvp.round} score={pvp.score} seconds={seconds} onForfeit={forfeit} tournament={cup} />
        <div className="battle-category-display glass-panel">
          <span className="battle-category-label">Categoria</span>
          <span className="battle-category-name">{CATEGORY_NAMES[pvp.category]}</span>
        </div>
        {pvp.picked ? (
          <div className="glass-panel text-center battle-online-wait">
            <h3>Hai giocato {team[pvp.pickedIndex]?.name}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{pvp.opponentPicked ? 'Anche l\'avversario ha scelto: si scoprono le carte…' : `Aspetto la carta di ${opponent}…`}</p>
          </div>
        ) : (
          <div className="battle-card-select">
            <h3>Scegli una carta per questo round:</h3>
            {pvp.opponentPicked && <p className="battle-opponent-hint">{opponent} ha già scelto la sua carta.</p>}
            <div className="battle-card-options">
              {team.map((card, i) => {
                if (used.has(i)) return null;
                const statValue = card.stats?.[pvp.category] || 0;
                return (
                  <div key={card.id + i} className="battle-card-wrap">
                    <CardTile card={card} onClick={() => send({ type: 'pvp_card', index: i, boost: false })} />
                    <div className="battle-pick-meta">
                      <span className="battle-stat-highlight"><i className={`ph-fill ${CATEGORY_ICONS[pvp.category]}`} /> {CATEGORY_NAMES[pvp.category]}: <strong>{statValue}</strong></span>
                      {card.synergy > 0 && <span className="battle-synergy-chip" title="Bonus di squadra"><i className="ph-fill ph-link" /> +{card.synergy}%</span>}
                      {!pvp.boostUsed && (
                        <button className="battle-special-btn-inline" onClick={(e) => { e.stopPropagation(); send({ type: 'pvp_card', index: i, boost: true }); }}>
                          <i className="ph-fill ph-sparkle" /> Abilità (+25%)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }

  // ---------- CONFRONTO DEL ROUND ----------
  if (pvp.stage === 'reveal' && pvp.reveal) {
    const r = pvp.reveal;
    const mine = r.you.card;
    const theirs = r.opponent.card;
    const playerWon = r.winner === 'you';
    const aiWon = r.winner === 'opponent';
    const myColor = getRarityColor(mine.rarity);
    const theirColor = getRarityColor(theirs.rarity);
    return (
      <section className="battle-round-result">
        <Header round={r.round} score={r.score} tournament={cup} />
        <div className="battle-comparison">
          <div className={`battle-comp-card battle-comp-enter-left ${playerWon ? 'battle-winner' : ''}`}>
            <div className="battle-comp-art">
              <img src={resolveCardImage(mine)} alt="" />
              {playerWon && <RevealSpark color={myColor} count={10} radius={38} />}
            </div>
            <span className="battle-comp-name" style={{ color: myColor }}>{mine.name}</span>
            <div className="battle-comp-stat">
              <span className="battle-comp-value" style={{ color: myColor }}>{r.you.value}</span>
              {r.you.boost && <span className="battle-bonus">+25% <i className="ph-fill ph-sparkle" /></span>}
              {playerWon && <span className="battle-badge-win">WIN</span>}
            </div>
          </div>
          <div className="battle-comp-vs">
            <span className="battle-comp-vs-text">VS</span>
            <span className="battle-comp-detail">{CATEGORY_NAMES[r.category]}</span>
          </div>
          <div className={`battle-comp-card battle-comp-enter-right ${aiWon ? 'battle-winner' : ''}`}>
            <div className="battle-comp-art">
              <img src={resolveCardImage(theirs)} alt="" />
              {aiWon && <RevealSpark color={theirColor} count={10} radius={38} />}
            </div>
            <span className="battle-comp-name" style={{ color: theirColor }}>{theirs.name}</span>
            <div className="battle-comp-stat">
              <span className="battle-comp-value" style={{ color: theirColor }}>{r.opponent.value}</span>
              {r.opponent.boost && <span className="battle-bonus">+25% <i className="ph-fill ph-sparkle" /></span>}
              {aiWon && <span className="battle-badge-win">WIN</span>}
            </div>
          </div>
        </div>
        <div className="battle-next-container">
          <p className="battle-opponent-hint">{r.round < 3 ? 'Il prossimo round parte fra un attimo…' : 'Ecco il risultato finale…'}</p>
        </div>
      </section>
    );
  }

  // ---------- RISULTATO FINALE ----------
  if (pvp.stage === 'end') {
    const won = pvp.result === 'win';
    const draw = pvp.result === 'draw';
    const icon = won ? 'ph-trophy' : draw ? 'ph-handshake' : 'ph-heart-break';
    const title = cup ? (won ? 'PASSI IL TURNO!' : 'ELIMINATO') : won ? 'VITTORIA!' : draw ? 'PAREGGIO!' : 'SCONFITTA!';
    const color = won ? 'var(--neon-gold)' : draw ? 'var(--neon-cyan)' : 'var(--text-secondary)';
    return (
      <section className="battle-final-page">
        <div className="battle-final-content glass-panel battle-final-enter">
          <div className="battle-final-icon"><i className={`ph-fill ${icon}`} /></div>
          <h2 className="battle-final-title" style={{ color }}>{title}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {cup ? `${cup} · ` : ''}Contro {opponent}{pvp.forfeit ? ' · a tavolino' : ''}{pvp.tiebreak ? ' · deciso dai punti totali' : ''}
          </p>
          <div className="battle-final-score">
            <span className="battle-final-score-you">{pvp.score?.you ?? 0}</span>
            <span className="battle-final-score-divider">-</span>
            <span className="battle-final-score-ai">{pvp.score?.opponent ?? 0}</span>
          </div>
          {pvp.reward && (
            <div className="battle-final-rewards">
              <span className="battle-reward-item"><i className="ph-fill ph-coins" /> +{pvp.reward.gold} gold</span>
              <span className="battle-reward-item"><i className="ph-fill ph-star" /> +{pvp.reward.xp} XP</span>
            </div>
          )}
          {pvp.reward?.capped && <p className="battle-opponent-hint">Hai già preso i premi delle sfide di oggi.</p>}
          <button className="btn btn-primary btn-large" style={{ marginTop: 'var(--space-md)' }} onClick={onExit}>
            <i className={`ph-fill ${cup ? 'ph-tree-structure' : 'ph-sword'}`} /> {cup ? 'Torna al tabellone' : 'Nuova Battaglia'}
          </button>
        </div>
      </section>
    );
  }
  return null;
}
