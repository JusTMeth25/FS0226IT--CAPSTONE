import { useApiResource } from '../hooks/useApiResource.js';
import { eventApi } from '../services/eventApi.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import '../styles/pages/game-ranks.css';

export default function EventsPage() {
  const { loading, error, data, reload } = useApiResource(() => eventApi.getEvents(), []);
  const events = data?.events || [];

  return (
    <section className="events-page">
      <PhantomTitle text="Eventi" className="game-page-title" />
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
            <article className="event-item glass-panel" key={event.id}>
              <div className="listing-item-info">
                <h3 className="listing-item-name event-item-name">{event.name}</h3>
                <p className="listing-item-meta event-item-desc">{event.description}</p>
                <div className="event-item-tags">
                  {event.bonusDropRate && <span className="event-tag event-tag-bonus"><i className="ph-fill ph-trend-up" aria-hidden="true" /> Drop-rate +{Math.round(event.bonusDropRate * 100)}%</span>}
                  {event.endsAt && <span className="event-tag"><i className="ph-fill ph-hourglass-medium" aria-hidden="true" /> Termina il {new Date(event.endsAt).toLocaleDateString('it-IT')}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
