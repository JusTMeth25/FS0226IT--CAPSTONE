import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

/**
 * Accesso con Google tramite @capgo/capacitor-social-login: nel browser usa la libreria web di
 * Google, nell'app Android il selettore di account di sistema, nell'app iOS il foglio nativo. Il risultato e' sempre un ID token che il backend verifica.
 *
 * Il pulsante compare se il server ha il client id giusto per la piattaforma: web e Android col
 * client web, iOS solo col client iOS (serve anche l'URL scheme).
 */

let ready = null;
let readyFor = null;

export const platform = () => Capacitor.getPlatform();

export function availableProviders(config) {
  const p = platform();
  const out = [];
  const g = config?.google;
  if (g && (p === 'ios' ? g.iosClientId : g.webClientId)) out.push('google');
  return out;
}

function init(config) {
  const key = JSON.stringify(config);
  if (ready && readyFor === key) return ready;
  readyFor = key;
  const options = {};
  if (config.google) {
    options.google = platform() === 'ios'
      ? { iOSClientId: config.google.iosClientId, iOSServerClientId: config.google.webClientId || undefined }
      : { webClientId: config.google.webClientId };
  }
  ready = SocialLogin.initialize(options).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** Carica in anticipo le librerie (sul web Google va inizializzato prima del clic). */
export function prepareSocial(config) {
  if (availableProviders(config).length) init(config).catch(() => {});
}

/**
 * Apre l'accesso del fornitore. Restituisce { idToken, name } oppure null se l'utente ha chiuso
 * la finestra; lancia un errore se il fornitore non risponde.
 */
export async function socialSignIn(provider, config) {
  await init(config);
  try {
    const { result } = await SocialLogin.login({
      provider,
      options: { scopes: ['email', 'profile'] }
    });
    if (!result?.idToken) throw new Error('missing_id_token');
    const prof = result.profile || {};
    const name = prof.name || [prof.givenName, prof.familyName].filter(Boolean).join(' ') || null;
    return { idToken: result.idToken, name };
  } catch (err) {
    const text = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
    if (/cancel|closed|dismiss|popup_closed|1001/.test(text)) return null;
    throw err;
  }
}
