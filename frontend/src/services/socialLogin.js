import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

/**
 * Accesso con Google e Apple tramite @capgo/capacitor-social-login: nel browser usa le librerie
 * web di Google e Apple, nell'app Android il selettore di account di sistema, nell'app iOS i
 * fogli nativi. Il risultato e' sempre un ID token che il backend verifica.
 *
 * Quali pulsanti mostrare dipende da cosa e' configurato sul server e dalla piattaforma:
 * - Google: web e Android col client web, iOS solo col client iOS (serve anche l'URL scheme);
 * - Apple: web col Services ID, iOS se attivo; su Android no (richiederebbe un redirect dal server).
 */

let ready = null;
let readyFor = null;

export const platform = () => Capacitor.getPlatform();

export function availableProviders(config) {
  const p = platform();
  const out = [];
  const g = config?.google;
  if (g && (p === 'ios' ? g.iosClientId : g.webClientId)) out.push('google');
  const a = config?.apple;
  if (a && ((p === 'web' && a.serviceId) || (p === 'ios' && a.ios))) out.push('apple');
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
  if (config.apple) {
    options.apple = platform() === 'ios'
      ? { clientId: 'com.vinyldex.app', redirectUrl: '' }
      : { clientId: config.apple.serviceId, redirectUrl: config.apple.redirectUrl || window.location.origin };
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
      options: { scopes: provider === 'apple' ? ['email', 'name'] : ['email', 'profile'] }
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
