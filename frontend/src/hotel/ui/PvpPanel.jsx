import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../hooks/useGame.js';
import { dedupeCollection } from '../../utils/collectionUtils.js';
import SavedTeams from '../../components/card/SavedTeams.jsx';
import { RARITIES, SOURCE_LABELS, getRarityColor, getSourceLabel, getTotalScore, resolveCardImage } from '../../utils/cardUtils.js';

const CATEGORIES = [
  { key: 'fans', label: 'Fans', icon: 'ph-users-three' },
  { key: 'style', label: 'Style', icon: 'ph-star' },
  { key: 'influence', label: 'Influence', icon: 'ph-megaphone' },
  { key: 'energy', label: 'Energy', icon: 'ph-lightning' }
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

/** Secondi rimasti fino a una scadenza del server, corretti per lo scarto fra i due orologi. */
function useCountdown(deadline, clockOffset) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000));
}

function MiniCard({ card, highlight, value, boost, dim, selected, onClick }) {
  return (
    <button
      type="button"
      className={`pvp-card${dim ? ' used' : ''}${selected ? ' selected' : ''}`}
      style={{ '--rarity-color': getRarityColor(card.rarity) }}
      onClick={onClick}
      disabled={!onClick || dim}
    >
      <img src={resolveCardImage(card)} alt={card.name} loading="lazy" />
      <span className="pvp-card-name">{card.name}</span>
      {highlight && (
        <span className="pvp-card-stat">{CATEGORY_LABEL[highlight]} <strong>{value ?? card.stats?.[highlight] ?? 0}</strong>{boost && ' ⚡'}</span>
      )}
    </button>
  );
}

/**
 * Pannello della sfida fra giocatori. Lo stato arriva tutto dal server (pvp_* nei messaggi):
 * qui si mostra e si inviano solo le scelte. Chi decide chi vince e' sempre il server.
 */
