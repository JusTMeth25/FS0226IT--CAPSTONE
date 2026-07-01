import { useApiResource } from '../hooks/useApiResource.js';
import { eventApi } from '../services/eventApi.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

export default function EventsPage() {
  const { loading, error, data, reload } = useApiResource(() => eventApi.getEvents(), []);
  const events = data?.events || [];

  return (
    <section className="events-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-calendar-star" /> Eventi</h2>
      <p className="page-subtitle">Eventi a tempo con pacchetti speciali, drop-rate bonus e missioni dedicate.</p>

      {loading ? (
        <LoadingSpinner label="Carico gli eventi…" />
      ) : error ? (
        <EmptyState
          icon="ph-plug"
          title="Eventi non raggiungibili"
          description="Il servizio eventi non è al momento disponibile. Riprova più tardi."
          action={<button className="btn btn-secondary" onClick={reload}><i className="ph-fill ph-arrows-clockwise" /> Riprova</button>}
        />
      ) : events.length === 0 ? (
        <EmptyState icon="ph-calendar-star" title="Nessun evento attivo" description="Torna più tardi per scoprire i prossimi eventi a tempo." />
      ) : (
        <div className="event-list">
          {events.map((event) => (
            <div className="event-item glass-panel" key={event.id}>
              <div className="listing-item-info">
                <span className="listing-item-name">{event.name}</span>
                <span className="listing-item-meta">{event.description}</span>
                {event.bonusDropRate && <span className="listing-item-meta">Bonus drop-rate: +{Math.round(event.bonusDropRate * 100)}%</span>}
                {event.endsAt && <span className="listing-item-meta">Termina: {new Date(event.endsAt).toLocaleDateString('it-IT')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
