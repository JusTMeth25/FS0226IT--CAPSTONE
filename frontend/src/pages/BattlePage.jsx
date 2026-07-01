import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { getRarityCSSClass, getRarityColor, getTotalScore, resolveCardImage } from '../utils/cardUtils.js';
import { CARDS } from '../data/cards.js';
import EmptyState from '../components/common/EmptyState.jsx';

const CATEGORIES = ['fans', 'style', 'influence', 'energy'];
const CATEGORY_NAMES = { fans: 'Fans', style: 'Style', influence: 'Influence', energy: 'Energy' };
const CATEGORY_ICONS = { fans: 'ph-microphone-stage', style: 'ph-palette', influence: 'ph-megaphone', energy: 'ph-lightning' };
const DIFFICULTY_CONFIG = {
  easy: { label: 'Facile', smart: false, boost: 1, gold: 30, xp: 60 },
  normal: { label: 'Normale', smart: true, boost: 1, gold: 60, xp: 120 },
  hard: { label: 'Difficile', smart: true, boost: 1.15, gold: 100, xp: 200 }
};
const TOURNAMENT_ORDER = ['easy', 'normal', 'hard'];

function uniqueCollectionCards(collection) {
  const seen = new Set();
  const result = [];
  [...collection].reverse().forEach((c) => {
    if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
  });
  return result;
}

function generateAiTeam(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty];
  const used = new Set();
  const team = [];
  for (let i = 0; i < 3; i++) {
    let card;
    do { card = CARDS[Math.floor(Math.random() * CARDS.length)]; } while (used.has(card.id));
    used.add(card.id);
    const stats = { ...card.stats };
    if (config.boost !== 1) CATEGORIES.forEach((s) => { stats[s] = Math.round((stats[s] || 0) * config.boost); });
    team.push({ ...card, stats });
  }
  return team;
}

function MiniCard({ card }) {
  return (
    <div className={`battle-slot-card ${getRarityCSSClass(card.rarity)}`}>
      <span className="card-rarity-badge" style={{ fontSize: '0.5rem' }}>{card.rarity}</span>
      <div className="battle-slot-art"><img src={resolveCardImage(card)} alt={card.name} /></div>
      <div className="battle-slot-info">
        <span className="battle-slot-name">{card.name}</span>
        <span className="battle-slot-total"><i className="ph-fill ph-lightning" />{getTotalScore(card)}</span>
      </div>
    </div>
  );
}

const INITIAL_BATTLE = {
  phase: 'select',
  team: [null, null, null],
  selectedSlot: 0,
  difficulty: 'normal',
  aiTeam: [],
  roundScores: { player: 0, ai: 0 },
  currentRound: 1,
  currentCategory: null,
  playerCard: null,
  aiCard: null,
  lastBonus: 0,
  specialUsed: false,
  usedPlayerIndices: [],
  usedAiIndices: [],
  roundHistory: [],
  tournamentMode: false,
  tournamentStage: 0,
  tournamentGold: 0,
  tournamentXP: 0,
  finalKind: null,
  rewards: { gold: 0, xp: 0 }
};

