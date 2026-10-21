# ⚛️ VinylDex — Frontend

Single-page application in **React 19 + Vite**, servita come sito web, **PWA** installabile e base delle app
**iOS/Android** con Capacitor. Installazione completa (database e backend) nel [README principale](../README.md).

## 🚀 Comandi

| Comando | Cosa fa |
|---|---|
| `npm ci` | Installa le dipendenze esatte del lockfile |
| `npm run dev` | Server di sviluppo su http://localhost:5173, con `/api` e `/ws` inoltrati al backend su `:4000` |
| `npm run build` | Build di produzione in `dist/` |
| `npm run preview` | Anteprima locale della build |
| `npm run lint` | ESLint (regole React Hooks e React Refresh) |
| `npm test` | Test unitari e di componenti con Vitest |
| `npm run test:coverage` | Test con report di copertura in `coverage/` |
| `npm run test:e2e` | Test end-to-end con Playwright (backend e frontend avviati) |
| `npm run cap:sync` | Build e copia nei progetti nativi Capacitor |

## 🧩 Struttura di `src/`

```
src/
├── App.jsx            Rotte (lazy), cornice, avvisi globali
├── main.jsx           Avvio: provider, stili globali, PWA, accessibilità
├── pages/             Una pagina per rotta (Home, Pacchetti, Collezione, Battaglie, Hotel…)
├── components/        Componenti riusabili per area (card, pack, battle, home, phantom, three, fx…)
├── hotel/             Motore dell'hotel: canvas isometrico, sprite, WebSocket, minigiochi, casinò
├── context/           Auth, gioco (collezione, gold, missioni), suoni
├── hooks/             Hook condivisi (filtri delle carte, conti alla rovescia, accessibilità…)
├── services/          Client delle API, sessione, accessibilità, PWA, app nativa
├── utils/             Funzioni pure (rarità, sinergie, validazione…), coperte dai test
├── styles/            CSS globali, stile "Phantom", accessibilità
└── test/              Configurazione di Vitest
```

## 🎨 Stile

- **Phantom:** tagli netti, diagonali, retino e titoli a ritaglio ispirati a Persona 5, con i colori del brand
  (magenta, viola, oro). Le regole stanno sotto `:root[data-skin="phantom"]` (sito) e
  `:root[data-shell="phantom"]` (cornice e interfaccia dell'hotel).
- **Hotel:** la stanza è disegnata su `<canvas>` in pixel art isometrica (`src/hotel/HotelEngine.js`), mentre
  pannelli e barre sono React.
- **Animazioni:** Motion, con `MotionConfig reducedMotion`, più CSS. Tutto rispetta "riduci animazioni" e la
  modalità sicura.

## 🔐 Sessione

Sul sito il JWT sta in un cookie `HttpOnly` messo dal server: il frontend non lo legge mai. Ogni richiesta
porta l'intestazione `X-VinylDex-Client`. Nell'app nativa il token resta salvato sul dispositivo e viaggia come
Bearer (vedi `src/services/apiClient.js`).

## ⚙️ Variabili d'ambiente

Copia `.env.example` in `.env.local` (escluso da git):

| Variabile | Uso |
|---|---|
| `VITE_API_URL` | Facoltativa: indirizzo assoluto delle API (serve all'app nativa). Sul sito si usa `/api`. |
| `VITE_SPOTIFY_CLIENT_ID` | Facoltativa: jukebox Spotify nelle stanze dell'hotel |
