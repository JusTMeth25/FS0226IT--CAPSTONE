import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useSound } from '../hooks/useSound.js';
import { CARDS } from '../data/cards.js';
import CardTile from '../components/card/CardTile.jsx';
import ShinyText from '../components/fx/ShinyText.jsx';
import SplitText from '../components/fx/SplitText.jsx';
import { authApi, authErrorText } from '../services/authApi.js';
import { availableProviders, prepareSocial, socialSignIn } from '../services/socialLogin.js';

/** Cosa si vede prima ancora di avere un account. */
/** Schermata iniziale di ciascun indirizzo. */
const START_TABS = { '/register': 'register', '/forgot-password': 'forgot', '/reset-password': 'reset' };

const HIGHLIGHTS = [
  { icon: 'ph-cards', title: 'Oltre mille carte', text: 'Artisti originali più import da nove giochi di carte reali.' },
  { icon: 'ph-gift', title: 'Bustine ogni giorno', text: 'Una gratis a rotazione, con probabilità decise dal server.' },
  { icon: 'ph-arrows-left-right', title: 'Mercato e scambi', text: 'Compra, vendi e scambia con gli altri collezionisti.' }
];

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login, register, socialLogin, verifyTwoFactor } = useAuth();
  const { sound } = useSound();

  const [tab, setTab] = useState(START_TABS[location.pathname] || 'login');
  // Link dell'email: /#/reset-password?token=...
  const resetToken = new URLSearchParams(location.search).get('token') || '';
  const [newPassword, setNewPassword] = useState({ password: '', confirm: '' });
  const [resetDone, setResetDone] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Verifica in due passaggi: challenge del server mentre si aspetta il codice a 6 cifre.
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [socialConfig, setSocialConfig] = useState(null);
  // Cambiando indirizzo senza ricaricare (link dell'email in una scheda gia' aperta) cambia la schermata.
  const [shownPath, setShownPath] = useState(location.pathname);
  if (shownPath !== location.pathname) {
    setShownPath(location.pathname);
    setTab(START_TABS[location.pathname] || 'login');
    setMessage(null);
    setResetDone(false);
  }

  useEffect(() => {
    let cancelled = false;
    authApi.providers().then((cfg) => {
      if (cancelled) return;
      setSocialConfig(cfg || {});
      prepareSocial(cfg || {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const providers = availableProviders(socialConfig);

  useEffect(() => {
    // Dal link dell'email si cambia la password anche se su questo browser c'e' gia' qualcuno dentro.
    if (isAuthenticated && tab !== 'reset') {
      const dest = location.state?.from?.pathname || '/home';
      navigate(dest, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function updateField(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  /** Esito di un accesso: entrato, serve il codice, annullato oppure errore. */
  function outcome(res, fallback) {
    if (res.twoFactor) {
      setChallenge(res.twoFactor);
      setCode('');
      setMessage(null);
      return;
    }
    if (res.cancelled) return;
    if (!res.ok) {
      setMessage({ type: 'error', text: res.error || fallback });
      sound.error();
    } else {
      setMessage({ type: 'success', text: 'Login effettuato' });
      sound.success();
    }
  }

  async function handleSocial(provider) {
    setSubmitting(true);
    setMessage(null);
    const res = await socialLogin(provider, () => socialSignIn(provider, socialConfig));
    setSubmitting(false);
    outcome(res, provider === 'google' ? 'Accesso con Google non riuscito.' : 'Accesso con Apple non riuscito.');
  }

  async function handleTwoFactor(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await verifyTwoFactor(challenge, code.trim(), remember);
    setSubmitting(false);
    if (!res.ok && res.code === 'two_factor_expired') setChallenge(null);
    outcome(res, 'Codice non valido');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await login(form.email, form.password);
    setSubmitting(false);
    if (res.twoFactor) {
      outcome(res);
      return;
    }
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
    setChallenge(null);
    navigate(next === 'forgot' ? '/forgot-password' : `/${next}`, { replace: true });
  }

  async function handleForgot(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await authApi.forgotPassword(form.email.trim());
      setMessage({ type: 'success', text: 'Se l\'email è di un account VinylDex ti abbiamo scritto: apri il link entro 30 minuti. Controlla anche lo spam.' });
      sound.success();
    } catch (err) {
      setMessage({ type: 'error', text: authErrorText(err, 'Richiesta non riuscita: riprova.') });
      sound.error();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword.password !== newPassword.confirm) {
      setMessage({ type: 'error', text: 'Le due password non sono uguali.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await authApi.resetPassword(resetToken, newPassword.password);
      setResetDone(true);
      setMessage({ type: 'success', text: 'Password cambiata. Sei uscito da tutti i dispositivi: accedi con quella nuova.' });
      sound.success();
    } catch (err) {
      setMessage({ type: 'error', text: authErrorText(err, 'Cambio non riuscito: riprova.') });
      sound.error();
    } finally {
      setSubmitting(false);
    }
  }

  // Tre carte vere del catalogo locale, scelte per rarita' e non per identificativo:
  // restano valide anche se il catalogo cambia. Sono disponibili senza account,
  // quindi la vetrina funziona anche a utente non autenticato.
  const showcase = useMemo(() => {
    const pick = (rarity) => CARDS.find((c) => c.rarity === rarity);
    return [pick('epic'), pick('legendary'), pick('rare')].filter(Boolean);
  }, []);

  return (
    <main className="auth-screen">
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

        {challenge ? (
          <>
            <h3 className="auth-form-title"><i className="ph-fill ph-shield-check" /> Verifica in due passaggi</h3>
            <p className="auth-2fa-hint">Apri l&apos;app di autenticazione e scrivi il codice a 6 cifre di VinylDex. Hai perso il telefono? Usa uno dei codici di emergenza.</p>
            <form className="auth-form" onSubmit={handleTwoFactor}>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-2fa">Codice</label>
                <input className="ai-input auth-2fa-code" id="auth-2fa" name="code" value={code} onChange={(e) => setCode(e.target.value)}
                  inputMode="text" autoComplete="one-time-code" placeholder="123456" maxLength={20} autoFocus required />
              </div>
              <label className="auth-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Ricorda questo dispositivo: niente codice per 30 giorni da ogni accesso
              </label>
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || !code.trim()}>Verifica</button>
              {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
            </form>
            <p className="auth-switch"><button type="button" className="auth-switch-link" onClick={() => { setChallenge(null); setMessage(null); }}>Torna all&apos;accesso</button></p>
          </>
        ) : tab === 'forgot' ? (
          <>
            <h3 className="auth-form-title"><i className="ph-fill ph-key" /> Non ricordo la password</h3>
            <p className="auth-2fa-hint">Scrivi l&apos;email del tuo account: ti mandiamo un link per sceglierne una nuova.</p>
            <form className="auth-form" onSubmit={handleForgot}>
              <div className="auth-field">
                <label className="filter-label" htmlFor="auth-forgot-email">Email</label>
                <input className="ai-input" id="auth-forgot-email" name="email" type="email" value={form.email} onChange={updateField} autoFocus required />
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || !form.email.trim()}>Mandami il link</button>
              {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
            </form>
            <p className="auth-switch"><button type="button" className="auth-switch-link" onClick={() => switchTab('login')}>Torna all&apos;accesso</button></p>
          </>
        ) : tab === 'reset' ? (
          <>
            <h3 className="auth-form-title"><i className="ph-fill ph-key" /> Nuova password</h3>
            {!resetToken ? (
              <p className="auth-2fa-hint">Il link non è completo: aprilo di nuovo dall&apos;email o chiedine uno nuovo.</p>
            ) : !resetDone && (
              <form className="auth-form" onSubmit={handleReset}>
                <div className="auth-field">
                  <label className="filter-label" htmlFor="auth-new-pass">Nuova password</label>
                  <input className="ai-input" id="auth-new-pass" type="password" minLength={8} maxLength={100} autoComplete="new-password"
                    value={newPassword.password} onChange={(e) => setNewPassword((p) => ({ ...p, password: e.target.value }))} autoFocus required />
                </div>
                <div className="auth-field">
                  <label className="filter-label" htmlFor="auth-new-pass2">Ripeti la password</label>
                  <input className="ai-input" id="auth-new-pass2" type="password" minLength={8} maxLength={100} autoComplete="new-password"
                    value={newPassword.confirm} onChange={(e) => setNewPassword((p) => ({ ...p, confirm: e.target.value }))} required />
                </div>
                <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || newPassword.password.length < 8}>Cambia password</button>
              </form>
            )}
            {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
            <p className="auth-switch">
              {resetDone
                ? <button type="button" className="auth-switch-link" onClick={() => switchTab('login')}>Vai all&apos;accesso</button>
                : <button type="button" className="auth-switch-link" onClick={() => switchTab('forgot')}>Chiedi un nuovo link</button>}
            </p>
          </>
        ) : tab === 'login' ? (
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
            <p className="auth-switch"><button type="button" className="auth-switch-link" onClick={() => switchTab('forgot')}>Non ricordo la password</button></p>
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
        {!challenge && (tab === 'login' || tab === 'register') && providers.length > 0 && (
          <div className="auth-social">
            <div className="auth-social-divider"><span>oppure</span></div>
            {providers.includes('google') && (
              <button type="button" className="auth-social-btn google" onClick={() => handleSocial('google')} disabled={submitting}>
                <i className="ph-fill ph-google-logo" /> Continua con Google
              </button>
            )}
            {providers.includes('apple') && (
              <button type="button" className="auth-social-btn apple" onClick={() => handleSocial('apple')} disabled={submitting}>
                <i className="ph-fill ph-apple-logo" /> Continua con Apple
              </button>
            )}
          </div>
        )}
        </div>
      </section>
    </main>
  );
}
