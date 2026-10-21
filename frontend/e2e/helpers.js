import { expect } from '@playwright/test';

/** Cookie HttpOnly della sessione del sito (AuthCookies.NAME nel backend). */
const SESSION_COOKIE = 'vinyldex_session';

/**
 * Utente nuovo registrato dalle API (passando dal proxy /api di Vite), con il suo token.
 * Sul sito il token sta solo nel cookie HttpOnly e il corpo della risposta non lo contiene:
 * la richiesta si presenta come l'app nativa (X-VinylDex-Client: native) per riceverlo, cosi'
 * i test lo possono usare come Bearer nelle chiamate alle API e come cookie nel browser.
 */
export async function registerUser(request, prefix = 'pw') {
  const username = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post('/api/auth/register', {
    headers: { 'X-VinylDex-Client': 'native' },
    data: { username, email: `${username}@test.local`, password: 'Password123!' }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.token).toBeTruthy();
  return { username, token: body.token };
}

/**
 * Prima di ogni caricamento della pagina segna come gia' vista l'avvertenza sulla fotosensibilita'
 * del primo avvio (services/accessibility.js), che altrimenti coprirebbe tutto. Se un test ha gia'
 * salvato altre scelte di accessibilita' le lascia com'erano.
 */
export async function skipFirstRunNotices(page) {
  await page.addInitScript(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vinyldex_a11y') || '{}');
      if (saved.warned !== true) localStorage.setItem('vinyldex_a11y', JSON.stringify({ ...saved, warned: true }));
    } catch {
      localStorage.setItem('vinyldex_a11y', '{"warned":true}');
    }
  });
}

/**
 * Apre la sessione nel browser come dopo un login: il cookie HttpOnly col token (JavaScript non
 * lo puo' scrivere, lo mette Playwright) e in localStorage solo il segnale vinyldex_session = '1'.
 * Il vecchio vinyldex_token in localStorage sul sito non esiste piu' (apiClient lo cancella).
 */
export async function authenticate(page, user) {
  await skipFirstRunNotices(page);
  await page.goto('/');
  const origin = new URL(page.url()).origin;
  await page.context().addCookies([{
    name: SESSION_COOKIE,
    value: user.token,
    url: origin,
    httpOnly: true,
    sameSite: 'Strict'
  }]);
  await page.evaluate(() => localStorage.setItem('vinyldex_session', '1'));
}

/**
 * Entra nell'app con la sessione gia' aperta (come dopo un login) e segna come visti i giri
 * guidati, che altrimenti coprirebbero la pagina alla prima visita.
 */
export async function loginAs(page, user, path = '/home') {
  await authenticate(page, user);
  await page.evaluate(() => {
    ['packs', 'collection', 'battle', 'binder'].forEach((p) => localStorage.setItem(`vinyldex_tour_${p}`, '1'));
  });
  // Cambiare solo l'hash non ricarica l'app: si ricarica per far chiedere il profilo all'avvio.
  await page.goto(`/#${path}`);
  await page.reload();
}
