/**
 * Link esterni del sito, in un posto solo.
 *
 * DONATE_URL: donazioni volontarie con PayPal.Me per sostenere i costi del server. E' un semplice
 * link (si apre PayPal in una scheda nuova): il sito non carica script di PayPal e non vede mai i
 * dati di pagamento. Con null il bottone nel pie' di pagina non compare.
 */
export const DONATE_URL = 'https://paypal.me/lorenzomelis25';

/** Contatto del titolare per privacy, segnalazioni e richieste sui dati (pagine legali). */
export const CONTACT_EMAIL = 'lorenzo.melis@yahoo.it';

/** Pagine legali, nel pie' di pagina e sotto il modulo di accesso. */
export const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/cookie', label: 'Cookie' },
  { to: '/termini', label: 'Termini' }
];
