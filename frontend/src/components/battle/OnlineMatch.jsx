import { useEffect, useState } from 'react';
import '../../styles/pages/game-battle.css';
import { m } from 'motion/react';
import CardTile from '../card/CardTile.jsx';
import { getRarityCSSClass, resolveCardImage } from '../../utils/cardUtils.js';
import RoundClash from './RoundClash.jsx';
import { FinalTitle, ResultBackdrop, SlamIn } from './PhantomFx.jsx';
import { FROM_LEFT, FROM_RIGHT, impactProps } from './phantomMotion.js';

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
            <m.div className="battle-vs-player" {...FROM_LEFT}>
              <div className="battle-vs-avatar"><i className="ph-fill ph-vinyl-record" /></div>
              <h3>Il Tuo Team</h3>
              <div className="battle-vs-cards">
                {myTeam.filter(Boolean).map((c) => (
                  <div key={c.id} className={`battle-vs-mini ${getRarityCSSClass(c.rarity)}`}>
                    <div className="battle-vs-thumb">
                      <img src={resolveCardImage(c)} alt="" />
                    </div>
                    <span className="battle-vs-mini-name">{c.name}</span>
                  </div>
                ))}
              </div>
              <span className="battle-vs-power">{pvp.teamSent ? <><i className="ph-fill ph-check" /> Squadra pronta</> : 'Invio la squadra…'}</span>
            </m.div>
            <div className="battle-vs-center">
              <SlamIn className="battle-vs-label" delay={0.14} tilt={-8}>VS</SlamIn>
              <span className="battle-vs-round">{pvp.opponentReady ? 'Si comincia!' : `Aspetto che ${opponent} scelga la squadra…`}</span>
            </div>
            <m.div className="battle-vs-player battle-vs-ai" {...FROM_RIGHT}>
              <div className="battle-vs-avatar"><i className="ph-fill ph-user" /></div>
              <h3>{opponent}</h3>
              <div className="battle-vs-cards">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="battle-vs-mini battle-vs-mystery">
                    <div className="battle-vs-mystery-icon"><i className="ph ph-question" /></div>
                    <span className="battle-vs-mini-name">???</span>
                  </div>
                ))}
              </div>
              <span className="battle-vs-power battle-vs-power-hidden">{pvp.opponentReady ? 'Squadra pronta' : 'Squadra nascosta'}</span>
            </m.div>
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
            <div className="glass-panel text-center battle-round-prompt">
              <h3>Scegli tu la categoria di questo round!</h3>
              <p>Punta sul punto forte di una delle carte che ti restano.</p>
            </div>
            <div className="battle-category-pick-grid">
              {CATEGORIES.map((cat) => (
                <button type="button" key={cat} className="battle-category-pick-card" onClick={() => send({ type: 'pvp_category', category: cat })}>
                  <i className={`ph-fill ${CATEGORY_ICONS[cat]}`} aria-hidden="true" />
                  <span className="battle-category-pick-name">{CATEGORY_NAMES[cat]}</span>
                </button>
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
            <p className="battle-online-wait-text">
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
          <span className="battle-category-name"><i className={`ph-fill ${CATEGORY_ICONS[pvp.category]}`} aria-hidden="true" /> {CATEGORY_NAMES[pvp.category]}</span>
        </div>
        {pvp.picked ? (
          <div className="glass-panel text-center battle-online-wait">
            <h3>Hai giocato {team[pvp.pickedIndex]?.name}</h3>
            <p className="battle-online-wait-text">{pvp.opponentPicked ? 'Anche l\'avversario ha scelto: si scoprono le carte…' : `Aspetto la carta di ${opponent}…`}</p>
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
                        <button type="button" className="battle-special-btn-inline" onClick={(e) => { e.stopPropagation(); send({ type: 'pvp_card', index: i, boost: true }); }}>
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
    return (
      <section className="battle-round-result">
        <Header round={r.round} score={r.score} tournament={cup} />
        <RoundClash
          category={CATEGORY_NAMES[r.category]}
          winner={playerWon ? 'you' : aiWon ? 'opponent' : null}
          you={{ label: 'Tu', card: mine, value: r.you.value, bonus: r.you.boost ? '+25%' : null }}
          opponent={{ label: opponent, card: theirs, value: r.opponent.value, bonus: r.opponent.boost ? '+25%' : null }}
        />
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
    const tone = won ? 'win' : draw ? 'draw' : 'lose';
    return (
      <section className={`battle-final-page is-${tone}`}>
        <ResultBackdrop tone={tone} />
        <m.div className="battle-final-content glass-panel" {...impactProps(won)}>
          <div className="battle-final-icon"><i className={`ph-fill ${icon}`} /></div>
          <FinalTitle tone={tone} text={title} />
          <p className="battle-final-sub">
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
          <button className="btn btn-primary btn-large battle-final-next" onClick={onExit}>
            <i className={`ph-fill ${cup ? 'ph-tree-structure' : 'ph-sword'}`} /> {cup ? 'Torna al tabellone' : 'Nuova Battaglia'}
          </button>
        </m.div>
      </section>
    );
  }
  return null;
}
