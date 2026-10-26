import { apiClient, getDeviceToken, markSession, setDeviceToken, setToken } from './apiClient.js';

/** Messaggi per i codici d'errore dell'accesso. */
const AUTH_ERRORS = {
  invalid_credentials: 'Email o password non corrette.',
  user_banned: 'Questo account è stato sospeso.',
  invalid_two_factor_code: 'Codice non valido. Controlla l\'app o usa un codice di emergenza.',
  two_factor_locked: 'Troppi codici sbagliati: riprova fra qualche minuto.',
  two_factor_expired: 'Troppo tempo per il codice: rifai l\'accesso.',
  two_factor_not_started: 'Genera prima il QR code.',
  two_factor_already_enabled: 'La verifica in due passaggi è già attiva.',
  invalid_social_token: 'Accesso non riuscito: riprova.',
  social_email_missing: 'Serve un\'email verificata: concedila durante l\'accesso.',
  provider_disabled: 'Questo metodo di accesso non è attivo.',
  email_taken: 'Email già usata da un altro account.',
  username_taken: 'Username già in uso.',
  weak_password: 'La password deve avere almeno 8 caratteri.',
  reset_token_invalid: 'Il link non è più valido: è scaduto o è già stato usato. Chiedine uno nuovo.',
  too_many_requests: 'Troppe richieste: riprova fra un po\'.',
  too_many_attempts: 'Troppi tentativi: riprova fra qualche minuto.',
  invalid_email: 'Email non valida.',
  missing_fields: 'Compila tutti i campi.',
  invalid_input: 'Controlla i campi: qualcosa non va.',
  invalid_password: 'Password non corretta.',
  delete_username_mismatch: 'Lo username non corrisponde: scrivilo uguale, maiuscole comprese.',
  admin_cannot_delete: 'Un account admin non si elimina da qui.'
};

export function authErrorText(err, fallback = 'Qualcosa è andato storto.') {
  // Campi non validi: il server manda { error: 'invalid_input', fields: { email: 'invalid_email' } }.
  const field = Object.values(err?.payload?.fields || {}).find((code) => AUTH_ERRORS[code]);
  return AUTH_ERRORS[field] || AUTH_ERRORS[err?.code] || (err?.status === 0 ? err.message : null) || fallback;
}

/**
 * Dopo un accesso riuscito: sul sito il token e' gia' nel cookie HttpOnly (il server non lo
 * manda nel corpo), qui si segna solo che c'e' una sessione; l'app nativa salva il token.
 */
function keep(res) {
  if (res?.token) setToken(res.token);
  if (res?.user) markSession();
  if (res?.deviceToken) setDeviceToken(res.deviceToken);
  return res;
}

export const authApi = {
  async register(username, email, password) {
    return keep(await apiClient.post('/auth/register', { username, email, password }));
  },
  /** Con la verifica in due passaggi attiva su un dispositivo nuovo risponde { twoFactorRequired, challenge }. */
  async login(email, password) {
    return keep(await apiClient.post('/auth/login', { email, password, deviceToken: getDeviceToken() }));
  },
  async social(provider, idToken, name) {
    return keep(await apiClient.post('/auth/social', { provider, idToken, name, deviceToken: getDeviceToken() }));
  },
  async verifyTwoFactor(challenge, code, remember) {
    return keep(await apiClient.post('/auth/2fa/verify', { challenge, code, remember }));
  },
  /** "Non ricordo la password": il server risponde sempre ok, che l'email esista o no. */
  async forgotPassword(email) {
    return apiClient.post('/auth/forgot-password', { email });
  },
  async resetPassword(token, password) {
    return apiClient.post('/auth/reset-password', { token, password });
  },
  /** Google/Apple attivi sul server, con i client id pubblici. */
  async providers() {
    return apiClient.get('/auth/providers');
  },
  async profile() {
    return apiClient.get('/auth/profile');
  },
  async updateAvatar(avatar) {
    return apiClient.patch('/auth/avatar', { avatar });
  },
  /** Aspetto dell'avatar nell'hotel, dal guardaroba (es. "s1.h1.hc0.sh0.p0"). */
  async updateLook(look) {
    return apiClient.patch('/auth/look', { look });
  },
  twoFactor: {
    status: () => apiClient.get('/auth/2fa'),
    setup: () => apiClient.post('/auth/2fa/setup', {}),
    async enable(code) {
      return keep(await apiClient.post('/auth/2fa/enable', { code }));
    },
    disable: (code) => apiClient.post('/auth/2fa/disable', { code }),
    backupCodes: (code) => apiClient.post('/auth/2fa/backup-codes', { code }),
    forgetOtherDevices: () => apiClient.post('/auth/2fa/forget-devices', { deviceToken: getDeviceToken() })
  },
  /** Elimina l'account e tutti i dati; il server cancella anche il cookie di sessione. */
  async deleteAccount(username, password, code) {
    await apiClient.post('/auth/delete-account', { username, password: password || null, code: code || null });
    setToken(null);
  },
  /** Esce: il server cancella il cookie di sessione; anche se non risponde, qui si dimentica tutto. */
  async logout() {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // Offline o server giu': il cookie scade da solo, intanto l'app risulta uscita.
    }
    setToken(null);
  }
};
