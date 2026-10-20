import { useEffect, useState } from 'react';
import '../../styles/pages/game-battle.css';
import { battleApi } from '../../services/battleApi.js';
import { getAvatarUrl } from '../../utils/avatarUtils.js';

/** Contro chi si gioca: NPC (come prima), la squadra di un giocatore, o un giocatore online. */
const OPPONENT_MODES = [
  { key: 'npc', label: 'NPC', icon: 'ph-robot', hint: 'Avversari del computer, una partita a tre round.' },
  { key: 'player', label: 'Squadra di un giocatore', icon: 'ph-user', hint: 'Affronti la squadra di un altro giocatore, anche se non è collegato.' },
  { key: 'online', label: 'Giocatore online', icon: 'ph-broadcast', hint: 'Sfida in tempo reale: l\'altro accetta e giocate insieme turno per turno.' },
  { key: 'tournament', label: 'Torneo', icon: 'ph-trophy', hint: 'Coppa a eliminazione diretta con giocatori online e NPC: dagli ottavi alla finale, montepremi di 1000 gold.' }
];

export function OpponentModeTabs({ mode, onChange }) {
  return (
    <div className="battle-opponent-tabs" role="tablist" aria-label="Avversario">
      {OPPONENT_MODES.map((m) => (
        <button key={m.key} type="button" role="tab" aria-selected={mode === m.key}
          className={`btn btn-small ${mode === m.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onChange(m.key)}>
          <i className={`ph-fill ${m.icon}`} /> {m.label}
        </button>
      ))}
      <p className="battle-opponent-hint">{OPPONENT_MODES.find((m) => m.key === mode)?.hint}</p>
    </div>
  );
}

const Avatar = ({ avatar }) => {
  const src = getAvatarUrl(avatar);
  return src ? <img className="battle-opponent-avatar" src={src} alt="" /> : <span className="battle-opponent-avatar"><i className="ph-fill ph-user" /></span>;
};

/** Giocatori da affrontare con la loro squadra: i piu' forti, o cercati per nome. */
export function PlayerOpponents({ disabled, onPick, busyId }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    battleApi.opponents(search)
      .then((res) => { if (!cancelled) { setList(res.opponents || []); setError(null); } })
      .catch(() => { if (!cancelled) setError('Non riesco a caricare i giocatori.'); });
    return () => { cancelled = true; };
  }, [search]);
  return (
    <div className="battle-opponents glass-panel">
      <form className="battle-opponent-search" onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); }}>
        <input className="filter-select" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un giocatore…" aria-label="Cerca un giocatore" />
        <button type="submit" className="btn btn-secondary btn-small"><i className="ph ph-magnifying-glass" /></button>
      </form>
      {error && <p className="battle-opponent-empty">{error}</p>}
      {list && !list.length && <p className="battle-opponent-empty">Nessun giocatore con almeno 3 carte.</p>}
      <ul className="battle-opponent-list">
        {(list || []).map((o) => (
          <li key={o.id}>
            <Avatar avatar={o.avatar} />
            <span className="battle-opponent-name">
              <strong>{o.username}</strong>
              <small>Liv. {o.level} · {o.battlesWon} vittorie · {o.cards} carte{o.online ? ' · online' : ''}</small>
            </span>
            <button type="button" className="btn btn-primary btn-small" disabled={disabled || busyId === o.id} onClick={() => onPick(o)}>
              <i className="ph-fill ph-sword" /> {busyId === o.id ? '…' : 'Sfida'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Giocatori collegati adesso (hotel o Battaglie): si aggiorna da solo ogni pochi secondi. */
export function OnlineOpponents({ online, onChallenge, waiting }) {
  const [players, setPlayers] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => battleApi.online().then((res) => { if (!cancelled) setPlayers(res.players || []); }).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return (
    <div className="battle-opponents glass-panel">
      <p className="battle-opponent-status">
        <i className={`ph-fill ${online ? 'ph-wifi-high' : 'ph-wifi-slash'}`} />
        {online ? ' Sei collegato: gli altri possono sfidarti mentre resti su questa pagina.' : ' Mi collego…'}
      </p>
      {players && !players.length && <p className="battle-opponent-empty">Nessun altro giocatore collegato in questo momento.</p>}
      <ul className="battle-opponent-list">
        {(players || []).map((p) => (
          <li key={p.id}>
            <span className="battle-opponent-avatar"><i className="ph-fill ph-user" /></span>
            <span className="battle-opponent-name">
              <strong>{p.username}</strong>
              <small>{p.busy ? 'In una sfida' : `Si trova: ${p.where}`}</small>
            </span>
            <button type="button" className="btn btn-primary btn-small" disabled={!online || p.busy || waiting} onClick={() => onChallenge(p.id)}>
              <i className="ph-fill ph-lightning" /> Sfida
            </button>
          </li>
        ))}
      </ul>
      <p className="battle-opponent-hint">Giochi con la squadra scelta qui sopra: categorie e carte come contro gli NPC, ma l&apos;avversario è una persona. Premi della PvP dell&apos;hotel.</p>
    </div>
  );
}
