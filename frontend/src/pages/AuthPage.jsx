import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useSound } from '../hooks/useSound.js';

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

  return (
    <section className="auth-page">
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
