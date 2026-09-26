import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';

const DAYS = ['Ogni giorno', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const EMPTY_EVENT = { title: '', game: 'basket', sum: false, dayOfWeek: '', start: '17:00', minutes: 30, room: '', rules: '', prize1: 300, prize2: 150, prize3: 75 };

/** Eventi a orario: quelli fissi (sola lettura) e quelli creati qui, da accendere, spegnere o togliere. */
function EventsSection() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [notice, setNotice] = useState(null);
  const load = useCallback(() => { apiClient.get('/admin/hotel/events').then(setData).catch(() => setNotice('Eventi non caricati.')); }, []);
  useEffect(() => { load(); }, [load]);
  const run = (promise, ok) => promise.then((res) => { setData(res); setNotice(ok); }).catch((err) => setNotice(`Errore: ${err?.code || err?.message}`));
  const submit = (e) => {
    e.preventDefault();
    run(apiClient.post('/admin/hotel/events', { ...form, dayOfWeek: form.dayOfWeek ? Number(form.dayOfWeek) : null, minutes: Number(form.minutes),
      prize1: Number(form.prize1), prize2: Number(form.prize2), prize3: Number(form.prize3) }), 'Evento creato.');
    setForm(EMPTY_EVENT);
  };
  const field = (key, props = {}) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: props.type === 'checkbox' ? e.target.checked : e.target.value }), ...props });
  return (
    <section className="glass-panel admin-hotel-section">
      <h3 className="panel-title"><i className="ph-fill ph-calendar-star" /> Eventi a orario</h3>
      {notice && <p role="status">{notice}</p>}
      <form className="admin-hotel-form" onSubmit={submit}>
        <label>Titolo <input {...field('title')} required maxLength={60} /></label>
        <label>Gioco
          <select {...field('game')}>{(data?.games || []).map((g) => <option key={g} value={g}>{g === 'goals' ? 'gol allo stadio' : g}</option>)}</select>
        </label>
        <label>Giorno
          <select {...field('dayOfWeek')}>{DAYS.map((d, i) => <option key={d} value={i || ''}>{d}</option>)}</select>
        </label>
        <label>Ora <input {...field('start')} type="time" required /></label>
        <label>Minuti <input {...field('minutes')} type="number" min="5" max="240" /></label>
        <label>Stanza <input {...field('room')} maxLength={60} placeholder="Hotel" /></label>
        <label className="wide">Regole <input {...field('rules')} maxLength={200} placeholder="Miglior punteggio ai tiri liberi" /></label>
        <label className="check"><input type="checkbox" checked={form.sum} onChange={(e) => setForm({ ...form, sum: e.target.checked })} /> Somma i punteggi (invece del migliore)</label>
        <label>1° <input {...field('prize1')} type="number" min="0" /></label>
        <label>2° <input {...field('prize2')} type="number" min="0" /></label>
        <label>3° <input {...field('prize3')} type="number" min="0" /></label>
        <button type="submit" className="btn btn-primary btn-small">Crea evento</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Evento</th><th>Gioco</th><th>Quando</th><th>Premi</th><th>Stato</th><th /></tr></thead>
          <tbody>
            {(data?.fixed || []).map((e) => (
              <tr key={e.key}><td data-label="Evento">{e.title} <small>(fisso)</small></td><td data-label="Gioco">{e.game}</td>
                <td data-label="Quando">{e.day} {e.start} · {e.minutes} min</td><td data-label="Premi">300 / 150 / 75</td><td data-label="Stato">attivo</td><td /></tr>
            ))}
            {(data?.custom || []).map((e) => (
              <tr key={e.id}>
                <td data-label="Evento">{e.title}</td><td data-label="Gioco">{e.game}{e.sum ? ' (somma)' : ''}</td>
                <td data-label="Quando">{DAYS[e.dayOfWeek || 0]} {String(e.start).slice(0, 5)} · {e.minutes} min</td>
                <td data-label="Premi">{e.prize1} / {e.prize2} / {e.prize3}</td>
                <td data-label="Stato">{e.active ? 'attivo' : 'spento'}</td>
                <td>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => run(apiClient.post(`/admin/hotel/events/${e.id}/toggle`), 'Fatto.')}>{e.active ? 'Spegni' : 'Accendi'}</button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => { if (window.confirm('Eliminare l’evento?')) run(apiClient.delete(`/admin/hotel/events/${e.id}`), 'Eliminato.'); }}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Asta: la carta in vendita, avvio immediato con una carta scelta, annullamento con rimborso. */
function AuctionSection() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ card: '', startBid: '', minutes: 5 });
  const [notice, setNotice] = useState(null);
  const load = useCallback(() => { apiClient.get('/admin/hotel/auction').then(setData).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  const run = (promise, ok) => promise.then((res) => { setData(res); setNotice(ok); }).catch((err) => setNotice(`Errore: ${err?.code || err?.message}`));
  return (
    <section className="glass-panel admin-hotel-section">
      <h3 className="panel-title"><i className="ph-fill ph-gavel" /> Asta</h3>
      {notice && <p role="status">{notice}</p>}
      {data?.lot ? (
        <p>In corso: <b>{data.lot.card?.name}</b> · offerta {data.lot.currentBid ?? `base ${data.lot.startBid}`} {data.lot.bidderName ? `di ${data.lot.bidderName}` : ''}
          {' '}<button type="button" className="btn btn-secondary btn-small" onClick={() => { if (window.confirm('Annullare l’asta? I gold tornano all’offerente.')) run(apiClient.post('/admin/hotel/auction/cancel'), 'Asta annullata.'); }}>Annulla asta</button>
        </p>
      ) : <p>Nessuna asta in corso.</p>}
      <form className="admin-hotel-form" onSubmit={(e) => { e.preventDefault(); run(apiClient.post('/admin/hotel/auction', { card: form.card.trim(), startBid: form.startBid ? Number(form.startBid) : null, minutes: Number(form.minutes) }), 'Asta avviata.'); }}>
        <label>Codice carta <input value={form.card} onChange={(e) => setForm({ ...form, card: e.target.value })} required placeholder="es. synth-001" /></label>
        <label>Base d&apos;asta <input type="number" min="1" value={form.startBid} onChange={(e) => setForm({ ...form, startBid: e.target.value })} placeholder="automatica" /></label>
        <label>Minuti <input type="number" min="1" max="120" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></label>
        <button type="submit" className="btn btn-primary btn-small" disabled={!!data?.lot}>Metti all&apos;asta ora</button>
      </form>
    </section>
  );
}

/** Moderazione: chat recente di tutte le stanze, silenziare e annunci a tutto l'hotel. */
function ModerationSection() {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState(null);
  const load = useCallback(() => { apiClient.get('/admin/hotel/chat').then(setData).catch(() => {}); }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);
  const mute = (userId, minutes) => apiClient.post(`/admin/hotel/users/${userId}/mute`, { minutes }).then(setData).then(() => setNotice('Giocatore silenziato.')).catch(() => setNotice('Non riuscito.'));
  return (
    <section className="glass-panel admin-hotel-section">
      <h3 className="panel-title"><i className="ph-fill ph-shield-check" /> Moderazione</h3>
      {notice && <p role="status">{notice}</p>}
      <form className="admin-hotel-form" onSubmit={(e) => { e.preventDefault(); apiClient.post('/admin/hotel/announce', { text }).then(() => { setNotice('Annuncio inviato.'); setText(''); }).catch(() => setNotice('Annuncio non inviato.')); }}>
        <label className="wide">Annuncio a tutto l&apos;hotel <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required /></label>
        <button type="submit" className="btn btn-primary btn-small">Invia</button>
      </form>
      {data?.muted?.length > 0 && (
        <p>Silenziati: {data.muted.map((m) => (
          <span key={m.userId}>{m.username} (fino alle {new Date(m.until).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}){' '}
            <button type="button" className="btn btn-secondary btn-small" onClick={() => apiClient.post(`/admin/hotel/users/${m.userId}/unmute`).then(setData)}>Riattiva</button>{' '}
          </span>
        ))}</p>
      )}
      <div className="admin-table-wrap admin-chat-log">
        <table className="admin-table">
          <thead><tr><th>Ora</th><th>Stanza</th><th>Utente</th><th>Messaggio</th><th /></tr></thead>
          <tbody>
            {(data?.messages || []).length === 0 && <tr><td colSpan={5}>Nessun messaggio recente.</td></tr>}
            {(data?.messages || []).map((m, i) => (
              <tr key={`${m.at}-${i}`}>
                <td data-label="Ora">{new Date(m.at).toLocaleTimeString('it-IT')}</td><td data-label="Stanza">{m.room}</td>
                <td data-label="Utente">{m.username}</td><td data-label="Messaggio">{m.text}</td>
                <td>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => mute(m.userId, 15)}>Zitto 15 min</button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => mute(m.userId, 24 * 60)}>24 ore</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminHotelTab() {
  return (
    <div className="admin-hotel">
      <EventsSection />
      <AuctionSection />
      <ModerationSection />
    </div>
  );
}
