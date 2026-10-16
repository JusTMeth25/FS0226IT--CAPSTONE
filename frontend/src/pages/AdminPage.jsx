import { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { adminApi } from '../services/adminApi.js';
import { SOURCE_LABELS, formatMarketPrice } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import AdminHotelTab from '../components/admin/AdminHotelTab.jsx';
import CasinoBankPanel from '../components/admin/CasinoBankPanel.jsx';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import '../styles/pages/social-phantom.css';
import '../styles/pages/social-admin.css';

/** Cassa del banco del casino: il gestore riscuote gli incassi. */
function CasinoTab() {
  return (
    <div className="glass-panel">
      <h3 className="panel-title"><i className="ph-fill ph-poker-chip" /> Incassi del casinò</h3>
      <CasinoBankPanel />
    </div>
  );
}

const TABS = [
  { key: 'users', label: 'Utenti', icon: 'ph-users' },
  { key: 'cards', label: 'Carte', icon: 'ph-cards' },
  { key: 'packs', label: 'Pacchetti', icon: 'ph-gift' },
  { key: 'import', label: 'Import esterno', icon: 'ph-download-simple' },
  { key: 'missions', label: 'Missioni', icon: 'ph-target' },
  { key: 'events', label: 'Eventi', icon: 'ph-calendar-star' },
  { key: 'hotel', label: 'Hotel', icon: 'ph-buildings' },
  { key: 'casino', label: 'Incassi casinò', icon: 'ph-poker-chip' },
  { key: 'logs', label: 'Log', icon: 'ph-list-checks' }
];

function Resource({ fetcher, deps, emptyLabel, errorLabel, render }) {
  const { loading, error, data, reload } = useApiResource(fetcher, deps);
  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <EmptyState
        icon="ph-plug"
        title="Dati non disponibili"
        description={errorLabel || 'Questa sezione non è al momento raggiungibile. Riprova più tardi.'}
        action={<button className="btn btn-secondary" onClick={reload}><i className="ph-fill ph-arrows-clockwise" /> Riprova</button>}
      />
    );
  }
  return render(data, reload) || <EmptyState title="Nessun dato" description={emptyLabel || 'Nessun elemento presente.'} />;
}

