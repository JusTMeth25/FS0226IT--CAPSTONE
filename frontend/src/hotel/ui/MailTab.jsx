import { useCallback, useEffect, useMemo, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';
import { collectionApi } from '../../services/collectionApi.js';
import { getRarityColor, resolveCardImage } from '../../utils/cardUtils.js';

const ERRORS = {
  not_friends: 'Puoi mandare posta solo agli amici.',
  mail_empty: 'Metti dei gold o una carta nel pacco.',
  mail_gold: 'Al massimo 10.000 gold.',
  insufficient_gold: 'Non hai abbastanza gold.',
  insufficient_quantity: 'Non hai più quella carta.'
};

/**
 * Posta fra amici: si spedisce un pacco con gold e/o una carta e un biglietto, anche a chi non
 * e' collegato. Chi lo riceve lo ritira quando vuole.
 */
export default function MailTab({ friends, gold, version, onUnread, onChanged }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [card, setCard] = useState(null);
  const [owned, setOwned] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    hotelApi.mail().then((res) => { setData(res); onUnread?.(res.unread); }).catch(() => setNotice('Posta non raggiungibile.'));
  }, [onUnread]);
  useEffect(() => { load(); }, [load, version]);

  const openCompose = () => {
    setComposing(true);
    if (!owned) collectionApi.getCollection({ owned: 'true' }).then((res) => setOwned(res.collection || [])).catch(() => setOwned([]));
  };

  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (owned || []).filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 30);
  }, [owned, query]);

  const run = (promise, ok) => promise.then((res) => {
    setData(res);
    onUnread?.(res.unread);
    setNotice(ok);
    onChanged?.();
  }).catch((err) => setNotice(ERRORS[err?.code] || (err?.status === 402 ? ERRORS.insufficient_gold : 'Non riuscito, riprova.')));

  const send = (e) => {
    e.preventDefault();
    const g = Number(amount) || 0;
    if (!to || (g <= 0 && !card)) return;
    run(hotelApi.sendMail(to, g, card?.id || null, note.trim()), 'Pacco spedito!').then(() => {
      setComposing(false); setAmount(''); setNote(''); setCard(null);
    });
  };

  return (
    <div className="mail-tab">
      {notice && <p className="hotel-panel-hint" role="status">{notice}</p>}
      {!composing ? (
        <button type="button" className="btn btn-primary btn-small" onClick={openCompose} disabled={friends.length === 0}>
          <i className="ph-fill ph-envelope-simple" /> Spedisci un regalo
        </button>
      ) : (
        <form className="mail-compose" onSubmit={send}>
          <label>A
            <select value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Scegli un amico</option>
              {friends.map((f) => <option key={f.id} value={f.id}>{f.username}</option>)}
            </select>
          </label>
          <label>Gold
            <input type="number" min="0" max={Math.min(10000, gold)} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Una carta? Cercala" aria-label="Cerca carta da regalare" />
          <div className="stall-picker">
            {composing && !owned && <small>Carico la collezione…</small>}
            {choices.map((c) => (
              <button key={c.id} type="button" className={`stall-pick${card?.id === c.id ? ' picked' : ''}`}
                onClick={() => setCard(card?.id === c.id ? null : c)} style={{ '--rarity-color': getRarityColor(c.rarity) }}
                title={c.name} aria-pressed={card?.id === c.id}>
                <img src={resolveCardImage(c)} alt={c.name} loading="lazy" />
              </button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Biglietto (facoltativo)" aria-label="Biglietto" />
          <div className="club-actions">
            <button type="submit" className="btn btn-gold btn-small" disabled={!to || (!(Number(amount) > 0) && !card)}>Spedisci</button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setComposing(false)}>Annulla</button>
          </div>
        </form>
      )}

      <ul className="mail-list">
        {data && data.inbox.length === 0 && <li className="hotel-panel-hint">Casella vuota.</li>}
        {data?.inbox.map((m) => (
          <li key={m.id} className={m.claimedAt ? 'claimed' : 'new'}>
            <i className={`ph-fill ${m.claimedAt ? 'ph-envelope-open' : 'ph-envelope-simple'}`} />
            <div>
              <strong>Da {m.from || 'un ex giocatore'}</strong>
              <small>
                {m.gold > 0 && <><i className="ph-fill ph-coin" /> {m.gold} </>}
                {m.card && <>· {m.card.name}</>}
              </small>
              {m.note && <p>«{m.note}»</p>}
            </div>
            {!m.claimedAt && <button type="button" className="btn btn-gold btn-small" onClick={() => run(hotelApi.claimMail(m.id), 'Regalo ritirato!')}>Ritira</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
