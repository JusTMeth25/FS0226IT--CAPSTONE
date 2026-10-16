import { useLocation, useNavigate } from 'react-router-dom';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import StarBurst from '../components/phantom/StarBurst.jsx';
import '../styles/pages/social-news.css';

/**
 * Pagina inesistente come la schermata di "Game Over" di un gioco: ironica ma utile, dice
 * quale indirizzo non esiste e offre subito dove andare (come il "Continuare?" dei giochi).
 */
export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Solo se si e' arrivati qui da un'altra pagina dell'app ha senso "torna indietro".
  const canGoBack = location.key !== 'default';
  return (
    <section className="sg-over">
      <div className="sg-bg" aria-hidden="true">
        <span className="sg-shard sg-shard-1" />
        <span className="sg-shard sg-shard-2" />
        <StarBurst size={54} className="sg-star sg-star-1" />
        <StarBurst size={30} fill="#fff" stroke="#000" className="sg-star sg-star-2" />
      </div>
      <p className="sg-code">Errore 404</p>
      <PhantomTitle as="h2" variant="headline" text={'Game\nOver'} highlight="Over" className="sg-title" />
      <p className="sg-text">
        La pagina <code>{location.pathname}</code> non esiste: forse il link è vecchio o c&apos;è un errore di battitura.
        La tua collezione è al sicuro, la partita è salvata.
      </p>
      <p className="sg-ask" id="sg-ask">Continuare?</p>
      <nav className="sg-menu" aria-labelledby="sg-ask">
        <button type="button" className="sg-item is-main" onClick={() => navigate('/home')}>
          <i className="ph-fill ph-house" aria-hidden="true" /> Torna alla Home
        </button>
        {canGoBack && (
          <button type="button" className="sg-item" onClick={() => navigate(-1)}>
            <i className="ph ph-arrow-u-up-left" aria-hidden="true" /> Pagina precedente
          </button>
        )}
        <button type="button" className="sg-item" onClick={() => navigate('/collection')}>
          <i className="ph-fill ph-cards" aria-hidden="true" /> La mia collezione
        </button>
      </nav>
    </section>
  );
}