/** Editor inline per aggiungere/togliere gold a un utente dal pannello admin. */
function UserGoldEditor({ user, onSaved }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function apply(sign) {
    const n = Math.abs(parseInt(amount, 10) || 0);
    if (!n) return;
    const newTotal = Math.max(0, user.gold + sign * n);
    setSaving(true);
    setError(null);
    try {
      await adminApi.setUserGold(user.id, newTotal);
      setAmount('');
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="admin-gold-editor">
      <strong>{user.gold}</strong>
      <input
        type="number" min="0" placeholder="qta" value={amount} aria-label={`Gold da aggiungere o togliere a ${user.username}`}
        onChange={(e) => setAmount(e.target.value)}
        className="ai-input admin-gold-input"
        disabled={saving}
      />
      <button className="btn btn-small btn-secondary" disabled={saving || !amount} title="Aggiungi gold" aria-label={`Aggiungi gold a ${user.username}`} onClick={() => apply(1)}>
        <i className="ph ph-plus" />
      </button>
      <button className="btn btn-small btn-secondary" disabled={saving || !amount} title="Togli gold" aria-label={`Togli gold a ${user.username}`} onClick={() => apply(-1)}>
        <i className="ph ph-minus" />
      </button>
      {error && <span className="admin-gold-error" title={error}><i className="ph-fill ph-warning" /></span>}
    </span>
  );
}

function UsersTab() {
  return (
    <Resource
      fetcher={() => adminApi.getUsers()}
      deps={[]}
      errorLabel="Impossibile caricare la lista utenti."
      render={(data, reload) => {
        const users = data?.users || [];
        if (!users.length) return null;
        return (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Username</th><th>Email</th><th>Gold</th><th>Ruolo</th><th>Stato</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Username">{u.username}</td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Gold"><UserGoldEditor key={`${u.id}-${u.gold}`} user={u} onSaved={reload} /></td>
                    <td data-label="Ruolo">{u.role === 'ADMIN' && <span className="badge-role-admin">Admin</span>}</td>
                    <td data-label="Stato">{u.banned && <span className="badge-banned">Bannato</span>}</td>
                    <td>
                      <button className="btn btn-small btn-secondary" onClick={async () => { await (u.banned ? adminApi.unbanUser(u.id) : adminApi.banUser(u.id)); reload(); }}>
                        {u.banned ? 'Sblocca' : 'Banna'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}

/** Regala copie della carta scelta nella tabella a un utente. */
function GiveCardPanel({ card, onClose }) {
  const { data } = useApiResource(() => adminApi.getUsers(), []);
  const users = data?.users || [];
  const [userId, setUserId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function give(e) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminApi.giveCard(userId, card.id, quantity);
      setMessage({ type: 'success', text: `${res.card} data a ${res.username}: ora ne ha ${res.quantity}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form-row glass-panel admin-give-card" onSubmit={give}>
      <span><i className="ph-fill ph-gift" /> Dai <strong>{card.name}</strong>{card.variant && card.variant !== card.name ? ` (${card.variant})` : ''}</span>
      <select className="ai-input" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Utente">
        <option value="">Scegli l'utente…</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
      </select>
      <input type="number" min="1" max="99" className="ai-input admin-gold-input" value={quantity} aria-label="Copie"
        onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))} />
      <button type="submit" className="btn btn-primary btn-small" disabled={busy || !userId}>Dai carta</button>
      <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>Chiudi</button>
      {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
    </form>
  );
}

function CardsTab() {
  // Il catalogo e' enorme: il server manda le ultime 300 carte, o quelle che corrispondono alla ricerca.
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [giving, setGiving] = useState(null);
  return (
    <>
    <form className="admin-form-row glass-panel" onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); }}>
      <input className="ai-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome, codice o fonte (es. weiss)" aria-label="Cerca carte" />
      <button type="submit" className="btn btn-primary btn-small">Cerca</button>
    </form>
    {giving && <GiveCardPanel key={giving.id} card={giving} onClose={() => setGiving(null)} />}
    <Resource
      fetcher={() => adminApi.getCards(search)}
      deps={[search]}
      errorLabel="Impossibile caricare le carte."
      render={(data) => {
        const cards = data?.cards || [];
        if (!cards.length) return null;
        return (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Nome</th><th>Set</th><th>Rarità</th><th>Fonte</th><th>Valore</th><th /></tr></thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Nome">{c.name}{c.variant && c.variant !== c.name && <small className="admin-card-variant"> · {c.variant}</small>}</td>
                    <td data-label="Set">{c.setName}</td>
                    <td data-label="Rarità">{c.rarity}</td>
                    <td data-label="Fonte">{c.source}</td>
                    <td data-label="Valore">{formatMarketPrice(c.marketPrice) || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-small btn-secondary" onClick={() => setGiving(c)} title="Dai questa carta a un utente">
                        <i className="ph-fill ph-gift" /> Dai
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
    </>
  );
}

function PacksTab() {
  return (
    <Resource
      fetcher={() => adminApi.getPacks()}
      deps={[]}
      errorLabel="Impossibile caricare i pacchetti."
      render={(data) => {
        const packs = data?.packs || [];
        if (!packs.length) return null;
        return (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Nome</th><th>Prezzo</th><th>Carte</th><th>Attivo</th></tr></thead>
              <tbody>
                {packs.map((p) => (
                  <tr key={p.id}><td data-label="Nome">{p.name}</td><td data-label="Prezzo">{p.priceGold}</td><td data-label="Carte">{p.cardCount}</td><td data-label="Attivo">{p.isActive ? 'Sì' : 'No'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}

function ImportTab() {
  const [status, setStatus] = useState({});
  const [count, setCount] = useState(100);

  async function runImport(key, fn) {
    setStatus((s) => ({ ...s, [key]: { loading: true } }));
    try {
      const res = await fn();
      const detail = res?.dbError
        ? `Fonte esterna non raggiungibile (${res.error}) e anche il database non è raggiungibile (${res.dbError}): nessuna carta importata.`
        : res?.usedFallback
        ? `Servizio non raggiungibile (${res.error}): importate ${res?.imported ?? 0} carte demo di fallback.`
        : `Importate ${res?.imported ?? 0} carte nuove/aggiornate${res?.totalAvailable ? ` (su ${res.totalAvailable} disponibili nella fonte)` : ''}.`;
      setStatus((s) => ({ ...s, [key]: { loading: false, ok: !res?.usedFallback, message: detail } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [key]: { loading: false, ok: false, message: err.message } }));
    }
  }

  const sources = [
    { key: 'pokemon', label: SOURCE_LABELS.pokemon, fn: () => adminApi.importPokemon({ limit: count }) },
    { key: 'scryfall', label: SOURCE_LABELS.scryfall, fn: () => adminApi.importScryfall({ limit: count }) },
    { key: 'yugioh', label: SOURCE_LABELS.yugioh, fn: () => adminApi.importYugioh({ limit: count }) },
    { key: 'onepiece', label: SOURCE_LABELS.onepiece, fn: () => adminApi.importOnePiece({ limit: count }) },
    { key: 'digimon', label: SOURCE_LABELS.digimon, fn: () => adminApi.importDigimon({ limit: count }) },
    { key: 'lorcana', label: SOURCE_LABELS.lorcana, fn: () => adminApi.importLorcana({ limit: count }) },
    { key: 'riftbound', label: SOURCE_LABELS.riftbound, fn: () => adminApi.importRiftbound({ limit: count }) },
    { key: 'nikke', label: SOURCE_LABELS.nikke, fn: () => adminApi.importNikke({ limit: count }) },
    ...TCGPLAYER_GAMES.map((key) => ({ key, label: SOURCE_LABELS[key], fn: () => adminApi.importSource(key, { limit: count }) })),
    { key: 'gundam', label: SOURCE_LABELS.gundam, fn: () => adminApi.importGundam({ limit: count }) },
    { key: 'dragonball', label: SOURCE_LABELS.dragonball, fn: () => adminApi.importDragonBall({ limit: count }) },
    { key: 'nba', label: SOURCE_LABELS.nba, fn: () => adminApi.importSource('nba', { limit: count }) }
  ];

  return (
    <div className="admin-list">
      <div className="admin-form-row glass-panel">
        <div className="filter-group">
          <label className="filter-label">Carte da importare per click (max ~200)</label>
          <input
            className="ai-input"
            type="number"
            min="1"
            max="250"
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(250, Number(e.target.value) || 1)))}
          />
        </div>
      </div>
      <p className="page-subtitle">
        Ogni fonte ha migliaia di carte: ogni click importa un blocco da un punto casuale del database esterno,
        così click ripetuti aggiungono carte nuove invece di riscrivere sempre le stesse.
      </p>
      {sources.map((s) => (
        <div className="admin-list-item glass-panel" key={s.key}>
          <div className="listing-item-info">
            <span className="listing-item-name">{s.label}</span>
            {status[s.key] && <span className="listing-item-meta" style={{ color: status[s.key].ok === false ? '#FF5252' : 'var(--text-secondary)' }}>{status[s.key].message}</span>}
          </div>
          <button className="btn btn-primary btn-small" disabled={status[s.key]?.loading} onClick={() => runImport(s.key, s.fn)}>
            {status[s.key]?.loading ? 'Import…' : 'Importa'}
          </button>
          {FULL_CATALOG.has(s.key) && (
            <button className="btn btn-secondary btn-small" disabled={status[s.key]?.loading} title="Tutte le carte del gioco: può richiedere alcuni minuti"
              onClick={() => runImport(s.key, () => adminApi.importSource(s.key, { all: true }))}>
              Tutto il catalogo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MissionsTab() {
  return (
    <Resource
      fetcher={() => adminApi.getMissions()}
      deps={[]}
      errorLabel="Impossibile caricare le missioni."
      render={(data) => {
        const missions = data?.missions || [];
        if (!missions.length) return null;
        return (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Titolo</th><th>Tipo</th><th>Target</th><th>Gold</th></tr></thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id}><td data-label="Titolo">{m.title}</td><td data-label="Tipo">{m.type}</td><td data-label="Target">{m.targetValue}</td><td data-label="Gold">{m.rewardGold}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}

function EventsTab() {
  return (
    <Resource
      fetcher={() => adminApi.getEvents()}
      deps={[]}
      errorLabel="Impossibile caricare gli eventi."
      render={(data) => {
        const events = data?.events || [];
        if (!events.length) return null;
        return (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Nome</th><th>Inizio</th><th>Fine</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}><td data-label="Nome">{e.name}</td><td data-label="Inizio">{e.startsAt ? new Date(e.startsAt).toLocaleDateString('it-IT') : '—'}</td><td data-label="Fine">{e.endsAt ? new Date(e.endsAt).toLocaleDateString('it-IT') : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}

function LogsTab() {
  return (
    <div className="admin-list">
      <div className="glass-panel">
        <h3 className="panel-title">Aperture pacchetti</h3>
        <Resource fetcher={() => adminApi.getPackOpeningLogs()} deps={[]} errorLabel="Impossibile caricare i log." render={(data) => {
          const logs = data?.logs || [];
          if (!logs.length) return null;
          return (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Utente</th><th>Pacchetto</th><th>Data</th></tr></thead>
                <tbody>{logs.map((l) => <tr key={l.id}><td data-label="Utente">{l.user?.username}</td><td data-label="Pacchetto">{l.pack?.name}</td><td data-label="Data">{new Date(l.createdAt).toLocaleString('it-IT')}</td></tr>)}</tbody>
              </table>
            </div>
          );
        }} />
      </div>
      <div className="glass-panel">
        <h3 className="panel-title">Annunci di mercato</h3>
        <Resource fetcher={() => adminApi.getMarketListings()} deps={[]} errorLabel="Impossibile caricare gli annunci." render={(data) => {
          const listings = data?.listings || [];
          if (!listings.length) return null;
          return (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Venditore</th><th>Carta</th><th>Prezzo</th></tr></thead>
                <tbody>{listings.map((l) => <tr key={l.id}><td data-label="Venditore">{l.seller?.username}</td><td data-label="Carta">{l.card?.name}</td><td data-label="Prezzo">{l.pricePerUnit}</td></tr>)}</tbody>
              </table>
            </div>
          );
        }} />
      </div>
      <div className="glass-panel">
        <h3 className="panel-title">Scambi</h3>
        <Resource fetcher={() => adminApi.getTrades()} deps={[]} errorLabel="Impossibile caricare gli scambi." render={(data) => {
          const trades = data?.trades || [];
          if (!trades.length) return null;
          return (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Da</th><th>A</th><th>Stato</th></tr></thead>
                <tbody>{trades.map((t) => <tr key={t.id}><td data-label="Da">{t.fromUser?.username}</td><td data-label="A">{t.toUser?.username}</td><td data-label="Stato">{t.status}</td></tr>)}</tbody>
              </table>
            </div>
          );
        }} />
      </div>
    </div>
  );
}

const TAB_COMPONENTS = {
  users: UsersTab, cards: CardsTab, packs: PacksTab, import: ImportTab, missions: MissionsTab, events: EventsTab, hotel: AdminHotelTab, casino: CasinoTab, logs: LogsTab
};


/** Giochi importati dal catalogo TCGplayer (TcgcsvImporter nel backend). */
const TCGPLAYER_GAMES = ['cyberpunk', 'hololive', 'unionarena', 'shadowverse', 'wixoss', 'grandarchive', 'weiss', 'vanguard', 'pokemonjp', 'pokemonpromo'];
/** Fonti che sanno importare tutto il loro catalogo in un colpo (richiesta con all: true). */
const FULL_CATALOG = new Set([...TCGPLAYER_GAMES, 'pokemon', 'yugioh', 'scryfall', 'onepiece', 'digimon', 'lorcana', 'riftbound', 'dragonball']);

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const ActiveTab = TAB_COMPONENTS[tab];

  return (
    <section className="admin-page sp-page">
      <header className="sp-head">
        <PhantomTitle as="h2" text="Pannello admin" />
        <p className="sp-sub">Utenti, catalogo, import delle carte, missioni, eventi, hotel e incassi del casinò.</p>
      </header>

      <div className="admin-tabs sp-tabs" role="group" aria-label="Sezioni del pannello">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`sp-tab adm-tab${tab === t.key ? ' is-active' : ''}`} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            <i className={`ph-fill ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <div className="glass-panel adm-body">
        <ActiveTab />
      </div>
    </section>
  );
}
