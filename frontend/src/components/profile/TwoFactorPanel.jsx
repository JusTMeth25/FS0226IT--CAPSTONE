import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { authApi, authErrorText } from '../../services/authApi.js';

/**
 * Sezione "Sicurezza" del profilo: attiva o spegne la verifica in due passaggi con un'app di
 * autenticazione (Google Authenticator, Microsoft Authenticator, 1Password...).
 *
 * Il codice si chiede solo sui dispositivi nuovi: quelli gia' verificati restano fidati per un
 * mese da ogni accesso, quindi chi entra spesso dallo stesso telefono non lo vede quasi mai.
 */
export default function TwoFactorPanel({ onChange }) {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(null);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => authApi.twoFactor.status().then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!setup) return undefined;
    let cancelled = false;
    QRCode.toDataURL(setup.uri, { margin: 1, width: 200 }).then((url) => { if (!cancelled) setQr(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [setup]);

  async function run(task, success) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      if (success) setMessage({ type: 'success', text: success });
      await load();
      onChange?.();
    } catch (err) {
      setMessage({ type: 'error', text: authErrorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const start = () => run(async () => {
    setBackup(null);
    setCode('');
    setSetup(await authApi.twoFactor.setup());
  });

  const confirm = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await authApi.twoFactor.enable(code.trim());
      setSetup(null);
      setQr(null);
      setCode('');
      setBackup(res.backupCodes);
    }, 'Verifica in due passaggi attiva. Questo dispositivo è già fidato.');
  };

  const withCode = (e) => {
    e.preventDefault();
    const value = code.trim();
    run(async () => {
      if (action === 'disable') {
        await authApi.twoFactor.disable(value);
        setBackup(null);
      } else {
        setBackup((await authApi.twoFactor.backupCodes(value)).backupCodes);
      }
      setAction(null);
      setCode('');
    }, action === 'disable' ? 'Verifica in due passaggi spenta.' : 'Nuovi codici di emergenza pronti: i vecchi non valgono più.');
  };

  const forget = () => run(async () => {
    const res = await authApi.twoFactor.forgetOtherDevices();
    setMessage({ type: 'success', text: res.forgotten ? `Dimenticati ${res.forgotten} dispositivi: lì servirà di nuovo il codice.` : 'Nessun altro dispositivo da dimenticare.' });
  });

  const copy = () => {
    try {
      navigator.clipboard?.writeText(backup.join('\n'));
      setMessage({ type: 'success', text: 'Codici copiati.' });
    } catch {
      // Si possono sempre copiare a mano.
    }
  };

  if (!status) return null;
  const days = status.trustDays || 30;

  return (
    <div className="glass-panel twofa-panel">
      <h3 className="panel-title"><i className="ph-fill ph-shield-check" /> Sicurezza</h3>
      <p className="twofa-state">
        Verifica in due passaggi: <b className={status.enabled ? 'on' : 'off'}>{status.enabled ? 'attiva' : 'spenta'}</b>
      </p>
      <p className="twofa-hint">
        Dopo la password (o Google e Apple) serve anche il codice a 6 cifre di un&apos;app di autenticazione, ma solo su un
        dispositivo nuovo. Un dispositivo verificato resta fidato per {days} giorni, che ripartono a ogni accesso.
      </p>

      {!status.enabled && !setup && (
        <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
          <i className="ph ph-qr-code" /> Attiva la verifica in due passaggi
        </button>
      )}

      {setup && (
        <form className="twofa-setup" onSubmit={confirm}>
          <ol>
            <li>Apri l&apos;app di autenticazione e aggiungi un account inquadrando il QR code.</li>
            <li>Non puoi inquadrarlo? Scrivi questa chiave: <code className="twofa-secret">{setup.secret.match(/.{1,4}/g).join(' ')}</code></li>
            <li>Scrivi qui il codice a 6 cifre che compare nell&apos;app.</li>
          </ol>
          {qr && <img className="twofa-qr" src={qr} alt="QR code per l'app di autenticazione" width={200} height={200} />}
          <div className="twofa-row">
            <input className="ai-input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
              placeholder="123456" maxLength={7} aria-label="Codice a 6 cifre" required />
            <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length < 6}>Conferma</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setSetup(null); setQr(null); }} disabled={busy}>Annulla</button>
          </div>
        </form>
      )}

      {status.enabled && (
        <>
          <ul className="twofa-facts">
            <li><i className="ph ph-devices" /> Dispositivi fidati: <b>{status.trustedDevices}</b></li>
            <li><i className="ph ph-key" /> Codici di emergenza rimasti: <b>{status.backupCodesLeft}</b></li>
          </ul>
          {!action && (
            <div className="twofa-actions">
              <button type="button" className="btn btn-secondary" onClick={forget} disabled={busy}>Dimentica gli altri dispositivi</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setAction('backup'); setCode(''); }} disabled={busy}>Nuovi codici di emergenza</button>
              <button type="button" className="btn btn-secondary twofa-danger" onClick={() => { setAction('disable'); setCode(''); }} disabled={busy}>Disattiva</button>
            </div>
          )}
          {action && (
            <form className="twofa-row" onSubmit={withCode}>
              <input className="ai-input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code"
                placeholder="Codice dell'app o di emergenza" maxLength={20} aria-label="Codice" autoFocus required />
              <button type="submit" className={`btn ${action === 'disable' ? 'btn-secondary twofa-danger' : 'btn-primary'}`} disabled={busy || !code.trim()}>
                {action === 'disable' ? 'Disattiva' : 'Genera'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setAction(null)} disabled={busy}>Annulla</button>
            </form>
          )}
        </>
      )}

      {backup && (
        <div className="twofa-backup">
          <p><b>Codici di emergenza.</b> Conservali in un posto sicuro: ognuno vale una volta sola e serve se perdi il telefono. Non li vedrai più.</p>
          <ul>{backup.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
          <button type="button" className="btn btn-secondary" onClick={copy}><i className="ph ph-copy" /> Copia</button>
        </div>
      )}

      {message && <div className={`auth-message auth-message-${message.type}`}>{message.text}</div>}
    </div>
  );
}
