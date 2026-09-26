import { useCallback, useEffect, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';

const DAY = { weekday: 'long', hour: '2-digit', minute: '2-digit' };

function remaining(endsAt, now) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Eventi dell'hotel: quelli in corso con la classifica, i prossimi e gli ultimi vincitori. */
export function EventsTab({ me, version }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => {
    hotelApi.events().then(setData).catch(() => setError('Eventi non raggiungibili, riprova.'));
  }, []);
  useEffect(() => { reload(); }, [reload, version]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <p className="hotel-panel-hint">{error || 'Carico gli eventi…'}</p>;
  return (
    <div className="events-tab">
      {data.current.length === 0 && <p className="hotel-panel-hint">Nessun evento in corso adesso. Guarda i prossimi qui sotto!</p>}
      {data.current.map((event) => (
        <section key={event.key} className="event-live">
          <header>
            <i className={`ph-fill ph-${event.icon}`} />
            <div>
              <strong>{event.title}</strong>
              <span>{event.rules} · {event.room}</span>
            </div>
            <b className="event-clock" aria-label="Tempo rimasto">{remaining(event.endsAt, now)}</b>
          </header>
          <ol className="event-board">
            {event.leaderboard.length === 0 && <li className="hotel-panel-hint">Ancora nessun punto: fai il primo!</li>}
            {event.leaderboard.map((row, i) => (
              <li key={row.userId} className={row.userId === me?.id ? 'mine' : ''}>
                <span className="event-rank">{i + 1}</span>
                <span className="event-name">{row.username}</span>
                <b>{row.score}</b>
                {i < data.prizes.length && <small><i className="ph-fill ph-coin" /> {data.prizes[i]}</small>}
              </li>
            ))}
          </ol>
          <p className="hotel-panel-hint">Il tuo punteggio: <b>{event.myScore}</b></p>
        </section>
      ))}

      <h4 className="events-sub">Prossimi eventi</h4>
      <ul className="event-list">
        {data.upcoming.map((event) => (
          <li key={`${event.key}${event.startsAt}`}>
            <i className={`ph-fill ph-${event.icon}`} />
            <div><strong>{event.title}</strong><span>{event.room} · {event.rules}</span></div>
            <time>{new Date(event.startsAt).toLocaleString('it-IT', DAY)}</time>
          </li>
        ))}
      </ul>

      {data.recent.length > 0 && (
        <>
          <h4 className="events-sub">Ultimi vincitori</h4>
          <ul className="event-list">
            {data.recent.map((r) => (
              <li key={`${r.key}${r.edition}`}>
                <i className="ph-fill ph-trophy" />
                <div>
                  <strong>{r.title}</strong>
                  <span>{r.winners.length ? r.winners.map((w, i) => `${i + 1}. ${w.username} (${w.score})`).join('  ') : 'Nessun partecipante'}</span>
                </div>
                <time>{new Date(r.edition).toLocaleDateString('it-IT')}</time>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Striscia in alto quando c'e' un evento in corso: cliccandola si apre la classifica. */
export function EventBanner({ events, onOpen }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const live = events.filter((e) => new Date(e.endsAt).getTime() > now);
  if (!live.length) return null;
  const event = live[0];
  return (
    <button type="button" className="hotel-event-banner" onClick={onOpen}>
      <i className={`ph-fill ph-${event.icon || 'trophy'}`} />
      <span><b>{event.title}</b> in corso · {event.room}</span>
      <time>{remaining(event.endsAt, now)}</time>
      <span className="hotel-event-banner-go">Classifica <i className="ph ph-caret-right" /></span>
    </button>
  );
}

/**
 * Piazza dell'hotel: eventi a orario, asta e mostra delle collezioni in un solo pannello a schede.
 */
export default function EventsPanel({ me, version, tabs, initialTab = 'events', onClose }) {
  const [tab, setTab] = useState(initialTab);
  const all = [{ key: 'events', label: 'Eventi', icon: 'ph-trophy', render: () => <EventsTab me={me} version={version} /> }, ...(tabs || [])];
  const active = all.find((t) => t.key === tab) || all[0];
  return (
    <div className="hotel-panel hotel-events" role="dialog" aria-label="Piazza">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-confetti" /> Piazza</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-tabs" role="tablist">
        {all.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={active.key === t.key}
            className={`hotel-tab${active.key === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            <i className={`ph-fill ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>
      <div className="hotel-events-body">{active.render()}</div>
    </div>
  );
}
