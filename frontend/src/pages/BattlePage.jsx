import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame.js';
import { useSound } from '../hooks/useSound.js';
import { useCountUp } from '../hooks/useCountUp.js';
import { m } from 'motion/react';
import { RARITIES, SOURCE_LABELS, getRarityCSSClass, getSourceLabel, getTotalScore, resolveCardImage } from '../utils/cardUtils.js';
import { CARDS } from '../data/cards.js';
import EmptyState from '../components/common/EmptyState.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import CardTile from '../components/card/CardTile.jsx';
import StarBorder from '../components/common/StarBorder.jsx';
import ScrollToTopButton from '../components/common/ScrollToTopButton.jsx';
import { useProgressiveList } from '../hooks/useProgressiveList.js';
import SavedTeams from '../components/card/SavedTeams.jsx';
import { applySynergies, teamSynergies } from '../utils/battleSynergy.js';
import { OnlineOpponents, OpponentModeTabs, PlayerOpponents } from '../components/battle/OpponentPicker.jsx';
import { battleApi } from '../services/battleApi.js';
import { useOnlinePvp } from '../hotel/useOnlinePvp.js';
import OnlineMatch from '../components/battle/OnlineMatch.jsx';
import { TournamentPanel } from '../components/battle/CardTournament.jsx';
import { useCardTournament } from '../hotel/useCardTournament.js';
import { useAuth } from '../hooks/useAuth.js';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import RoundClash from '../components/battle/RoundClash.jsx';
import { FinalTitle, ResultBackdrop, SlamIn } from '../components/battle/PhantomFx.jsx';
import { FROM_LEFT, FROM_RIGHT, impactProps } from '../components/battle/phantomMotion.js';
import '../styles/pages/game-battle.css';

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

/** Bonus di squadra attivi (stessa classe, tipologia, set, gioco): elenco con l'aumento di ognuno. */
function SynergyList({ team, compact = false }) {
  const { bonuses } = teamSynergies(team);
  if (!bonuses.length) {
    return compact ? null : (
      <p className="battle-synergy-empty">Nessun bonus di squadra: schiera carte della stessa classe, tipologia, set o gioco.</p>
    );
  }
  return (
    <ul className={`battle-synergy-list${compact ? ' compact' : ''}`}>
      {bonuses.map((b) => (
        <li key={b.key}><i className={`ph-fill ${b.icon}`} /> {b.label} <strong>+{b.value}%</strong></li>
      ))}
    </ul>
  );
}

/** Riepilogo di potenza della squadra: numero animato con useCountUp + ingresso "a molla". */
function VsScreen({ team, aiTeamLength, tournamentBadge, onStartRound, opponentName }) {
  const playerTotal = team.reduce((sum, c) => sum + getTotalScore(c), 0);
  const displayTotal = useCountUp(playerTotal, 900);

  return (
    <section className="battle-vs-page">
      <div className="battle-vs-wrapper">
        {tournamentBadge}
        <div className="battle-vs-content">
          <m.div className="battle-vs-player" {...FROM_LEFT}>
            <div className="battle-vs-avatar"><i className="ph-fill ph-vinyl-record" /></div>
            <h3>Il Tuo Team</h3>
            <div className="battle-vs-cards">
              {team.map((c) => (
                <div key={c.id} className={`battle-vs-mini ${getRarityCSSClass(c.rarity)}`}>
                  <div className="battle-vs-thumb">
                    <img loading="lazy" decoding="async" src={resolveCardImage(c)} alt="" />
                  </div>
                  <span className="battle-vs-mini-name">{c.name}</span>
                </div>
              ))}
            </div>
            <span className="battle-vs-power"><i className="ph-fill ph-lightning" /> {displayTotal}</span>
            <SynergyList team={team} compact />
          </m.div>

          <div className="battle-vs-center">
            <SlamIn className="battle-vs-label" delay={0.14} tilt={-8}>VS</SlamIn>
            <span className="battle-vs-round">Round 1 di 3</span>
            <button className="btn btn-primary btn-large" onClick={onStartRound}><i className="ph-fill ph-sword" /> Round 1</button>
          </div>

          <m.div className="battle-vs-player battle-vs-ai" {...FROM_RIGHT}>
            <div className="battle-vs-avatar"><i className={`ph-fill ${opponentName ? 'ph-user' : 'ph-robot'}`} /></div>
            <h3>{opponentName ? `Squadra di ${opponentName}` : 'NPC'}</h3>
            <div className="battle-vs-cards">
              {Array.from({ length: aiTeamLength }, (_, i) => (
                <div key={i} className="battle-vs-mini battle-vs-mystery">
                  <div className="battle-vs-mystery-icon"><i className="ph ph-question" /></div>
                  <span className="battle-vs-mini-name">???</span>
                </div>
              ))}
            </div>
            <span className="battle-vs-power battle-vs-power-hidden">Squadra nascosta</span>
          </m.div>
        </div>
      </div>
    </section>
  );
}

