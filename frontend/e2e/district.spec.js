import { expect, test } from '@playwright/test';
import { loginAs, registerUser } from './helpers.js';

/**
 * Quartiere dell'hotel: negozi di lusso, veicoli, mercato dell'usato, classifiche del rock.
 * Le azioni sulla stanza (clic su facciate e banconi) passano dal motore del canvas, che il test
 * trova dalle proprieta' interne di React: cliccare i pixel giusti sul canvas isometrico
 * dipenderebbe dalla telecamera.
 */

const DISTRICT = 'Quartiere';

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

/** Motore della stanza (HotelEngine), cercato fra gli hook del componente del canvas. */
const ENGINE = `(() => {
  const c = document.querySelector('.hotel-canvas');
  if (!c) return null;
  const key = Object.keys(c).find((k) => k.startsWith('__reactFiber'));
  for (let f = c[key]; f; f = f.return) {
    for (let s = f.memoizedState; s; s = s.next) {
      const v = s.memoizedState;
      if (v && v.current && v.current.users instanceof Map) return v.current;
    }
  }
  return null;
})()`;

/** Hotel senza il tutorial della prima visita (segnato come visto dalle API). */
async function enterHotel(page, request, user) {
  expect((await request.post('/api/hotel/tutorial', { headers: auth(user) })).ok()).toBeTruthy();
  await loginAs(page, user, '/hotel');
}

async function joinRoom(page, name) {
  // "Stanze" apre e chiude il navigatore: si clicca finche' la lista non e' aperta.
  const list = page.locator('.hotel-room-list');
  await expect(page.locator('.hotel-canvas')).toBeVisible();
  await expect(async () => {
    if (!(await list.isVisible())) await page.getByRole('button', { name: 'Stanze' }).click();
    await expect(list).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await page.locator('.hotel-room', { has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) }).first().click();
  await expect(page.locator('.hotel-room-info strong')).toHaveText(name);
  // Il motore ha caricato i mobili della stanza.
  await page.waitForFunction(`(() => { const e = ${ENGINE}; return !!e && e.items.size > 0; })()`);
}

/** Clic su un mobile della stanza, come se lo si cliccasse sul canvas. */
async function clickFurni(page, type) {
  await page.waitForFunction(`(() => { const e = ${ENGINE}; return [...(e?.items.values() || [])].some((i) => i.type === ${JSON.stringify(type)}); })()`);
  await page.evaluate(`(() => {
    const e = ${ENGINE};
    const i = [...e.items.values()].find((x) => x.type === ${JSON.stringify(type)});
    e.onItemClick(i, { x: i.x, y: i.y, z: 0 });
  })()`);
}

test.describe('Quartiere e negozi di lusso', () => {
  test('dal quartiere si entra in atelier e si apre il negozio con l\'usato', async ({ page, request }) => {
    const user = await registerUser(request, 'pwlux');
    await enterHotel(page, request, user);
    await joinRoom(page, DISTRICT);
    await clickFurni(page, 'facade_atelier');
    await page.waitForFunction(`(() => { const e = ${ENGINE}; return [...(e?.items.values() || [])].some((i) => i.type === 'atelier_counter'); })()`);
    await clickFurni(page, 'atelier_counter');
    const shop = page.locator('.hotel-luxury');
    await expect(shop).toBeVisible();
    await expect(shop.locator('.lux-item').first()).toBeVisible();
    await shop.getByRole('tab', { name: /Usato/ }).click();
    await expect(shop.getByText(/Nessuno vende niente|Compra/).first()).toBeVisible();
  });

  test('skateboard: si compra, si sale con Guida e si scende', async ({ page, request }) => {
    const user = await registerUser(request, 'pwride');
    const buy = await request.post('/api/wardrobe/buy', { headers: auth(user), data: { item: 'r1' } });
    expect(buy.ok()).toBeTruthy();
    expect((await buy.json()).owned).toContain('r1');
    await enterHotel(page, request, user);
    await joinRoom(page, DISTRICT);
    const ride = page.locator('button', { hasText: /^(Guida|Scendi)$/ });
    await expect(ride).toHaveText('Guida');
    await ride.click();
    await expect(ride).toHaveText('Scendi');
    await ride.click();
    await expect(ride).toHaveText('Guida');
  });

  test('mercato dell\'usato: uno vende lo skate, l\'altro lo compra', async ({ request }) => {
    const seller = await registerUser(request, 'pwsell');
    const buyer = await registerUser(request, 'pwbuy');
    expect((await request.post('/api/wardrobe/buy', { headers: auth(seller), data: { item: 'r1' } })).ok()).toBeTruthy();
    const listed = await request.post('/api/wardrobe/market', { headers: auth(seller), data: { item: 'r1', price: 100 } });
    expect(listed.ok()).toBeTruthy();
    const mine = (await listed.json()).listings.find((l) => l.mine && l.item === 'r1');
    expect(mine).toBeTruthy();
    // Messo in vendita, non e' piu' nell'armadio di chi vende.
    const after = await (await request.get('/api/wardrobe', { headers: auth(seller) })).json();
    expect(after.owned).not.toContain('r1');

    const market = await (await request.get('/api/wardrobe/market?shop=skate', { headers: auth(buyer) })).json();
    expect(market.listings.some((l) => l.id === mine.id)).toBeTruthy();
    const bought = await request.post(`/api/wardrobe/market/${mine.id}/buy`, { headers: auth(buyer) });
    expect(bought.ok()).toBeTruthy();
    const wardrobe = await (await request.get('/api/wardrobe', { headers: auth(buyer) })).json();
    expect(wardrobe.owned).toContain('r1');
  });

  test('prezzo fuori dai limiti: l\'annuncio viene rifiutato', async ({ request }) => {
    const user = await registerUser(request, 'pwprice');
    expect((await request.post('/api/wardrobe/buy', { headers: auth(user), data: { item: 'r1' } })).ok()).toBeTruthy();
    const res = await request.post('/api/wardrobe/market', { headers: auth(user), data: { item: 'r1', price: 5 } });
    expect(res.ok()).toBeFalsy();
  });

  test('classifica della gara rock per canzone', async ({ request }) => {
    const user = await registerUser(request, 'pwrock');
    const res = await request.get('/api/hotel/rock-scores?song=vinile&difficulty=medium&instrument=drums', { headers: auth(user) });
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).top)).toBeTruthy();
  });
});
