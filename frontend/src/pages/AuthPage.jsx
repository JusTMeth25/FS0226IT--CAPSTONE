import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useSound } from '../hooks/useSound.js';
import { CARDS } from '../data/cards.js';
import CardTile from '../components/card/CardTile.jsx';
import ShinyText from '../components/fx/ShinyText.jsx';
import SplitText from '../components/fx/SplitText.jsx';

/** Cosa si vede prima ancora di avere un account. */
const HIGHLIGHTS = [
  { icon: 'ph-cards', title: 'Oltre mille carte', text: 'Artisti originali più import da nove giochi di carte reali.' },
  { icon: 'ph-gift', title: 'Bustine ogni giorno', text: 'Una gratis a rotazione, con probabilità decise dal server.' },
  { icon: 'ph-arrows-left-right', title: 'Mercato e scambi', text: 'Compra, vendi e scambia con gli altri collezionisti.' }
];

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login, register } = useAuth();
  const { sound } = useSound();

  const [tab, setTab] = useState(location.pathname === '/register' ? 'register' : 'login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const dest = location.state?.from?.pathname || '/home';
      navigate(dest, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function updateField(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await login(form.email, form.password);
    setSubmitting(false);
    if (!res.ok) {
      setMessage({ type: 'error', text: res.error || 'Credenziali non valide' });
      sound.error();
    } else {
      setMessage({ type: 'success', text: 'Login effettuato' });
      sound.success();
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await register(form.username, form.email, form.password);
    setSubmitting(false);
    if (!res.ok) {
      setMessage({ type: 'error', text: res.error || 'Compila tutti i campi' });
      sound.error();
    } else {
      setMessage({ type: 'success', text: 'Registrazione effettuata. Benvenuto!' });
      sound.success();
    }
  }

  function switchTab(next) {
    setTab(next);
    setMessage(null);
  }

  // Tre carte vere del catalogo locale, scelte per rarita' e non per identificativo:
  // restano valide anche se il catalogo cambia. Sono disponibili senza account,
  // quindi la vetrina funziona anche a utente non autenticato.
  const showcase = useMemo(() => {
    const pick = (rarity) => CARDS.find((c) => c.rarity === rarity);
    return [pick('epic'), pick('legendary'), pick('rare')].filter(Boolean);
  }, []);

  return (
    <section className="auth-page auth-landing">
      <div className="auth-hero">
        <p className="auth-hero-eyebrow"><i className="ph-fill ph-vinyl-record" /> Colleziona. Scambia. Domina la classifica.</p>

        <h1 className="auth-hero-title">
          <ShinyText speed={6}>VinylDex</ShinyText>
        </h1>

        <p className="auth-hero-tagline">
          <SplitText text="Il tuo album di carte musicali" delay={18} />
        </p>

        <ul className="auth-hero-list">
          {HIGHLIGHTS.map((item) => (
            <li className="auth-hero-item" key={item.title}>
              <span className="auth-hero-icon"><i className={`ph-fill ${item.icon}`} /></span>
              <span>
                <strong>{item.title}</strong>
                <span className="auth-hero-item-text">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>

        {showcase.length > 0 && (
          <div className="auth-hero-cards" aria-hidden="true">
            {showcase.map((card, i) => (
              <div className={`auth-hero-card auth-hero-card-${i + 1}`} key={card.id}>
                <CardTile card={card} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel auth-card">
        <div className="auth-tabs">
          <button className={`btn btn-secondary ${tab === 'login' ? 'btn-tab-active' : ''}`} onClick={() => switchTab('login')}>
            <i className="ph-fill ph-lock" /> Login
          </button>
          <button className={`btn btn-secondary ${tab === 'register' ? 'btn-tab-active' : ''}`} onClick={() => switchTab('register')}>
            <i className="ph-fill ph-sparkle" /> Registrati
          </button>
        </div>

        {tab === 'login' ? (
          <>
            <h3 className="auth-form-title"><i className="ph-fill ph-lock" /> Accedi</h3>
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-email">Email</label>
                <input className="ai-input" id="auth-email" name="email" type="email" value={form.email} onChange={updateField} required />
              </div>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-pass">Password</label>
                <input className="ai-input" id="auth-pass" name="password" type="password" value={form.password} onChange={updateField} required />
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>Accedi</button>
              {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
            </form>
            <p className="auth-switch">Non hai un account? <button type="button" className="auth-switch-link" onClick={() => switchTab('register')}>Registrati</button></p>
          </>
        ) : (
          <>
            <h3 className="auth-form-title"><i className="ph-fill ph-sparkle" /> Crea un Account</h3>
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-username">Username</label>
                <input className="ai-input" id="auth-username" name="username" value={form.username} onChange={updateField} required />
              </div>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-reg-email">Email</label>
                <input className="ai-input" id="auth-reg-email" name="email" type="email" value={form.email} onChange={updateField} required />
              </div>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-reg-pass">Password</label>
                <input className="ai-input" id="auth-reg-pass" name="password" type="password" value={form.password} onChange={updateField} required />
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>Crea Account</button>
              {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
            </form>
            <p className="auth-switch">Hai già un account? <button type="button" className="auth-switch-link" onClick={() => switchTab('login')}>Accedi</button></p>
          </>
        )}
      </div>
    </section>
  );
}