export default function BattlePage() {
  const game = useGame();
  const { sound } = useSound();
  const navigate = useNavigate();
  const [b, setB] = useState(INITIAL_BATTLE);

  const collectionCards = useMemo(() => uniqueCollectionCards(game.collection), [game.collection]);

  if (collectionCards.length < 3) {
    return (
      <section className="battle-page">
        <h2 className="section-title text-gradient"><i className="ph-fill ph-sword" /> Battaglia PvP</h2>
        <EmptyState
          icon="ph-sword"
          title="Non abbastanza carte!"
          description={`Ti servono almeno 3 carte uniche per formare una squadra. Al momento ne hai ${collectionCards.length}.`}
          action={<button className="btn btn-primary" onClick={() => navigate('/packs')}><i className="ph-fill ph-gift" /> Apri Pacchetti</button>}
        />
      </section>
    );
  }

  function update(patch) {
    setB((prev) => ({ ...prev, ...patch }));
  }

  function selectSlot(i) { update({ selectedSlot: i }); }

  function addToTeam(card) {
    if (b.team.some((t) => t && t.id === card.id)) return;
    const team = [...b.team];
    team[b.selectedSlot] = card;
    const nextEmpty = team.findIndex((t) => !t);
    setB((prev) => ({ ...prev, team, selectedSlot: nextEmpty >= 0 ? nextEmpty : prev.selectedSlot }));
  }

  function removeFromTeam(index) {
    const team = [...b.team];
    team[index] = null;
    update({ team, selectedSlot: index });
  }

  function startMatch(difficulty, extra = {}) {
    setB((prev) => ({
      ...prev,
      ...extra,
      difficulty,
      aiTeam: generateAiTeam(difficulty),
      phase: 'vs',
      currentRound: 1,
      roundScores: { player: 0, ai: 0 },
      specialUsed: false,
      usedPlayerIndices: [],
      usedAiIndices: [],
      roundHistory: []
    }));
  }

  function startBattle() {
    if (b.team.filter(Boolean).length < 3) return;
    startMatch('normal', { tournamentMode: false, tournamentStage: 0, tournamentGold: 0, tournamentXP: 0 });
  }

  function startTournament() {
    if (b.team.filter(Boolean).length < 3) return;
    startMatch(TOURNAMENT_ORDER[0], { tournamentMode: true, tournamentStage: 0, tournamentGold: 0, tournamentXP: 0 });
  }

  function startRound() {
    const playerPicksCategory = b.currentRound % 2 === 1;
    if (playerPicksCategory) {
      update({ phase: 'category', currentCategory: null, playerCard: null, aiCard: null });
    } else {
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      update({ phase: 'select-card', currentCategory: category, playerCard: null, aiCard: null });
    }
  }

  function chooseCategory(category) {
    update({ currentCategory: category, phase: 'select-card' });
  }

  function pickAiCard(currentCategory, usedAiIndices) {
    const config = DIFFICULTY_CONFIG[b.difficulty];
    const available = b.aiTeam.map((_, i) => i).filter((i) => !usedAiIndices.includes(i));
    let chosen;
    if (config.smart) {
      chosen = available.reduce((best, i) => {
        const val = b.aiTeam[i].stats[currentCategory] || 0;
        const bestVal = b.aiTeam[best].stats[currentCategory] || 0;
        return val > bestVal ? i : best;
      }, available[0]);
    } else {
      // eslint-disable-next-line react-hooks/purity -- eseguito solo da event handler (mai durante il render)
      chosen = available[Math.floor(Math.random() * available.length)];
    }
    return { card: b.aiTeam[chosen], usedAiIndices: [...usedAiIndices, chosen] };
  }

  function resolveRound(playerCard, usedPlayerIndices, bonus) {
    const { card: aiCard, usedAiIndices } = pickAiCard(b.currentCategory, b.usedAiIndices);
    const playerStat = playerCard.stats[b.currentCategory] || 0;
    const aiStat = aiCard.stats[b.currentCategory] || 0;
    const playerWon = playerStat > aiStat;
    const aiWon = aiStat > playerStat;

    if (playerWon) sound.roundWin();
    else if (aiWon) sound.roundLose();
    else sound.roundDraw();

    const historyEntry = {
      round: b.currentRound, category: b.currentCategory,
      playerName: playerCard.name, playerStat, aiName: aiCard.name, aiStat,
      result: playerWon ? 'win' : aiWon ? 'loss' : 'draw'
    };

    setB((prev) => ({
      ...prev,
      phase: 'result',
      playerCard, aiCard, lastBonus: bonus,
      usedPlayerIndices, usedAiIndices,
      roundHistory: [...prev.roundHistory, historyEntry],
      roundScores: {
        player: prev.roundScores.player + (playerWon ? 1 : 0),
        ai: prev.roundScores.ai + (aiWon ? 1 : 0)
      }
    }));
  }

  function playCard(index) {
    if (b.usedPlayerIndices.includes(index)) return;
    const card = b.team[index];
    resolveRound(card, [...b.usedPlayerIndices, index], 0);
  }

  function playSpecialCard(index) {
    if (b.specialUsed || b.usedPlayerIndices.includes(index)) return;
    const card = { ...b.team[index], stats: { ...b.team[index].stats } };
    const value = card.stats[b.currentCategory] || 0;
    const bonus = Math.round(value * 0.25);
    card.stats[b.currentCategory] = value + bonus;
    update({ specialUsed: true });
    resolveRound(card, [...b.usedPlayerIndices, index], bonus);
  }

  function goToNextRound() {
    setB((prev) => ({ ...prev, currentRound: prev.currentRound + 1, specialUsed: false }));
    startRound();
  }

  function showFinalResult() {
    const playerWon = b.roundScores.player > b.roundScores.ai;
    const draw = b.roundScores.player === b.roundScores.ai;
    const result = playerWon ? 'win' : draw ? 'draw' : 'loss';

    if (b.tournamentMode) {
      game.recordBattleResult(result);
      const config = DIFFICULTY_CONFIG[b.difficulty];
      const tournamentGold = b.tournamentGold + (playerWon ? config.gold : 0);
      const tournamentXP = b.tournamentXP + (playerWon ? config.xp : 0);
      const wonAllStages = playerWon && b.tournamentStage === TOURNAMENT_ORDER.length - 1;
      const eliminated = !playerWon;

      if (eliminated) sound.battleLose();
      else if (wonAllStages) sound.battleWin();
      else sound.roundWin();

      if (eliminated || wonAllStages) {
        const bonusGold = wonAllStages ? 100 : 0;
        const bonusXP = wonAllStages ? 150 : 0;
        const finalGold = tournamentGold + bonusGold;
        const finalXP = tournamentXP + bonusXP;
        if (finalGold > 0) game.addGold(finalGold);
        if (finalXP > 0) game.addXP(finalXP);
        update({ phase: 'final', finalKind: wonAllStages ? 'tournament-champion' : 'tournament-eliminated', rewards: { gold: finalGold, xp: finalXP }, tournamentGold, tournamentXP });
      } else {
        update({ phase: 'final', finalKind: 'tournament-stage-cleared', tournamentGold, tournamentXP });
      }
      return;
    }

    const goldReward = playerWon ? 50 : draw ? 20 : 10;
    const xpReward = playerWon ? 100 : draw ? 40 : 20;
    if (playerWon) sound.battleWin();
    else if (draw) sound.battleDraw();
    else sound.battleLose();

    game.recordBattleResult(result);
    game.addGold(goldReward);
    game.addXP(xpReward);
    update({ phase: 'final', finalKind: 'single', rewards: { gold: goldReward, xp: xpReward } });
  }

  function nextTournamentMatch() {
    startMatch(TOURNAMENT_ORDER[b.tournamentStage + 1], { tournamentStage: b.tournamentStage + 1 });
  }

  function newBattle() {
    setB(INITIAL_BATTLE);
  }

  const tournamentBadge = b.tournamentMode && (
    <div className="battle-tournament-badge glass-panel">
      <i className="ph-fill ph-trophy" /> Torneo — Avversario {b.tournamentStage + 1}/3 · {DIFFICULTY_CONFIG[b.difficulty].label}
    </div>
  );

  // ---------- SELECT TEAM ----------
  if (b.phase === 'select') {
    const teamTotals = { fans: 0, style: 0, influence: 0, energy: 0 };
    b.team.forEach((c) => { if (c) CATEGORIES.forEach((k) => { teamTotals[k] += c.stats[k] || 0; }); });
    const filledCount = b.team.filter(Boolean).length;

    return (
      <section className="battle-page">
        <h2 className="section-title text-gradient"><i className="ph-fill ph-sword" /> Seleziona la tua Squadra</h2>
        <p className="text-center battle-subtitle">Scegli 3 carte per la battaglia</p>

        <div className="collection-stats glass-panel">
          <div className="collection-stat"><span className="collection-stat-value">{game.stats.totalBattlesWon || 0}</span><span className="collection-stat-label">Vittorie</span></div>
          <div className="collection-stat"><span className="collection-stat-value">{game.stats.totalBattlesLost || 0}</span><span className="collection-stat-label">Sconfitte</span></div>
          <div className="collection-stat"><span className="collection-stat-value">{game.stats.totalBattlesDrawn || 0}</span><span className="collection-stat-label">Pareggi</span></div>
          <div className="collection-stat"><span className="collection-stat-value">{game.stats.battleWinStreak || 0}</span><span className="collection-stat-label">Serie Attuale</span></div>
        </div>

        <div className="battle-team-slots">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`battle-slot ${b.team[i] ? 'battle-slot-filled' : ''} ${b.selectedSlot === i ? 'battle-slot-active' : ''}`} onClick={() => selectSlot(i)}>
              {b.team[i] ? (
                <div onClick={(e) => { e.stopPropagation(); removeFromTeam(i); }}><MiniCard card={b.team[i]} /></div>
              ) : (
                <div className="battle-slot-empty"><span className="battle-slot-number">{i + 1}</span><span className="battle-slot-label">Seleziona carta</span></div>
              )}
            </div>
          ))}
        </div>

        <div className="battle-team-preview glass-panel">
          <h3>La tua squadra</h3>
          {filledCount === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Seleziona 3 carte per vedere le statistiche della squadra.</p>
          ) : (
            <div className="battle-preview-bars">
              {CATEGORIES.map((cat) => (
                <div className="battle-preview-row" key={cat}>
                  <span className="battle-preview-label"><i className={`ph-fill ${CATEGORY_ICONS[cat]}`} /> {CATEGORY_NAMES[cat]}</span>
                  <div className="battle-preview-track"><div className="battle-preview-fill" style={{ width: `${teamTotals[cat] / 3}%`, background: 'var(--neon-purple)' }} /></div>
                  <span className="battle-preview-val">{teamTotals[cat]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="battle-available glass-panel">
          <h3>Carte disponibili</h3>
          <div className="battle-available-grid">
            {collectionCards.map((card) => {
              const inTeam = b.team.some((t) => t && t.id === card.id);
              return (
                <div key={card.id} className={`battle-available-card ${getRarityCSSClass(card.rarity)} ${inTeam ? 'battle-in-team' : ''}`} onClick={() => !inTeam && addToTeam(card)}>
                  <span className="card-rarity-badge">{card.rarity}</span>
                  <div className="card-artwork" style={{ height: '60%' }}><img src={resolveCardImage(card)} alt={card.name} /></div>
                  <div className="card-info" style={{ padding: 4 }}>
                    <div className="card-name" style={{ fontSize: '0.7rem' }}>{card.name}</div>
                    <div className="card-class" style={{ fontSize: '0.6rem' }}>{card.artistClass}</div>
                  </div>
                  {inTeam && <div className="battle-check-mark"><i className="ph-fill ph-check" /></div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="battle-mode-actions">
          <button className="btn btn-primary btn-large" disabled={filledCount < 3} onClick={startBattle}><i className="ph-fill ph-sword" /> Inizia Battaglia</button>
          <button className="btn btn-gold btn-large" disabled={filledCount < 3} onClick={startTournament}><i className="ph-fill ph-trophy" /> Modalità Torneo</button>
        </div>
      </section>
    );
  }

  // ---------- VS SCREEN ----------
  if (b.phase === 'vs') {
    const playerTotal = b.team.reduce((sum, c) => sum + getTotalScore(c), 0);
    return (
      <section className="battle-vs-page">
        <div className="battle-vs-wrapper">
          {tournamentBadge}
          <div className="battle-vs-content">
            <div className="battle-vs-player">
              <div className="battle-vs-avatar"><i className="ph-fill ph-vinyl-record" /></div>
              <h3>Il Tuo Team</h3>
              <div className="battle-vs-cards">
                {b.team.map((c) => (
                  <div key={c.id} className={`battle-vs-mini ${getRarityCSSClass(c.rarity)}`}>
                    <div style={{ width: 30, height: 40, overflow: 'hidden', borderRadius: 4 }}><img src={resolveCardImage(c)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                    <span style={{ fontSize: '0.55rem' }}>{c.name}</span>
                  </div>
                ))}
              </div>
              <span className="battle-vs-power"><i className="ph-fill ph-lightning" /> {playerTotal}</span>
            </div>

            <div className="battle-vs-center">
              <span className="battle-vs-label">VS</span>
              <span className="battle-vs-round">Round 1 di 3</span>
              <button className="btn btn-primary" onClick={startRound}><i className="ph-fill ph-sword" /> Round 1</button>
            </div>

            <div className="battle-vs-player battle-vs-ai">
              <div className="battle-vs-avatar"><i className="ph-fill ph-robot" /></div>
              <h3>AI Opponent</h3>
              <div className="battle-vs-cards">
                {b.aiTeam.map((_, i) => (
                  <div key={i} className="battle-vs-mini battle-vs-mystery">
                    <div className="battle-vs-mystery-icon"><i className="ph ph-question" /></div>
                    <span style={{ fontSize: '0.55rem' }}>???</span>
                  </div>
                ))}
              </div>
              <span className="battle-vs-power battle-vs-power-hidden">Squadra nascosta</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------- CATEGORY PICKER ----------
  if (b.phase === 'category') {
    return (
      <section className="battle-round-page">
        {tournamentBadge}
        <div className="battle-round-header">
          <span className="battle-round-number">Round {b.currentRound} / 3</span>
          <span className="battle-round-score">{b.roundScores.player} - {b.roundScores.ai}</span>
        </div>
        <div className="glass-panel text-center">
          <h3>Scegli tu la categoria di questo round!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>Punta sul punto forte di una delle carte che ti restano.</p>
        </div>
        <div className="battle-category-pick-grid">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="battle-category-pick-card" onClick={() => chooseCategory(cat)}>
              <span className="battle-category-pick-name"><i className={`ph-fill ${CATEGORY_ICONS[cat]}`} /> {CATEGORY_NAMES[cat]}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ---------- CARD SELECT ----------
  if (b.phase === 'select-card') {
    const availableIndices = [0, 1, 2].filter((i) => !b.usedPlayerIndices.includes(i));
    return (
      <section className="battle-round-page">
        {tournamentBadge}
        <div className="battle-round-header">
          <span className="battle-round-number">Round {b.currentRound} / 3</span>
          <span className="battle-round-score">{b.roundScores.player} - {b.roundScores.ai}</span>
        </div>
        <div className="battle-category-display glass-panel">
          <span className="battle-category-label">Categoria</span>
          <span className="battle-category-name">{CATEGORY_NAMES[b.currentCategory]}</span>
        </div>
        <div className="battle-card-select">
          <h3>Scegli una carta per questo round:</h3>
          <div className="battle-card-options">
            {availableIndices.map((i) => {
              const card = b.team[i];
              const statValue = card.stats[b.currentCategory] || 0;
              return (
                <div key={i} className={`battle-select-card ${getRarityCSSClass(card.rarity)}`} onClick={() => playCard(i)}>
                  <span className="card-rarity-badge">{card.rarity}</span>
                  <div className="card-artwork" style={{ height: '55%' }}><img src={resolveCardImage(card)} alt={card.name} /></div>
                  <div className="card-info">
                    <div className="card-name">{card.name}</div>
                    <div className="battle-stat-highlight" style={{ color: 'var(--neon-gold)' }}>{CATEGORY_NAMES[b.currentCategory]}: <strong>{statValue}</strong></div>
                  </div>
                  {!b.specialUsed && (
                    <button className="battle-special-btn" onClick={(e) => { e.stopPropagation(); playSpecialCard(i); }}>
                      <i className="ph-fill ph-sparkle" /> Abilità
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ---------- ROUND RESULT ----------
  if (b.phase === 'result') {
    const playerColor = getRarityColor(b.playerCard.rarity);
    const aiColor = getRarityColor(b.aiCard.rarity);
    const playerStat = b.playerCard.stats[b.currentCategory] || 0;
    const aiStat = b.aiCard.stats[b.currentCategory] || 0;
    const playerWon = playerStat > aiStat;
    const aiWon = aiStat > playerStat;

    return (
      <section className="battle-round-result">
        {tournamentBadge}
        <div className="battle-round-header">
          <span className="battle-round-number">Round {b.currentRound} — {CATEGORY_NAMES[b.currentCategory]}</span>
        </div>
        <div className="battle-comparison">
          <div className={`battle-comp-card ${playerWon ? 'battle-winner' : ''}`}>
            <div className="battle-comp-art"><img src={resolveCardImage(b.playerCard)} alt="" /></div>
            <span className="battle-comp-name" style={{ color: playerColor }}>{b.playerCard.name}</span>
            <div className="battle-comp-stat">
              <span className="battle-comp-value" style={{ color: playerColor }}>{playerStat}</span>
              {b.lastBonus > 0 && <span className="battle-bonus">+{b.lastBonus} <i className="ph-fill ph-sparkle" /></span>}
              {playerWon && <span className="battle-badge-win">WIN</span>}
            </div>
          </div>
          <div className="battle-comp-vs">
            <span className="battle-comp-vs-text">VS</span>
            <span className="battle-comp-detail">{CATEGORY_NAMES[b.currentCategory]}</span>
          </div>
          <div className={`battle-comp-card ${aiWon ? 'battle-winner' : ''}`}>
            <div className="battle-comp-art"><img src={resolveCardImage(b.aiCard)} alt="" /></div>
            <span className="battle-comp-name" style={{ color: aiColor }}>{b.aiCard.name}</span>
            <div className="battle-comp-stat">
              <span className="battle-comp-value" style={{ color: aiColor }}>{aiStat}</span>
              {aiWon && <span className="battle-badge-win">WIN</span>}
            </div>
          </div>
        </div>
        <div className="battle-next-container">
          {b.currentRound < 3 ? (
            <button className="btn btn-primary" onClick={goToNextRound}>
              <i className={`ph-fill ${playerWon ? 'ph-check-circle' : 'ph-x-circle'}`} /> Round Successivo
            </button>
          ) : (
            <button className="btn btn-gold" onClick={showFinalResult}><i className="ph-fill ph-trophy" /> Vedi Risultato Finale</button>
          )}
        </div>
      </section>
    );
  }

  // ---------- FINAL ----------
  const historyPanel = b.roundHistory.length > 0 && (
    <div className="battle-history glass-panel">
      <h3>Riepilogo Round</h3>
      <div className="battle-history-list">
        {b.roundHistory.map((h, i) => (
          <div className="battle-history-item" key={i}>
            <span className="battle-history-round">R{h.round}</span>
            <span className="battle-history-cat">{CATEGORY_NAMES[h.category]}</span>
            <span className="battle-history-detail">{h.playerName} ({h.playerStat}) vs {h.aiName} ({h.aiStat})</span>
            <span className={`battle-history-result battle-history-${h.result}`}>{h.result === 'win' ? 'Vinto' : h.result === 'loss' ? 'Perso' : 'Pareggio'}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (b.finalKind === 'tournament-stage-cleared') {
    return (
      <section className="battle-final-page">
        <div className="battle-final-content glass-panel">
          <div className="battle-final-icon"><i className="ph-fill ph-trophy" /></div>
          <h2 className="battle-final-title" style={{ color: 'var(--neon-gold)' }}>AVVERSARIO {b.tournamentStage + 1}/3 SCONFITTO!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Punteggio: {b.roundScores.player} - {b.roundScores.ai}</p>
          {historyPanel}
          <button className="btn btn-gold btn-large" style={{ marginTop: 'var(--space-md)' }} onClick={nextTournamentMatch}>
            <i className="ph-fill ph-sword" /> Prossimo Avversario
          </button>
        </div>
      </section>
    );
  }

  const wonAllStages = b.finalKind === 'tournament-champion';
  const eliminated = b.finalKind === 'tournament-eliminated';
  const playerWon = b.finalKind === 'single' && b.roundScores.player > b.roundScores.ai;
  const draw = b.finalKind === 'single' && b.roundScores.player === b.roundScores.ai;

  let icon = 'ph-heart-break';
  let title = 'SCONFITTA!';
  let color = 'var(--text-secondary)';
  if (b.finalKind === 'single') {
    icon = playerWon ? 'ph-trophy' : draw ? 'ph-handshake' : 'ph-heart-break';
    title = playerWon ? 'VITTORIA!' : draw ? 'PAREGGIO!' : 'SCONFITTA!';
    color = playerWon ? 'var(--neon-gold)' : draw ? 'var(--neon-cyan)' : 'var(--text-secondary)';
  } else if (wonAllStages) {
    icon = 'ph-trophy'; title = 'CAMPIONE DEL TORNEO!'; color = 'var(--neon-gold)';
  } else if (eliminated) {
    icon = 'ph-heart-break'; title = `ELIMINATO — AVVERSARIO ${b.tournamentStage + 1}/3`; color = 'var(--text-secondary)';
  }

  return (
    <section className="battle-final-page">
      <div className="battle-final-content glass-panel">
        <div className="battle-final-icon"><i className={`ph-fill ${icon}`} /></div>
        <h2 className="battle-final-title" style={{ color }}>{title}</h2>

        {b.finalKind === 'single' && (
          <div className="battle-final-score">
            <span className="battle-final-score-you">{b.roundScores.player}</span>
            <span className="battle-final-score-divider">-</span>
            <span className="battle-final-score-ai">{b.roundScores.ai}</span>
          </div>
        )}
        {b.finalKind !== 'single' && (
          <p style={{ color: 'var(--text-secondary)' }}>
            {wonAllStages ? 'Hai sconfitto tutti e 3 gli avversari!' : `Hai superato ${b.tournamentStage} avversari su 3.`}
          </p>
        )}

        <div className="battle-final-rewards">
          <h3>Ricompense{b.finalKind !== 'single' ? ' Totali' : ''}</h3>
          <div className="battle-reward-item"><span><i className="ph-fill ph-coin" /></span><span>+{b.rewards.gold} Gold</span></div>
          <div className="battle-reward-item"><span><i className="ph-fill ph-lightning" /></span><span>+{b.rewards.xp} XP</span></div>
        </div>

        {historyPanel}

        <div className="battle-final-actions">
          <button className="btn btn-primary" onClick={newBattle}><i className="ph-fill ph-sword" /> Nuova Battaglia</button>
          <button className="btn btn-secondary" onClick={() => navigate('/home')}><i className="ph-fill ph-house" /> Torna alla Home</button>
        </div>
      </div>
    </section>
  );
}
