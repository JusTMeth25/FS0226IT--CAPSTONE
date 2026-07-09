import { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource.js';
import { adminApi } from '../services/adminApi.js';
import { SOURCE_LABELS } from '../utils/cardUtils.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

const TABS = [
  { key: 'users', label: 'Utenti', icon: 'ph-users' },
  { key: 'cards', label: 'Carte', icon: 'ph-cards' },
  { key: 'packs', label: 'Pacchetti', icon: 'ph-gift' },
  { key: 'import', label: 'Import esterno', icon: 'ph-download-simple' },
  { key: 'missions', label: 'Missioni', icon: 'ph-target' },
  { key: 'events', label: 'Eventi', icon: 'ph-calendar-star' },
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
                    <td data-label="Gold">{u.gold}</td>
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

function CardsTab() {
  return (
    <Resource
      fetcher={() => adminApi.getCards()}
      deps={[]}
      errorLabel="Impossibile caricare le carte."
      render={(data) => {
        const cards = data?.cards || [];
        if (!cards.length) return null;
        return (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Nome</th><th>Set</th><th>Rarità</th><th>Fonte</th></tr></thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}><td data-label="Nome">{c.name}</td><td data-label="Set">{c.setName}</td><td data-label="Rarità">{c.rarity}</td><td data-label="Fonte">{c.source}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
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
      const detail = res?.usedFallback
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
    { key: 'gundam', label: SOURCE_LABELS.gundam, fn: () => adminApi.importGundam({ limit: count }) },
    { key: 'dragonball', label: SOURCE_LABELS.dragonball, fn: () => adminApi.importDragonBall({ limit: count }) }
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
  users: UsersTab, cards: CardsTab, packs: PacksTab, import: ImportTab, missions: MissionsTab, events: EventsTab, logs: LogsTab
};

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const ActiveTab = TAB_COMPONENTS[tab];

  return (
    <section className="admin-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-shield-star" /> Admin Panel</h2>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`btn btn-small ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.key)}>
            <i className={`ph-fill ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      <div className="glass-panel">
        <ActiveTab />
      </div>
    </section>
  );
}