/** Schermata finale unificata (singola / tappa torneo / campione / eliminato): numeri animati + CTA speciale da campione. */
function FinalScreen({ finalKind, rewards, tournamentStage, roundScores, historyPanel, onNewBattle, onNextTournamentMatch, onNavigateHome }) {
  const displayGold = useCountUp(rewards.gold, 900);
  const displayXP = useCountUp(rewards.xp, 900);

  if (finalKind === 'tournament-stage-cleared') {
    return (
      <section className="battle-final-page is-win">
        <ResultBackdrop tone="win" />
        <m.div className="battle-final-content glass-panel" {...impactProps(true)}>
          <div className="battle-final-icon"><i className="ph-fill ph-trophy" /></div>
          <FinalTitle tone="win" text={`Avversario ${tournamentStage + 1}/3 sconfitto!`} />
          <p className="battle-final-sub">Punteggio: {roundScores.player} - {roundScores.ai}</p>
          {historyPanel}
          <button className="btn btn-gold btn-large battle-final-next" onClick={onNextTournamentMatch}>
            <i className="ph-fill ph-sword" /> Prossimo Avversario
          </button>
        </m.div>
      </section>
    );
  }

  const wonAllStages = finalKind === 'tournament-champion';
  const eliminated = finalKind === 'tournament-eliminated';
  const playerWon = finalKind === 'single' && roundScores.player > roundScores.ai;
  const draw = finalKind === 'single' && roundScores.player === roundScores.ai;

  let icon = 'ph-heart-break';
  let title = 'SCONFITTA!';
  let tone = 'lose';
  if (finalKind === 'single') {
    icon = playerWon ? 'ph-trophy' : draw ? 'ph-handshake' : 'ph-heart-break';
    title = playerWon ? 'VITTORIA!' : draw ? 'PAREGGIO!' : 'SCONFITTA!';
    tone = playerWon ? 'win' : draw ? 'draw' : 'lose';
  } else if (wonAllStages) {
    icon = 'ph-trophy'; title = 'CAMPIONE DEL TORNEO!'; tone = 'champion';
  } else if (eliminated) {
    icon = 'ph-heart-break'; title = `ELIMINATO — AVVERSARIO ${tournamentStage + 1}/3`;
  }

  return (
    <section className={`battle-final-page is-${tone}`}>
      <ResultBackdrop tone={tone} />
      <m.div className="battle-final-content glass-panel" {...impactProps(tone === 'win' || tone === 'champion')}>
        <div className={`battle-final-icon ${wonAllStages ? 'battle-final-icon-champion' : ''}`}><i className={`ph-fill ${icon}`} /></div>
        <FinalTitle tone={tone} text={title} />

        {finalKind === 'single' && (
          <div className="battle-final-score">
            <span className="battle-final-score-you">{roundScores.player}</span>
            <span className="battle-final-score-divider">-</span>
            <span className="battle-final-score-ai">{roundScores.ai}</span>
          </div>
        )}
        {finalKind !== 'single' && (
          <p className="battle-final-sub">
            {wonAllStages ? 'Hai sconfitto tutti e 3 gli avversari!' : `Hai superato ${tournamentStage} avversari su 3.`}
          </p>
        )}

        <div className="battle-final-rewards">
          <h3>Ricompense{finalKind !== 'single' ? ' Totali' : ''}</h3>
          <div className="battle-reward-item"><span><i className="ph-fill ph-coin" /></span><span>+{displayGold} Gold</span></div>
          <div className="battle-reward-item"><span><i className="ph-fill ph-lightning" /></span><span>+{displayXP} XP</span></div>
        </div>

        {historyPanel}

        <div className="battle-final-actions">
          {wonAllStages ? (
            <StarBorder color="#FFD700" speed="3s" className="battle-champion-cta">
              <button className="btn btn-gold" style={{ width: '100%' }} onClick={onNewBattle}><i className="ph-fill ph-sword" /> Nuova Battaglia</button>
            </StarBorder>
          ) : (
            <button className="btn btn-primary" onClick={onNewBattle}><i className="ph-fill ph-sword" /> Nuova Battaglia</button>
          )}
          <button className="btn btn-secondary" onClick={onNavigateHome}><i className="ph-fill ph-house" /> Torna alla Home</button>
        </div>
      </m.div>
    </section>
  );
}

