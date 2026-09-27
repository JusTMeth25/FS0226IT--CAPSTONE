/**
 * PWA: registra il service worker (solo nella build di produzione, fuori da Capacitor) e mostra
 * la notifica "pacchetto gratis pronto" quando scade l'attesa del pacchetto base.
 *
 * Le notifiche sono locali: le programma la pagina mentre l'app e' aperta (anche in un'altra
 * scheda o installata sul telefono). Non c'e' un server di notifiche push.
 */
const NOTIFY_KEY = 'vinyldex_notify_free_pack';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Nell'app nativa (Capacitor) i file sono gia' locali: niente service worker.
  if (window.Capacitor?.isNativePlatform?.()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function freePackNotificationsOn() {
  try {
    return notificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(NOTIFY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Chiede il permesso e ricorda la scelta. Restituisce true se le notifiche sono attive. */
export async function enableFreePackNotifications() {
  if (!notificationsSupported()) return false;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  const on = permission === 'granted';
  try {
    localStorage.setItem(NOTIFY_KEY, on ? '1' : '0');
  } catch {
    // senza localStorage la scelta vale solo per questa visita
  }
  return on;
}

export function disableFreePackNotifications() {
  try {
    localStorage.setItem(NOTIFY_KEY, '0');
  } catch {
    // niente da ricordare
  }
}

/** Mostra la notifica, dal service worker se c'e' (cosi' il clic apre l'app) o dalla pagina. */
export async function showFreePackNotification() {
  if (!freePackNotificationsOn()) return;
  const options = {
    body: 'Il pacchetto gratuito ti aspetta: aprilo adesso!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'free-pack',
    data: { url: './#/packs' }
  };
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (registration) registration.showNotification('VinylDex: pacchetto gratis pronto', options);
  else new Notification('VinylDex: pacchetto gratis pronto', options);
}

// ------------------------------------------------------------------ installazione

let deferredPrompt = null;
if (typeof window !== 'undefined') {
  // Chrome ed Edge avvisano quando l'app si puo' installare: l'avviso si tiene per il bottone.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new Event('vinyldex-install-ready'));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event('vinyldex-install-ready'));
  });
}

/** L'app e' gia' aperta come app installata (schermo intero, senza barra del browser)? */
export function isInstalled() {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
}

export function canPromptInstall() {
  return deferredPrompt != null;
}

/** Mostra la finestra di installazione del browser. Restituisce true se l'utente accetta. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  const choice = await prompt.userChoice;
  window.dispatchEvent(new Event('vinyldex-install-ready'));
  return choice?.outcome === 'accepted';
}
