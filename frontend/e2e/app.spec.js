import { test, expect } from '@playwright/test';
import { loginAs, registerUser } from './helpers.js';

test.describe('VinylDex', () => {
  test('registrazione dalla pagina di accesso e arrivo in home', async ({ page }) => {
    const username = `pw_${Math.random().toString(36).slice(2, 8)}`;
    await page.goto('/#/register');
    await page.locator('#auth-username').fill(username);
    await page.locator('#auth-reg-email').fill(`${username}@test.local`);
    await page.locator('#auth-reg-pass').fill('Password123!');
    await page.getByRole('button', { name: 'Crea Account' }).click();
    await expect(page.locator('.home-hero-title')).toContainText(username);
  });

  test('home: benvenuto, numeri e scorciatoie', async ({ page, request }) => {
    const user = await registerUser(request);
    await loginAs(page, user, '/home');
    await expect(page.locator('.home-hero-stats li')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /apri un pacchetto/i })).toBeVisible();
  });

  test('pacchetto gratis: si apre e le carte finiscono in collezione', async ({ page, request }) => {
    const user = await registerUser(request);
    await loginAs(page, user, '/packs');
    await expect(page.locator('.pity-bar')).toBeVisible();
    await page.getByRole('button', { name: /apri gratis/i }).click();
    // Dopo l'animazione si arriva al riepilogo: si salta direttamente alla collezione.
    await expect.poll(async () => {
      const res = await request.get('/api/collection?owned=true', { headers: { Authorization: `Bearer ${user.token}` } });
      return (await res.json()).collection.length;
    }, { timeout: 20_000 }).toBeGreaterThan(0);
    await page.goto('/#/collection');
    await expect(page.locator('.collection-grid > *').first()).toBeVisible();
  });

  test('lista dei desideri: dal dettaglio di una carta alla pagina Desideri', async ({ page, request }) => {
    const user = await registerUser(request);
    // La carta del giorno esiste sempre: e' un codice valido senza dover conoscere il catalogo.
    const daily = await (await request.get('/api/cards/daily')).json();
    const code = daily.card.id;
    await loginAs(page, user, `/card/${encodeURIComponent(code)}`);
    await page.getByRole('button', { name: /aggiungi ai desideri/i }).click();
    await expect(page.getByRole('button', { name: /nei desideri/i })).toBeVisible();
    await page.goto('/#/wishlist');
    await expect(page.locator('.wish-item')).toHaveCount(1);
  });

  test('statistiche e classifica per gioco', async ({ page, request }) => {
    const user = await registerUser(request);
    await loginAs(page, user, '/stats');
    await expect(page.locator('.stats-numbers li')).toHaveCount(6);
    await page.goto('/#/leaderboard');
    await page.getByRole('button', { name: /per gioco/i }).click();
    await expect(page.locator('.game-leaderboard-prize')).toContainText('gold');
  });

  test('giro guidato alla prima visita dei pacchetti', async ({ page, request }) => {
    const user = await registerUser(request);
    await page.goto('/');
    await page.evaluate(({ token }) => localStorage.setItem('vinyldex_token', token), user);
    await page.goto('/#/packs');
    await page.reload();
    await expect(page.locator('.page-tour-tip')).toContainText('I tuoi gold');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await page.getByRole('button', { name: 'Avanti' }).click();
    await page.getByRole('button', { name: 'Fine' }).click();
    await expect(page.locator('.page-tour')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.pity-bar')).toBeVisible();
    await expect(page.locator('.page-tour')).toHaveCount(0);
  });

  test('PWA: manifest e service worker disponibili', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('VinylDex');
    expect(manifest.icons.length).toBeGreaterThan(1);
    expect((await request.get('/sw.js')).ok()).toBeTruthy();
  });
});
