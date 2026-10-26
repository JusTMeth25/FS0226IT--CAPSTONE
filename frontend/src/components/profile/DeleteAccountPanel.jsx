import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { authApi, authErrorText } from '../../services/authApi.js';

/**
 * "Elimina account" in fondo al profilo: cancella l'account e tutti i dati (vedi la pagina Privacy).
 * Si conferma scrivendo lo username, la password (vuota per chi entra solo con Google o Apple) e,
 * se e' attiva, il codice della verifica in due passaggi. Gli admin non lo vedono.
 */
export default function DeleteAccountPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', code: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || user.role === 'ADMIN') return null;
  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const ready = form.username.trim() === user.username && (!user.twoFactorEnabled || form.code.trim());

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authApi.deleteAccount(form.username.trim(), form.password, form.code.trim());
      logout();
      navigate('/login', { replace: true, state: { deleted: true } });
    } catch (err) {
      setError(authErrorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel twofa-panel delete-account-panel">
      <h3 className="panel-title"><i className="ph-fill ph-trash" aria-hidden="true" /> Elimina account</h3>
      <p className="twofa-hint">
        Cancella per sempre l&apos;account e tutti i dati: carte, gold, stanze, amici, messaggi, scambi e annunci in corso.
        Non si torna indietro. Dettagli nell&apos;<Link to="/privacy">informativa sulla privacy</Link>.
      </p>
      {!open ? (
        <button type="button" className="btn btn-secondary twofa-danger delete-account-start" onClick={() => setOpen(true)}>
          <i className="ph ph-trash" aria-hidden="true" /> Elimina il mio account
        </button>
      ) : (
        <form className="delete-account-form" onSubmit={submit}>
          <label className="filter-label" htmlFor="del-username">Per confermare scrivi il tuo username: <b>{user.username}</b></label>
          <input className="ai-input" id="del-username" name="username" value={form.username} onChange={update}
            autoComplete="off" autoCapitalize="none" spellCheck={false} required />
          <label className="filter-label" htmlFor="del-password">Password (lascia vuoto se entri solo con Google o Apple)</label>
          <input className="ai-input" id="del-password" name="password" type="password" value={form.password} onChange={update}
            autoComplete="current-password" />
          {user.twoFactorEnabled && (
            <>
              <label className="filter-label" htmlFor="del-code">Codice della verifica in due passaggi</label>
              <input className="ai-input" id="del-code" name="code" value={form.code} onChange={update}
                autoComplete="one-time-code" maxLength={20} placeholder="Codice dell'app o di emergenza" required />
            </>
          )}
          <div className="twofa-row">
            <button type="submit" className="btn btn-secondary twofa-danger" disabled={busy || !ready}>
              {busy ? 'Elimino…' : 'Elimina per sempre'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setOpen(false); setError(''); }} disabled={busy}>Annulla</button>
          </div>
          {error && <div className="auth-message auth-message-error" role="alert">{error}</div>}
        </form>
      )}
    </div>
  );
}
