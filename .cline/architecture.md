# VinylDex — Architecture

> **Ultimo aggiornamento:** 06/06/2026
> **Stato corrente:** MVP Frontend-only (SPA vanilla JS)

## Architettura Generale (Target)

```
┌─────────────────────────────────────────────┐
│                CLIENT (Browser)              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  HTML5   │ │  CSS3    │ │ JavaScript   │  │
│  │  Shell   │ │  Design  │ │ ES6 Modules  │  │
│  │  SPA     │ │  System  │ │ (MVC-like)   │  │
│  └──────────┘ └──────────┘ └──────┬───────┘  │
│                                    │          │
│  ┌─────────────────────────────────┴───────┐  │
│  │          LocalStorage (MVP)             │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────┘
                       │
                       │ API REST (Futuro)
                       ▼
┌─────────────────────────────────────────────┐
│              BACKEND (Node.js)              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Express  │ │  JWT     │ │  Services   │  │
│  │  Router  │ │  Auth    │ │  Layer      │  │
│  └──────────┘ └──────────┘ └──────┬───────┘  │
│                                    │          │
│  ┌─────────────────────────────────┴───────┐  │
│  │           Prisma ORM                    │  │
│  └─────────────────────────────────┬───────┘  │
│                                    │          │
│  ┌─────────────────────────────────┴───────┐  │
│  │         PostgreSQL Database             │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Architettura MVP (Attuale)

### Pattern — SPA Vanilla JavaScript (MVC-like)

```
app.js (Controller / Entry Point)
  │
  ├── Router (hashchange events)
  │     └── Mappa hash → UI render function
  │
  ├── Models (Card.js, Pack.js)
  │     └── Dati + logica di dominio
  │
  ├── Services (storage.js)
  │     └── Persistenza (LocalStorage)
  │
  ├── UI (home.js, ecc.)
  │     └── Render HTML, event handlers, animazioni
  │
  └── Utils (router.js, random.js)
        └── Utility trasversali
```

### Flusso Richiesta-Risposta (MVP)

```
1. User click sul nav link
2. window.location.hash cambia
3. Router intercetta hashchange
4. Router chiama renderFn associata
5. renderFn:
   a. Legge dati da StorageService
   b. Legge dati da Artists/Packs database
   c. Costruisce HTML string
   d. container.innerHTML = html
6. Browser renderizza
```

### Separazione delle Responsabilità

| Layer | Cosa fa | Dipende da |
|---|---|---|
| `app.js` | Entry point, init router, orchestrazione | Tutti |
| `utils/router.js` | Hash routing, navigazione | Nessuno |
| `utils/random.js` | Weighted random, shuffle | Nessuno |
| `models/Card.js` | Dati carta, metodi rarità/stelle/stats | Nessuno |
| `models/Pack.js` | Logica apertura pacchetto, weighted random | Random, Card |
| `services/storage.js` | CRUD LocalStorage | Nessuno |
| `data/artists.js` | Database statico 40 carte | Nessuno |
| `data/packs.js` | Config 3 pacchetti | Nessuno |
| `ui/home.js` | Render home page | Storage, Card, Artists |

### Dipendenze tra file (ordine caricamento in index.html)

```
1. models/Card.js       (nessuna dipendenza)
2. models/Pack.js       (dipende da Card.js, Random.js)
3. data/artists.js      (nessuna dipendenza)
4. data/packs.js        (nessuna dipendenza)
5. services/storage.js  (nessuna dipendenza)
6. utils/random.js      (nessuna dipendenza)
7. utils/router.js      (nessuna dipendenza)
8. ui/home.js           (dipende da Card, Storage, Artists)
9. app.js               (dipende da TUTTI)
```

## Architettura Futura (con Backend)

### API REST Endpoints (Pianificati)

```
POST   /api/auth/register       # Registrazione
POST   /api/auth/login          # Login (JWT)
GET    /api/auth/profile        # Profilo utente

GET    /api/cards               # Lista tutte le carte
GET    /api/cards/:id           # Dettaglio carta

GET    /api/packs               # Lista pacchetti disponibili
POST   /api/packs/:id/open      # Apri pacchetto (consuma gold/timer)

GET    /api/collection          # Collezione utente
POST   /api/collection          # Salva collezione

GET    /api/vinyl-dex           # Catalogo utente

POST   /api/battle/queue        # Entra in coda matchmaking
GET    /api/battle/:id          # Stato battaglia
POST   /api/battle/:id/round    # Gioca round
GET    /api/battle/:id/result   # Risultato finale

GET    /api/missions            # Missioni attive
POST   /api/missions/:id/claim  # Ritira ricompensa

GET    /api/shop                # Negozio
POST   /api/shop/buy            # Acquista
```

### Strategia di Migrazione (MVP → Full)

1. **Fase 1**: MVP completamente client-side (✅ fatto)
2. **Fase 2**: Aggiungere backend Node.js + Express + PostgreSQL
3. **Fase 3**: Sostituire LocalStorage con API calls (con fallback offline)
4. **Fase 4**: React + TypeScript frontend
5. **Fase 5**: App mobile (React Native / PWA)