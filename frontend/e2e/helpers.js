import { expect } from '@playwright/test';

/** Utente nuovo registrato dalle API (passando dal proxy /api di Vite), con il suo token. */
export async function registerUser(request, prefix = 'pw') {
  const username = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post('/api/auth/register', {
    data: { username, email: `${username}@test.local`, password: 'Password123!' }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { username, token: body.token };
}

/**
 * Entra nell'app con il token gia' salvato (come dopo un login) e segna come visti i giri guidati,
 * che altrimenti coprirebbero la pagina alla prima visita.
 */
export async function loginAs(page, user, path = '/home') {
  await page.goto('/');
  await page.evaluate(({ token }) => {
    localStorage.setItem('vinyldex_token', token);
    ['packs', 'collection', 'battle', 'binder'].forEach((p) => localStorage.setItem(`vinyldex_tour_${p}`, '1'));
  }, user);
  // Cambiare solo l'hash non ricarica l'app: si ricarica per far leggere il token all'accesso.
  await page.goto(`/#${path}`);
  await page.reload();
}
