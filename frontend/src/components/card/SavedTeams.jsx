import { useEffect, useState } from 'react';
import { extrasApi } from '../../services/extrasApi.js';

const ERRORS = {
  teams_full: 'Hai gia\' tre squadre: cancellane una.',
  card_not_owned: 'Una delle carte non e\' piu\' nella tua collezione.',
  team_name_invalid: 'Dai un nome alla squadra (massimo 40 lettere).'
};

/**
 * Squadre da battaglia salvate: un clic le rimette in campo. `cards` e' la collezione (per
 * ritrovare le carte dai codici), `team` la squadra di adesso (per salvarla).
 */
export default function SavedTeams({ cards, team, onLoad, compact = false }) {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    extrasApi.teams().then((res) => { if (!cancelled) setTeams(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const full = team.filter(Boolean).length === 3;
  const save = (e) => {
    e.preventDefault();
    setNotice(null);
    extrasApi.saveTeam(name.trim(), team.map((c) => c.id))
      .then((res) => { setTeams(res); setName(''); setNotice('Squadra salvata!'); })
      .catch((err) => setNotice(ERRORS[err?.code] || 'Salvataggio non riuscito.'));
  };
  const load = (saved) => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const picked = saved.cards.map((code) => byId.get(code));
    if (picked.some((c) => !c)) {
      setNotice(ERRORS.card_not_owned);
      return;
    }
    onLoad(picked);
  };
  const remove = (id) => extrasApi.deleteTeam(id).then(setTeams).catch(() => {});

  return (
    <div className={`saved-teams${compact ? ' compact' : ''}`}>
      {teams.length > 0 && (
        <ul className="saved-teams-list">
          {teams.map((t) => (
            <li key={t.id}>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => load(t)} title={`Usa la squadra ${t.name}`}>
                <i className="ph-fill ph-users-three" /> {t.name}
              </button>
              {!compact && (
                <button type="button" className="saved-team-delete" onClick={() => remove(t.id)} aria-label={`Cancella la squadra ${t.name}`}>
                  <i className="ph ph-x" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!compact && full && (
        <form className="saved-teams-save" onSubmit={save}>
          <input className="filter-select" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nome della squadra" aria-label="Nome della squadra" />
          <button type="submit" className="btn btn-secondary btn-small" disabled={!name.trim()}><i className="ph-fill ph-floppy-disk" /> Salva squadra</button>
        </form>
      )}
      {notice && <small className="saved-teams-notice" role="status">{notice}</small>}
    </div>
  );
}
