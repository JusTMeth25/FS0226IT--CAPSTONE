import { useCallback, useEffect, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';
import AvatarPreview from './AvatarPreview.jsx';

const ERRORS = {
  club_already_member: 'Sei già in un club: prima esci da quello.',
  club_name: 'Il nome deve avere da 3 a 30 caratteri.',
  club_tag: 'La sigla: da 2 a 4 lettere o numeri.',
  club_taken: 'Nome o sigla già usati da un altro club.',
  club_full: 'Il club è pieno.',
  insufficient_gold: 'Non hai abbastanza gold.'
};

const COLORS = ['#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#64748b'];

/**
 * Club dell'hotel: la lista dei club (con i punti negli eventi della settimana), il proprio club
 * con i membri e la sede, e il modulo per fondarne uno nuovo.
 */
export default function ClubPanel({ gold, onJoinRoom, onChanged, onClose }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', tag: '', color: COLORS[0], icon: 'vinyl-record', motto: '' });

  const load = useCallback(() => {
    hotelApi.clubs().then(setData).catch(() => setNotice('Club non raggiungibili, riprova.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = (promise, ok) => promise.then((res) => {
    if (res?.clubs) setData(res); else load();
    if (ok) setNotice(ok);
    setCreating(false);
    onChanged?.();
  }).catch((err) => setNotice(ERRORS[err?.code] || (err?.status === 402 ? ERRORS.insufficient_gold : 'Non riuscito, riprova.')));

  const club = data?.club;
  return (
    <div className="hotel-panel hotel-clubs" role="dialog" aria-label="Club">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-flag-banner" /> Club</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-clubs-body">
        {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
        {!data && !notice && <p className="hotel-panel-hint">Carico i club…</p>}

        {club && (
          <section className="club-mine" style={{ '--club-color': club.color }}>
            <header>
              <span className="club-crest"><i className={`ph-fill ph-${club.icon}`} /></span>
              <div>
                <strong>{club.name} <span className="club-tag">{club.tag}</span></strong>
                {club.motto && <small>{club.motto}</small>}
              </div>
            </header>
            <div className="club-actions">
              {club.roomId && (
                <button type="button" className="btn btn-primary btn-small" onClick={() => onJoinRoom(club.roomId)}>
                  <i className="ph-fill ph-house-line" /> Vai alla sede
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-small"
                onClick={() => { if (window.confirm('Uscire dal club?')) run(hotelApi.leaveClub(), 'Sei uscito dal club.'); }}>
                Esci dal club
              </button>
            </div>
            <h4 className="events-sub">Membri ({club.members.length})</h4>
            <ul className="club-members">
              {club.members.map((m) => (
                <li key={m.id} className={m.online ? 'online' : ''}>
                  <AvatarPreview look={m.look} scale={0.45} />
                  <div>
                    <strong>{m.username}{m.role === 'OWNER' ? ' ★' : ''}</strong>
                    <small>{m.online ? (m.roomName ? `In ${m.roomName}` : 'Online') : 'Offline'}</small>
                  </div>
                  {m.roomId && <button type="button" className="btn btn-secondary btn-small" onClick={() => onJoinRoom(m.roomId)} title="Raggiungi"><i className="ph-fill ph-person-simple-walk" /></button>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data && !club && !creating && (
          <button type="button" className="btn btn-gold btn-small club-found" onClick={() => setCreating(true)}>
            <i className="ph-fill ph-flag-banner" /> Fonda un club · {data.cost} gold
          </button>
        )}

        {creating && (
          <form className="club-form" onSubmit={(e) => { e.preventDefault(); run(hotelApi.createClub(form), `Benvenuto nel tuo club, ${form.name}!`); }}>
            <label>Nome <input value={form.name} maxLength={30} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Sigla <input value={form.tag} maxLength={4} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} required /></label>
            <label>Motto <input value={form.motto} maxLength={120} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></label>
            <div className="club-colors" role="radiogroup" aria-label="Colore">
              {COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={form.color === c} aria-label={c}
                  className={form.color === c ? 'active' : ''} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
            <div className="club-icons" role="radiogroup" aria-label="Stemma">
              {(data?.icons || []).map((icon) => (
                <button key={icon} type="button" role="radio" aria-checked={form.icon === icon} aria-label={icon}
                  className={form.icon === icon ? 'active' : ''} onClick={() => setForm({ ...form, icon })}>
                  <i className={`ph-fill ph-${icon}`} />
                </button>
              ))}
            </div>
            <div className="club-actions">
              <button type="submit" className="btn btn-gold btn-small" disabled={gold < (data?.cost || 0)}>Fonda ({data?.cost} gold)</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setCreating(false)}>Annulla</button>
            </div>
            <small>Il club ha una sede tutta sua, aperta a tutti i membri, e la sigla compare accanto al tuo nome.</small>
          </form>
        )}

        <h4 className="events-sub">Classifica dei club (eventi della settimana)</h4>
        <ol className="club-list">
          {(data?.clubs || []).length === 0 && <li className="hotel-panel-hint">Ancora nessun club: fonda il primo!</li>}
          {(data?.clubs || []).map((c, i) => (
            <li key={c.id} style={{ '--club-color': c.color }}>
              <span className="event-rank">{i + 1}</span>
              <span className="club-crest small"><i className={`ph-fill ph-${c.icon}`} /></span>
              <div>
                <strong>{c.name} <span className="club-tag">{c.tag}</span></strong>
                <small>{c.members} membri · {c.points} punti · di {c.ownerName}</small>
              </div>
              {!club && <button type="button" className="btn btn-secondary btn-small" onClick={() => run(hotelApi.joinClub(c.id), `Sei entrato in ${c.name}!`)}>Entra</button>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
