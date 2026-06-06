# VinylDex — Project Context

> **Ultimo aggiornamento:** 06/06/2026
> **Versione:** MVP v0.1.0 (Feature 1 completata)

## Cos'è VinylDex

VinylDex è una web app (futura app mobile) ispirata ai giochi collezionabili come Pokémon TCG Pocket. Gli utenti collezionano carte di artisti musicali originali, aprono pacchetti, completano un catalogo (VinylDex) e combattono online.

## Vision

Unire la musica e il collezionismo in un'esperienza gamificata con identità visiva neon/anime, personaggi IP originali e meccaniche PvP.

## Stack Tecnologico

| Layer | Tecnologia | Note |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6 | MVP puro JS. Futuro: React + TypeScript |
| Backend | Node.js + Express | Da implementare dopo MVP |
| Database | PostgreSQL | Da implementare. MVP usa LocalStorage |
| ORM | Prisma | Futuro |
| Auth | JWT | Futuro |
| Deploy | Vercel (frontend) + Railway/Render (backend) | Futuro |
| AI | OpenAI API | Generazione artwork varianti carta |
| Storage MVP | LocalStorage | Con prefisso `vinylDex_` |

## Struttura Progetto (MVP)

```
/
├── index.html                    # Shell SPA unica
├── README.md
├── .cline/                       # Memoria persistente del progetto
│   ├── project-context.md
│   ├── architecture.md
│   ├── database.md
│   ├── game-design.md
│   ├── ui-guidelines.md
│   └── roadmap.md
├── assets/
│   ├── css/
│   │   └── style.css             # Design system completo
│   ├── img/
│   │   ├── cards/                # Placeholder SVG inline (autogenerati)
│   │   ├── packs/                # Immagini pacchetti (future)
│   │   └── ui/                   # Icone UI (future)
│   └── js/
│       ├── app.js                # Entry point + init
│       ├── data/
│       │   ├── artists.js        # Database 40 carte IP originali
│       │   └── packs.js          # 3 tipi pacchetto
│       ├── models/
│       │   ├── Card.js           # Modello carta
│       │   └── Pack.js           # Modello pacchetto
│       ├── services/
│       │   └── storage.js        # LocalStorage CRUD
│       ├── ui/
│       │   ├── home.js           # Home page
│       │   ├── pack-opening.js   # (Prossima feature)
│       │   ├── collection.js     # (Prossima feature)
│       │   └── vinyl-dex.js      # (Prossima feature)
│       └── utils/
│           ├── router.js         # Router SPA hash-based
│           └── random.js         # Weighted random + utilità
```

## Features Implementate

- [x] **Feature 1**: Setup progetto, routing SPA, design system, database carte, modelli, storage, home page, colezione base, VinylDex base

## Features Pianificate

- [ ] Feature 2: UI completa Home Page
- [ ] Feature 3: Apertura pacchetti con animazione
- [ ] Feature 4: Collezione con filtri e ordinamento
- [ ] Feature 5: VinylDex completo
- [ ] Feature 6: Debug mode e bilanciamento
- [ ] Feature 7: Sistema PvP
- [ ] Feature 8: Missioni e livelli
- [ ] Feature 9: Integrazione AI per varianti
- [ ] Feature 10: Backend + Auth + Persistenza remota

## Principi di Sviluppo

1. **Mobile-first**: tutto deve funzionare su schermi piccoli prima che su desktop
2. **Offline-first**: MVP deve funzionare completamente offline (senza backend)
3. **Scalabile**: architettura modulare per supportare fino a 100k utenti
4. **IP Originali**: tutti i personaggi, gruppi e contenuti sono proprietà intellettuale originale
5. **SOLID**: principi di programmazione solida dove applicabile
6. **Feature-driven**: ogni feature è sviluppata in isolation con test manuali