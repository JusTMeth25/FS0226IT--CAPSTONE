import { useEffect } from 'react';
import { NEWS, NEWS_SEEN_KEY, NEWS_VERSION } from '../data/news.js';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import StarBurst from '../components/phantom/StarBurst.jsx';
import '../styles/pages/social-phantom.css';
import '../styles/pages/social-news.css';

const longDate = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Le novita' di VinylDex, dalla piu' recente, impaginate come un volantino: la testata col
 * titolo a ritaglio, la prima uscita in prima pagina su carta bianca, le altre come ritagli.
 */
export default function NewsPage() {
  useEffect(() => {
    try {
      localStorage.setItem(NEWS_SEEN_KEY, NEWS_VERSION);
      window.dispatchEvent(new Event('vinyldex-news-seen'));
    } catch {
      // Senza localStorage il pallino resta: niente di grave.
    }
  }, []);

  return (
    <section className="news-page sp-page">
      <header className="sp-head sn-mast">
        <p className="sn-edition">
          <span>Il giornale di VinylDex</span>
          {NEWS[0] && <span>Edizione del <time dateTime={NEWS[0].date}>{longDate(NEWS[0].date)}</time></span>}
        </p>
        <PhantomTitle as="h2" text="Novità" />
        <p className="sp-sub">Tutto quello che è arrivato di recente in VinylDex.</p>
      </header>
      {NEWS.map((release, i) => (
        <article key={`${release.date}-${release.title}`} className={`news-release${i === 0 ? ' is-front' : ''}`}>
          <header className="news-release-header">
            <span className="news-release-icon" aria-hidden="true"><i className={`ph-fill ${release.icon}`} /></span>
            <div className="news-release-head">
              <time dateTime={release.date}>{longDate(release.date)}</time>
              <h3>{release.title}</h3>
            </div>
            {i === 0 && (
              <span className="sn-new">
                <StarBurst size={84} fill="var(--neon-magenta)" />
                <b>Nuovo!</b>
              </span>
            )}
          </header>
          <ul className="news-items">
            {release.items.map(([icon, title, text]) => (
              <li key={title}>
                <i className={`ph-fill ${icon}`} aria-hidden="true" />
                <div><strong>{title}</strong><span>{text}</span></div>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