export default function PvpPanel({ pvp, clockOffset, send, onClose }) {
  const { collection, refreshCollection } = useGame();
  const [team, setTeam] = useState([]);
  // Si sceglie fra le carte di adesso, comprese quelle prese nell'hotel dopo l'accesso.
  const choosing = pvp?.stage === 'team';
  useEffect(() => {
    if (choosing) refreshCollection?.();
  }, [choosing, refreshCollection]);
  // Il bonus scelto vale solo per il round in cui lo si attiva: al round dopo torna spento.
  const [boostChoice, setBoostChoice] = useState({ round: 0, on: false });
  const boost = boostChoice.on && boostChoice.round === pvp?.round;
  const setBoost = (on) => setBoostChoice({ round: pvp?.round, on });
  const countdown = useCountdown(pvp?.deadline, clockOffset);
  // La sfida in arrivo ha un suo conto alla rovescia (in ora locale): allo scadere il popup si
  // chiude da solo, anche se il messaggio di scadenza del server non dovesse arrivare.
  const incomingLeft = useCountdown(pvp?.stage === 'incoming' ? pvp.expiresAt : null, 0);
  useEffect(() => {
    if (incomingLeft === 0) onClose();
  }, [incomingLeft, onClose]);

  // Stessi filtri della pagina Battaglie: nome, rarita' e fonte.
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('');
  const [source, setSource] = useState('');
  const allCards = useMemo(() => dedupeCollection(collection)
    .filter((c) => c.stats)
    .sort((a, b) => getTotalScore(b) - getTotalScore(a)), [collection]);
  const sources = useMemo(() => {
    const present = new Set(allCards.map((c) => c.source).filter(Boolean));
    return Object.keys(SOURCE_LABELS).filter((key) => present.has(key));
  }, [allCards]);
  const myCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCards.filter((c) => (!rarity || c.rarity === rarity) && (!source || c.source === source)
      && (!q || c.name.toLowerCase().includes(q)));
  }, [allCards, search, rarity, source]);

  if (!pvp) return null;

  if (pvp.stage === 'incoming') {
    return (
      <div className="hotel-panel pvp-panel pvp-incoming" role="alertdialog" aria-label="Sfida in arrivo">
        <header className="hotel-panel-header">
          <h3><i className="ph-fill ph-sword" /> Sfida!</h3>
          {incomingLeft !== null && <span className={`pvp-timer${incomingLeft <= 5 ? ' urgent' : ''}`}>{incomingLeft}s</span>}
        </header>
        <p className="pvp-text"><strong>{pvp.from.username}</strong> ti sfida a una battaglia di carte.</p>
        <div className="pvp-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => send({ type: 'challenge_reply', challengeId: pvp.challengeId, accept: false })}>Rifiuta</button>
          <button type="button" className="btn btn-primary btn-small" onClick={() => send({ type: 'challenge_reply', challengeId: pvp.challengeId, accept: true })}>
            <i className="ph-fill ph-sword" /> Accetta
          </button>
        </div>
      </div>
    );
  }

  if (pvp.stage === 'sent') {
    return (
      <div className="hotel-panel pvp-panel pvp-incoming" role="status">
        <header className="hotel-panel-header"><h3><i className="ph-fill ph-hourglass" /> Sfida inviata</h3></header>
        <p className="pvp-text">Aspetto la risposta di <strong>{pvp.to.username}</strong>…</p>
      </div>
    );
  }

  const header = (
    <header className="hotel-panel-header">
      <h3><i className="ph-fill ph-sword" /> Tu contro {pvp.opponent?.username}</h3>
      {pvp.stage !== 'end' && countdown !== null && <span className={`pvp-timer${countdown <= 5 ? ' urgent' : ''}`}>{countdown}s</span>}
      {pvp.stage !== 'end' && (
        <button type="button" className="hotel-panel-close" onClick={() => send({ type: 'pvp_forfeit' })} title="Abbandona (perdi a tavolino)" aria-label="Abbandona"><i className="ph ph-flag" /></button>
      )}
    </header>
  );

  const scoreBar = pvp.score && (
    <div className="pvp-score">
      <span>Round {Math.min(pvp.round || 1, 3)} di 3</span>
      <strong>Tu {pvp.score.you} – {pvp.score.opponent} {pvp.opponent?.username}</strong>
    </div>
  );

  if (pvp.stage === 'team') {
    const toggle = (card) => setTeam((t) => (t.some((c) => c.id === card.id)
      ? t.filter((c) => c.id !== card.id)
      : t.length < 3 ? [...t, card] : t));
    return (
      <div className="hotel-panel pvp-panel" role="dialog" aria-label="Scegli la squadra">
        {header}
        <p className="pvp-text">{pvp.teamSent ? 'Squadra pronta! Aspetto l\'avversario…' : 'Scegli 3 carte per la tua squadra.'}{pvp.opponentReady && ' L\'avversario e\' pronto.'}</p>
        {!pvp.teamSent && (
          <>
            <SavedTeams compact cards={allCards} team={team} onLoad={setTeam} />
            <div className="pvp-filters">
              <input className="pvp-filter" type="search" placeholder="Cerca per nome…" value={search}
                onChange={(e) => setSearch(e.target.value)} aria-label="Cerca per nome" />
              <select className="pvp-filter" value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Rarita'">
                <option value="">Tutte le rarità</option>
                {Object.entries(RARITIES).map(([key, r]) => <option key={key} value={key}>{r.name}</option>)}
              </select>
              {sources.length > 1 && (
                <select className="pvp-filter" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Fonte">
                  <option value="">Tutte le fonti</option>
                  {sources.map((key) => <option key={key} value={key}>{getSourceLabel(key)}</option>)}
                </select>
              )}
              <span className="pvp-hint">{myCards.length}/{allCards.length}</span>
            </div>
            {team.length > 0 && (
              <div className="pvp-team-picked">
                {team.map((card) => <MiniCard key={card.id} card={card} selected onClick={() => toggle(card)} />)}
              </div>
            )}
            <div className="pvp-grid">
              {myCards.length === 0 && <p className="pvp-text">Nessuna carta con questi filtri.</p>}
              {myCards.slice(0, 150).map((card) => (
                <MiniCard key={card.id} card={card} selected={team.some((c) => c.id === card.id)} onClick={() => toggle(card)} />
              ))}
            </div>
            <div className="pvp-actions">
              <span className="pvp-hint">{team.length}/3</span>
              <button type="button" className="btn btn-primary btn-small" disabled={team.length !== 3}
                onClick={() => send({ type: 'pvp_team', cards: team.map((c) => c.id) })}>
                <i className="ph-fill ph-check" /> Conferma squadra
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (pvp.stage === 'round') {
    const choosing = !pvp.category && pvp.chooser === 'you';
    return (
      <div className="hotel-panel pvp-panel" role="dialog" aria-label="Round">
        {header}
        {scoreBar}
        {!pvp.category && (
          choosing ? (
            <>
              <p className="pvp-text">Scegli tu la categoria di questo round.</p>
              <div className="pvp-categories">
                {CATEGORIES.map((c) => (
                  <button key={c.key} type="button" className="btn btn-secondary btn-small" onClick={() => send({ type: 'pvp_category', category: c.key })}>
                    <i className={`ph-fill ${c.icon}`} /> {c.label}
                  </button>
                ))}
              </div>
            </>
          ) : <p className="pvp-text">{pvp.opponent?.username} sta scegliendo la categoria…</p>
        )}
        {pvp.category && (
          <>
            <p className="pvp-text">Categoria: <strong>{CATEGORY_LABEL[pvp.category]}</strong>. {pvp.picked ? 'Carta scelta, aspetto l\'avversario…' : 'Gioca una carta.'}{pvp.opponentPicked && ' L\'avversario ha gia\' scelto.'}</p>
            <div className="pvp-hand">
              {(pvp.team || []).map((card, i) => (
                <MiniCard
                  key={card.id}
                  card={card}
                  highlight={pvp.category}
                  dim={pvp.used?.includes(i) || pvp.picked}
                  selected={pvp.pickedIndex === i}
                  onClick={pvp.picked ? null : () => send({ type: 'pvp_card', index: i, boost })}
                />
              ))}
            </div>
            {!pvp.boostUsed && !pvp.picked && (
              <label className="pvp-boost">
                <input type="checkbox" checked={boost} onChange={(e) => setBoost(e.target.checked)} />
                <i className="ph-fill ph-lightning" /> Usa il bonus +25% (una volta per partita)
              </label>
            )}
          </>
        )}
      </div>
    );
  }

  if (pvp.stage === 'reveal') {
    const r = pvp.reveal;
    return (
      <div className="hotel-panel pvp-panel" role="dialog" aria-label="Risultato del round">
        {header}
        {scoreBar}
        <p className="pvp-text pvp-verdict">
          {r.winner === 'you' ? 'Round vinto!' : r.winner === 'opponent' ? 'Round perso' : 'Pareggio'} · {CATEGORY_LABEL[r.category]}
        </p>
        <div className="pvp-versus">
          <div className={r.winner === 'you' ? 'winner' : ''}><span>Tu</span><MiniCard card={r.you.card} highlight={r.category} value={r.you.value} boost={r.you.boost} /></div>
          <strong>VS</strong>
          <div className={r.winner === 'opponent' ? 'winner' : ''}><span>{pvp.opponent?.username}</span><MiniCard card={r.opponent.card} highlight={r.category} value={r.opponent.value} boost={r.opponent.boost} /></div>
        </div>
      </div>
    );
  }

  // Fine partita.
  const titles = { win: 'Hai vinto!', loss: 'Hai perso', draw: 'Pareggio' };
  return (
    <div className="hotel-panel pvp-panel" role="dialog" aria-label="Fine partita">
      <header className="hotel-panel-header"><h3><i className="ph-fill ph-trophy" /> {titles[pvp.result]}</h3></header>
      <p className="pvp-text pvp-verdict">Tu {pvp.score?.you} – {pvp.score?.opponent} {pvp.opponent?.username}{pvp.forfeit ? ' (a tavolino)' : ''}</p>
      {pvp.reward && (pvp.reward.capped
        ? <p className="pvp-text">Limite giornaliero raggiunto: questa partita non da&apos; ricompense (5 al giorno, 2 contro lo stesso avversario).</p>
        : <p className="pvp-text pvp-reward"><i className="ph-fill ph-coin" /> +{pvp.reward.gold} gold · <i className="ph-fill ph-star" /> +{pvp.reward.xp} XP</p>)}
      <div className="pvp-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={onClose}>Chiudi</button>
      </div>
    </div>
  );
}
