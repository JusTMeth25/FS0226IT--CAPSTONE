import { defineConfig } from '@playwright/test';

/**
 * Test end-to-end nel browser vero.
 *
 * Servono il backend Spring (con il suo database) e il frontend in esecuzione:
 *   cd BE && ./mvnw spring-boot:run
 *   cd frontend && npm run test:e2e   (oppure npm run e2e)
 * `npm run e2e` avvia da solo il server di sviluppo di Vite se non e' gia' acceso.
 * Per provare un altro indirizzo: E2E_BASE_URL=http://localhost:5199 npm run e2e
 * Si usa il Chrome installato (channel "chrome"): niente browser da scaricare.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    channel: process.env.E2E_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000
  }
});
