import { Link } from 'react-router-dom';
import PhantomTitle from '../components/phantom/PhantomTitle.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { LEGAL_PAGES, LEGAL_UPDATED } from '../data/legal.js';
import { CONTACT_EMAIL, LEGAL_LINKS } from '../data/links.js';
import '../styles/pages/social-phantom.css';
import '../styles/pages/accessibility.css';
import '../styles/pages/legal.css';

/** Testo con l'email di contatto resa cliccabile. */
function WithEmail({ text }) {
  const parts = text.split(CONTACT_EMAIL);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
    </span>
  ));
}

/**
 * Privacy, cookie e termini di servizio (testi in data/legal.js). Aperte anche senza account,
 * come l'accessibilita' (vedi PublicLayout in App.jsx).
 */
export default function LegalPage({ page }) {
  const { isAuthenticated } = useAuth();
  const doc = LEGAL_PAGES[page];

  return (
    <section className="a11y-page sp-page legal-page">
      <header className="sp-head">
        <PhantomTitle as="h2" text={doc.title} />
        <p className="sp-sub">{doc.intro}</p>
        <p className="legal-updated">Ultimo aggiornamento: {LEGAL_UPDATED}</p>
        <nav className="legal-tabs" aria-label="Pagine legali">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={`legal-tab${l.to === `/${page}` ? ' is-active' : ''}`}
              aria-current={l.to === `/${page}` ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        {!isAuthenticated && (
          <Link to="/login" className="btn btn-secondary a11y-back"><i className="ph ph-arrow-left" aria-hidden="true" /> Torna all&apos;accesso</Link>
        )}
      </header>

      {doc.sections.map((s) => (
        <div key={s.title} className="glass-panel a11y-panel legal-panel">
          <h3 className="panel-title"><i className={`ph-fill ${doc.icon}`} aria-hidden="true" /> {s.title}</h3>
          {s.text && <p><WithEmail text={s.text} /></p>}
          {s.items && (
            <ul className="a11y-list">
              {s.items.map((item) => <li key={item}><WithEmail text={item} /></li>)}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
