# VinylDex

Piattaforma di collezione carte digitali (musicisti IP originali) — React/Vite + Spring Boot + PostgreSQL + Capacitor (iOS/Android). Valuta di gioco **gold** interna, nessun denaro reale, nessun cash-out, nessuna spedizione fisica.

## Struttura del repo

```
/
├── frontend/     # React + Vite (web + base per Capacitor iOS/Android)
├── BE/           # Spring Boot + JPA/Hibernate (API REST)
└── assets/       # sorgente vanilla JS originale (pre-migrazione, mantenuto a scopo storico)
```

> Il backend Node/Express/Prisma che stava in `backend/` e' stato sostituito dal backend Spring
> in `BE/`. La superficie HTTP e' identica, quindi il frontend non ha richiesto modifiche.
> Il codice vecchio resta nella storia di git fino al commit che lo rimuove.

## Requisiti

- JDK 25 (backend)
- Node.js >= 18 (frontend)
- PostgreSQL 16+ in locale
- Per il build mobile: Android Studio (Android) e/o Xcode su macOS (iOS)

## Setup backend

```bash
cd BE
createdb -U postgres -E UTF8 "FS0226IT-CAPSTONE"   # oppure da pgAdmin
cp .env.example .env                                 # poi compila DB_PASSWORD e JWT_SECRET
./mvnw spring-boot:run                               # http://localhost:4000
```

Lo schema del database lo crea Flyway al primo avvio. `.env` viene letto automaticamente,
non serve esportare le variabili a mano.

Variabili principali (`BE/.env`, elenco completo in `.env.example`):

| Variabile | Descrizione |
|---|---|
| `DB_URL` · `DB_USERNAME` · `DB_PASSWORD` | Connessione al Postgres locale |
| `JWT_SECRET` | Segreto per firmare i token, almeno 32 byte |
| `PORT` | Porta HTTP del backend (default 4000) |
| `CORS_ORIGINS` | Origini ammesse dal browser |
| `POKEMONTCG_API_KEY` · `APITCG_API_KEY` | Opzionali, per l'import carte esterne |

Dettagli su architettura, endpoint e importer: [`BE/README.md`](BE/README.md).

## Setup frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173 (proxy /api -> http://localhost:4000)
npm run build      # build di produzione in frontend/dist
```

Il frontend funziona anche senza account (modalità ospite, dati salvati solo in localStorage) — login/registrazione sbloccano la persistenza reale su database, il mercato, gli scambi e le missioni server-side.

## Packaging mobile (Capacitor)

Da eseguire dentro `frontend/`:

```bash
npm install
npm run build              # genera frontend/dist, richiesto prima di add/sync
npx cap add ios            # crea il progetto iOS (richiede macOS per essere aperto/compilato)
npx cap add android        # crea il progetto Android
npx cap sync                # ricopia dist/ + plugin nei progetti nativi (da rilanciare ad ogni build)
npx cap open ios            # apre il progetto in Xcode (solo macOS)
npx cap open android        # apre il progetto in Android Studio
```

Scorciatoie equivalenti disponibili come script npm: `npm run cap:add:ios`, `cap:add:android`, `cap:sync` (esegue anche la build), `cap:open:ios`, `cap:open:android`.

Note:
- `appId`: `com.vinyldex.app`, `appName`: `VinylDex` (`frontend/capacitor.config.json`).
- Le cartelle `frontend/ios/` e `frontend/android/` sono generate da `cap add` e **non sono versionate** (`.gitignore`): rieseguire `cap add` su ogni nuova macchina. Se prevedi personalizzazioni native dirette (icone firmate, permessi, plugin nativi custom), valuta di rimuoverle dal `.gitignore` e versionarle.
- Icone/splash screen attuali sono **placeholder** generati dal logo `frontend/public/favicon.png`. Per rigenerarli con artwork definitivo: sostituisci `frontend/resources/icon.png` (min. 1024×1024) e `frontend/resources/splash.png` (min. 2732×2732), poi `npx @capacitor/assets generate --android --ios`.
- Layout mobile-first, safe-area iOS gestita via CSS (`env(safe-area-inset-*)` in `frontend/src/styles/global.css`) e `StatusBar`/`SplashScreen` nativi inizializzati in `frontend/src/services/nativeInit.js`.
- L'app usa `HashRouter` lato frontend proprio per essere compatibile con il caricamento da file statici di Capacitor (nessuna configurazione server-side aggiuntiva necessaria).

## Flusso applicativo verificato

Registrazione/Login → Home → Apertura pacchetto (server-authoritative: gold, drop-rate e carte vinte sono sempre decisi dal backend) → Reveal animato → Collezione → Mercato (compra/vendi solo gold) → Scambi → Pannello Admin (gestione utenti/carte/pacchetti/missioni/eventi, log, import carte esterne con fallback demo se le API di terze parti non rispondono).

## Stack

| Layer | Tecnologia |
|---|---|
| Frontend | React 19 + Vite, React Router (Hash), Context API |
| Backend | Spring Boot 4 (Java 25), Spring Security + JWT, BCrypt |
| Database | PostgreSQL + JPA/Hibernate, migrazioni Flyway |
| Mobile | Capacitor (iOS/Android) |
| Import carte esterne | 9 fonti (Pokémon TCG, Scryfall, YGOPRODeck, One Piece, Digimon, Lorcana, Riftbound, Gundam, Dragon Ball) — con fallback demo |