const INITIAL_BATTLE = {
  fightTeam: [],
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
  rewards: { gold: 0, xp: 0 },
  // Battaglia contro la squadra di un giocatore: il suo nome (null = NPC).
  opponentName: null
};

/** Sfida online in arrivo o in attesa di risposta, dentro la pagina (non una finestra sopra). */
function OnlineInvite({ pvp, canAccept, send, onClose }) {
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = pvp?.stage === 'incoming' ? pvp.expiresAt : null;
  useEffect(() => {
    if (!expiresAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [expiresAt]);
  const left = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
  useEffect(() => {
    if (left === 0) onClose();
  }, [left, onClose]);
  if (!pvp || (pvp.stage !== 'incoming' && pvp.stage !== 'sent')) return null;
  if (pvp.stage === 'sent') {
    return (
      <div className="battle-online-invite glass-panel" role="status">
        <i className="ph-fill ph-hourglass-medium" />
        <span>Sfida mandata a <strong>{pvp.to?.username || pvp.to}</strong>: aspetto che risponda…</span>
      </div>
    );
  }
  return (
    <div className="battle-online-invite battle-online-invite-incoming glass-panel" role="alert">
      <i className="ph-fill ph-lightning" />
      <span><strong>{pvp.from?.username}</strong> ti sfida!{left != null && ` (${left}s)`}{!canAccept && ' Scegli 3 carte per accettare.'}</span>
      <button type="button" className="btn btn-secondary btn-small" onClick={() => send({ type: 'challenge_reply', challengeId: pvp.challengeId, accept: false })}>Rifiuta</button>
      <button type="button" className="btn btn-primary btn-small" disabled={!canAccept}
        onClick={() => send({ type: 'challenge_reply', challengeId: pvp.challengeId, accept: true })}>
        <i className="ph-fill ph-sword" /> Accetta
      </button>
    </div>
  );
}

export default function BattlePage() {
  const game = useGame();
  const { sound } = useSound();
  const navigate = useNavigate();
  const [b, setB] = useState(INITIAL_BATTLE);
  const [battleSearch, setBattleSearch] = useState('');
  const [battleRarityFilter, setBattleRarityFilter] = useState('');
  const [battleSourceFilter, setBattleSourceFilter] = useState('');
  const [synced, setSynced] = useState(false);
  const { refreshCollection } = game;
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  // Contro chi: NPC, squadra di un giocatore (anche offline), giocatore online in tempo reale o torneo.
  const [opponentMode, setOpponentMode] = useState(() => (searchParams.get('mode') === 'tournament' ? 'tournament' : 'npc'));
  const [pickingId, setPickingId] = useState(null);
  const [pickError, setPickError] = useState(null);
  const realtime = opponentMode === 'online' || opponentMode === 'tournament';
  const onlinePvp = useOnlinePvp({ active: realtime, onEnd: () => { refreshUser?.(); refreshCollection?.(); } });
  const tournament = useCardTournament({ active: opponentMode === 'tournament', onPrize: () => refreshUser?.() });
  /** Squadra di riserva per il torneo, se quando tocca a te non ne hai scelta una: le tre carte piu' forti. */
  const bestTeam = useRef([]);

  // Sfida online: la squadra e' quella scelta qui sopra, la mando da sola appena parte la partita.
  const sentTeamFor = useRef(null);
  const onlineStage = onlinePvp.pvp?.stage;
  const onlineMatchId = onlinePvp.pvp?.matchId;
  const sendOnline = onlinePvp.send;
  useEffect(() => {
    if (onlineStage !== 'team' || !onlineMatchId || sentTeamFor.current === onlineMatchId) return;
    sentTeamFor.current = onlineMatchId;
    const chosen = b.team.filter(Boolean);
    const team = chosen.length === 3 ? chosen : bestTeam.current;
    sendOnline({ type: 'pvp_team', cards: team.map((c) => c.id) });
  }, [onlineStage, onlineMatchId, sendOnline, b.team]);

  // Battaglia contro gli NPC in corso: lo si dice al server, che nel frattempo non recapita
  // proposte di scambio. Si dice anche quando finisce o si esce dalla pagina a meta'.
  const fighting = ['vs', 'category', 'select-card', 'result'].includes(b.phase);
  useEffect(() => {
    if (!fighting) return undefined;
    battleApi.activity(true).catch(() => {});
    return () => { battleApi.activity(false).catch(() => {}); };
  }, [fighting]);

  // Le immagini delle due squadre si scaricano e decodificano gia' alla schermata VS: nel
  // confronto del round compaiono subito, senza il riquadro nero che lampeggia (iPhone).
  useEffect(() => {
    for (const card of [...b.fightTeam, ...b.aiTeam]) {
      const img = new Image();
      img.src = resolveCardImage(card);
      img.decode?.().catch(() => {});
    }
  }, [b.fightTeam, b.aiTeam]);

  // Le carte prese altrove (hotel, scambi, mercato) arrivano qui solo ricaricando la collezione.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(refreshCollection?.()).finally(() => { if (!cancelled) setSynced(true); });
    return () => { cancelled = true; };
  }, [refreshCollection]);

  const collectionCards = useMemo(() => uniqueCollectionCards(game.collection), [game.collection]);
  const bestCards = useMemo(() => {
    const total = (c) => CATEGORIES.reduce((sum, k) => sum + (c.stats?.[k] || 0), 0);
    return [...collectionCards].sort((x, y) => total(y) - total(x)).slice(0, 3);
  }, [collectionCards]);
  useEffect(() => { bestTeam.current = bestCards; }, [bestCards]);
  const availableBattleSources = useMemo(() => {
    const present = new Set(collectionCards.map((c) => c.source).filter(Boolean));
    return Object.keys(SOURCE_LABELS).filter((s) => present.has(s));
  }, [collectionCards]);
  const filteredAvailableCards = useMemo(() => {
    let cards = collectionCards;
    if (battleRarityFilter) cards = cards.filter((c) => c.rarity === battleRarityFilter);
    if (battleSourceFilter) cards = cards.filter((c) => c.source === battleSourceFilter);
    if (battleSearch.trim()) {
      const q = battleSearch.trim().toLowerCase();
      cards = cards.filter((c) => c.name.toLowerCase().includes(q));
    }
    return cards;
  }, [collectionCards, battleRarityFilter, battleSourceFilter, battleSearch]);
  const { visible: shownAvailableCards, hasMore: moreAvailable, sentinelRef: availableSentinel } =
    useProgressiveList(filteredAvailableCards, { resetKey: filteredAvailableCards });

  if (collectionCards.length < 3 && (!synced || game.loading)) {
    return (
      <section className="battle-page">
        <PhantomTitle text="Battaglia" className="game-page-title" />
        <LoadingSpinner />
      </section>
    );
  }

  if (collectionCards.length < 3) {
    return (
      <section className="battle-page">
        <PhantomTitle text="Battaglia" className="game-page-title" />
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

  function startMatch(difficulty, extra = {}, opponentTeam = null) {
    setB((prev) => ({
      ...prev,
      ...extra,
      difficulty,
      // Le carte entrano in campo con i bonus di squadra; la squadra scelta resta com'e'.
      fightTeam: applySynergies(prev.team),
      aiTeam: applySynergies(opponentTeam || generateAiTeam(difficulty)),
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
    startMatch('normal', { tournamentMode: false, tournamentStage: 0, tournamentGold: 0, tournamentXP: 0, opponentName: null });
  }

  /** Battaglia contro la squadra di un altro giocatore, con le stesse regole e premi di quella normale. */
  async function startPlayerBattle(opponent) {
    if (b.team.filter(Boolean).length < 3) return;
    setPickingId(opponent.id);
    setPickError(null);
    try {
      const res = await battleApi.opponentTeam(opponent.id);
      startMatch('normal', { tournamentMode: false, tournamentStage: 0, tournamentGold: 0, tournamentXP: 0,
        opponentName: res.opponent.username }, res.team);
    } catch (err) {
      setPickError(err.code === 'opponent_no_team' ? 'Questo giocatore non ha ancora 3 carte.' : 'Non riesco a caricare la sua squadra.');
    } finally {
      setPickingId(null);
    }
  }

  function startTournament() {
    if (b.team.filter(Boolean).length < 3) return;
    startMatch(TOURNAMENT_ORDER[0], { tournamentMode: true, tournamentStage: 0, tournamentGold: 0, tournamentXP: 0, opponentName: null });
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
    const card = b.fightTeam[index];
    resolveRound(card, [...b.usedPlayerIndices, index], 0);
  }

  function playSpecialCard(index) {
    if (b.specialUsed || b.usedPlayerIndices.includes(index)) return;
    const card = { ...b.fightTeam[index], stats: { ...b.fightTeam[index].stats } };
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
    // Le carte schierate: il server le conta come usate (sono quelle mostrate sopra l'avatar nell'hotel).
    const teamCodes = b.team.filter(Boolean).map((c) => c.id);
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
        game.claimBattleReward({ mode: 'tournament', stagesCleared: wonAllStages ? TOURNAMENT_ORDER.length : b.tournamentStage, wonAllStages, cards: teamCodes });
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
    game.claimBattleReward({ mode: 'single', result, cards: teamCodes });
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

  // ---------- SFIDA ONLINE IN CORSO ----------
  if (onlinePvp.pvp && ['team', 'round', 'reveal', 'end'].includes(onlinePvp.pvp.stage)) {
    return (
      <OnlineMatch pvp={onlinePvp.pvp} clockOffset={onlinePvp.clockOffset} send={onlinePvp.send}
        myTeam={b.team.filter(Boolean).length === 3 ? b.team : bestCards}
        onExit={() => onlinePvp.setPvp(null)} />
    );
  }

  // ---------- SELECT TEAM ----------
  if (b.phase === 'select') {
    const teamTotals = { fans: 0, style: 0, influence: 0, energy: 0 };
    applySynergies(b.team).forEach((c) => { if (c) CATEGORIES.forEach((k) => { teamTotals[k] += c.stats[k] || 0; }); });
    const filledCount = b.team.filter(Boolean).length;

    return (
      <section className="battle-page">
        <PhantomTitle text="Scegli la squadra" className="game-page-title" />
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
                <CardTile card={b.team[i]} onClick={(e) => { e.stopPropagation(); removeFromTeam(i); }} />
              ) : (
                // Un bottone vero: lo raggiungono la tastiera e la navigazione col controller.
                <button type="button" className="battle-slot-empty" aria-pressed={b.selectedSlot === i}
                  onClick={(e) => { e.stopPropagation(); selectSlot(i); }}>
                  <span className="battle-slot-number">{i + 1}</span><span className="battle-slot-label">Seleziona carta</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <SavedTeams cards={collectionCards} team={b.team} onLoad={(team) => update({ team, selectedSlot: 0 })} />

        <OpponentModeTabs mode={opponentMode} onChange={(m) => { setOpponentMode(m); setPickError(null); }} />
        {opponentMode === 'npc' && (
          <div className="battle-mode-actions">
            <button className="btn btn-primary btn-large" disabled={filledCount < 3} onClick={startBattle}><i className="ph-fill ph-sword" /> Inizia Battaglia</button>
            <button className="btn btn-gold btn-large" disabled={filledCount < 3} onClick={startTournament}><i className="ph-fill ph-trophy" /> Modalità Torneo</button>
          </div>
        )}
        {opponentMode === 'player' && (
          <>
            {filledCount < 3 && <p className="battle-opponent-hint">Scegli prima le tue 3 carte, poi l&apos;avversario.</p>}
            {pickError && <div className="auth-message auth-message-error">{pickError}</div>}
            <PlayerOpponents disabled={filledCount < 3} busyId={pickingId} onPick={startPlayerBattle} />
          </>
        )}
        {opponentMode === 'online' && (
          <>
            {onlinePvp.notice && <div className="auth-message auth-message-error">{onlinePvp.notice}</div>}
            {filledCount < 3 && <p className="battle-opponent-hint">Scegli prima le 3 carte: giochi la sfida online con questa squadra.</p>}
            <OnlineInvite pvp={onlinePvp.pvp} canAccept={filledCount >= 3} send={onlinePvp.send} onClose={() => onlinePvp.setPvp(null)} />
            <OnlineOpponents online={onlinePvp.online} waiting={!!onlinePvp.pvp || filledCount < 3} onChallenge={onlinePvp.challenge} />
          </>
        )}
        {opponentMode === 'tournament' && (
          <TournamentPanel tournament={tournament} me={user?.id}
            joinHint={filledCount < 3 ? 'Scegli le 3 carte qui sopra: giochi il torneo con questa squadra (senza, con le tue 3 più forti).' : null} />
        )}

        <div className="battle-team-preview glass-panel">
          <h3>La tua squadra</h3>
          {filledCount === 0 ? (
            <p className="battle-preview-empty">Seleziona 3 carte per vedere le statistiche della squadra.</p>
          ) : (
            <div className="battle-preview-bars">
              {CATEGORIES.map((cat) => (
                <div className="battle-preview-row" key={cat}>
                  <span className="battle-preview-label"><i className={`ph-fill ${CATEGORY_ICONS[cat]}`} /> {CATEGORY_NAMES[cat]}</span>
                  <div className="battle-preview-track"><div className="battle-preview-fill" style={{ width: `${teamTotals[cat] / 3}%` }} /></div>
                  <span className="battle-preview-val">{teamTotals[cat]}</span>
                </div>
              ))}
            </div>
          )}
          {filledCount > 0 && <SynergyList team={b.team} />}
        </div>

        <div className="battle-available glass-panel">
          <h3>Carte disponibili <span className="battle-available-count">({filteredAvailableCards.length}/{collectionCards.length})</span></h3>
          <div className="filter-row battle-filter-row">
            <div className="filter-group">
              <input
                className="filter-select"
                type="text"
                placeholder="Cerca per nome…"
                value={battleSearch}
                onChange={(e) => setBattleSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <select className="filter-select" value={battleRarityFilter} onChange={(e) => setBattleRarityFilter(e.target.value)}>
                <option value="">Tutte le Rarità</option>
                {Object.entries(RARITIES).map(([key, r]) => <option key={key} value={key}>{r.name}</option>)}
              </select>
            </div>
            {availableBattleSources.length > 1 && (
              <div className="filter-group">
                <select className="filter-select" value={battleSourceFilter} onChange={(e) => setBattleSourceFilter(e.target.value)}>
                  <option value="">Tutte le Fonti</option>
                  {availableBattleSources.map((s) => <option key={s} value={s}>{getSourceLabel(s)}</option>)}
                </select>
              </div>
            )}
          </div>
          {filteredAvailableCards.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-md) 0' }}>Nessuna carta trovata con questi filtri.</p>
          ) : (
            <div className="battle-available-grid">
              {shownAvailableCards.map((card) => {
                const inTeam = b.team.some((t) => t && t.id === card.id);
                return (
                  <div key={card.id} className={`battle-card-wrap ${inTeam ? 'battle-in-team' : ''}`}>
                    {inTeam && <div className="battle-check-mark"><i className="ph-fill ph-check" /></div>}
                    <CardTile card={card} onClick={() => !inTeam && addToTeam(card)} />
                  </div>
                );
              })}
              {moreAvailable && <div ref={availableSentinel} className="progressive-sentinel" aria-hidden="true" />}
            </div>
          )}
        </div>

        <ScrollToTopButton />
      </section>
    );
  }

  // ---------- VS SCREEN ----------
  if (b.phase === 'vs') {
    return <VsScreen team={b.fightTeam} aiTeamLength={b.aiTeam.length} tournamentBadge={tournamentBadge} onStartRound={startRound} opponentName={b.opponentName} />;
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
        <div className="glass-panel text-center battle-round-prompt">
          <h3>Scegli tu la categoria di questo round!</h3>
          <p>Punta sul punto forte di una delle carte che ti restano.</p>
        </div>
        <div className="battle-category-pick-grid">
          {CATEGORIES.map((cat) => (
            <button type="button" key={cat} className="battle-category-pick-card" onClick={() => chooseCategory(cat)}>
              <i className={`ph-fill ${CATEGORY_ICONS[cat]}`} aria-hidden="true" />
              <span className="battle-category-pick-name">{CATEGORY_NAMES[cat]}</span>
            </button>
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
          <span className="battle-category-name"><i className={`ph-fill ${CATEGORY_ICONS[b.currentCategory]}`} aria-hidden="true" /> {CATEGORY_NAMES[b.currentCategory]}</span>
        </div>
        <div className="battle-card-select">
          <h3>Scegli una carta per questo round:</h3>
          <div className="battle-card-options">
            {availableIndices.map((i) => {
              const card = b.fightTeam[i];
              const statValue = card.stats[b.currentCategory] || 0;
              return (
                <div key={i} className="battle-card-wrap">
                  <CardTile card={card} onClick={() => playCard(i)} />
                  <div className="battle-pick-meta">
                    <span className="battle-stat-highlight"><i className={`ph-fill ${CATEGORY_ICONS[b.currentCategory]}`} /> {CATEGORY_NAMES[b.currentCategory]}: <strong>{statValue}</strong></span>
                    {card.synergy > 0 && <span className="battle-synergy-chip" title="Bonus di squadra"><i className="ph-fill ph-link" /> +{card.synergy}%</span>}
                    {!b.specialUsed && (
                      <button type="button" className="battle-special-btn-inline" onClick={(e) => { e.stopPropagation(); playSpecialCard(i); }}>
                        <i className="ph-fill ph-sparkle" /> Abilità (+25%)
                      </button>
                    )}
                  </div>
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
    const playerStat = b.playerCard.stats[b.currentCategory] || 0;
    const aiStat = b.aiCard.stats[b.currentCategory] || 0;
    const playerWon = playerStat > aiStat;
    const aiWon = aiStat > playerStat;

    return (
      <section className="battle-round-result">
        {tournamentBadge}
        <div className="battle-round-header">
          <span className="battle-round-number">Round {b.currentRound} — {CATEGORY_NAMES[b.currentCategory]}</span>
          <span className="battle-round-score">{b.roundScores.player} - {b.roundScores.ai}</span>
        </div>
        <RoundClash
          category={CATEGORY_NAMES[b.currentCategory]}
          winner={playerWon ? 'you' : aiWon ? 'opponent' : null}
          you={{ label: 'Tu', card: b.playerCard, value: playerStat, bonus: b.lastBonus > 0 ? `+${b.lastBonus}` : null }}
          opponent={{ label: b.opponentName || 'NPC', card: b.aiCard, value: aiStat }}
        />
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

  return (
    <FinalScreen
      finalKind={b.finalKind}
      rewards={b.rewards}
      tournamentStage={b.tournamentStage}
      roundScores={b.roundScores}
      historyPanel={historyPanel}
      onNewBattle={newBattle}
      onNextTournamentMatch={nextTournamentMatch}
      onNavigateHome={() => navigate('/home')}
    />
  );
}
