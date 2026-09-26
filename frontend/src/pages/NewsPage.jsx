import { useEffect } from 'react';
import { NEWS, NEWS_SEEN_KEY, NEWS_VERSION } from '../data/news.js';

/** Le novita' di VinylDex, dalla piu' recente. */
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
    <section className="news-page">
      <h2 className="section-title text-gradient"><i className="ph-fill ph-megaphone" /> Novità</h2>
      <p className="page-subtitle">Tutto quello che è arrivato di recente in VinylDex.</p>
      {NEWS.map((release) => (
        <article key={release.date} className="news-release glass-panel">
          <header className="news-release-header">
            <i className={`ph-fill ${release.icon}`} />
            <div>
              <h3>{release.title}</h3>
              <time dateTime={release.date}>{new Date(release.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
            </div>
          </header>
          <ul className="news-items">
            {release.items.map(([icon, title, text]) => (
              <li key={title}>
                <i className={`ph-fill ${icon}`} />
                <div><strong>{title}</strong><span>{text}</span></div>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
