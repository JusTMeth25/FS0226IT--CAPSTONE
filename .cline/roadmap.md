# VinylDex — Roadmap

> **Ultimo aggiornamento:** 06/06/2026
> **Versione corrente:** MVP v0.1.0 (Feature 1 completata)

---

## 📊 Stato Generale

| Fase | Stato | Versione |
|------|-------|----------|
| MVP (Client-side) | 🟢 In corso | v0.1.0 |
| Backend + Auth | 🔴 Non iniziato | - |
| Mobile App | 🔴 Non iniziato | - |
| AI Integration | 🔴 Non iniziato | - |

---

## 🗺️ Roadmap Feature-by-Feature

### ✅ Feature 1 — Fondamenta (COMPLETATA)
**Versione:** v0.1.0 → v0.1.x
- [x] Tutti i task completati (vedi history)

### ✅ Feature 2 — UI Home Page Animata (COMPLETATA)
**Versione:** v0.2.0
- [x] Particelle musicali fluttuanti (note ♪♫♩♬🎵🎶)
- [x] Effetti hover su statistiche con glow e text-shadow
- [x] Carousel ultime carte con scroll orizzontale touch
- [x] Transizione fade tra pagine (pageFadeIn keyframe)
- [x] Enhanced empty state con icona, titolo e CTA
- [x] Notifica pacchetto gratuito con timer countdown HH:MM:SS
- [x] Quick actions con barra neon animata
- [x] Welcome animation staggered per sezioni home
- [x] Mini-card con hover zoom e rarity borders

### ✅ Feature 3 — Apertura Pacchetti (COMPLETATA)
**Versione:** v0.3.0
- [x] Schermata selezione pacchetto (3 tipi con card gradiente)
- [x] Gold display in alto
- [x] Logica costo/consumo gold + free pack cooldown
- [x] Animazione 3D box con rotateY+scale
- [x] Rivelazione carte una alla volta (500ms) con flip animation
- [x] Effetto glow/bordo per ogni rarità sulle carte reveal
- [x] Sparkle effect per carte leggendarie
- [x] Overlay "gold insufficienti" con fade-in
- [x] Aggiunta automatica alla collezione con stats aggiornate
- [x] Summary actions: "Apri un Altro" e "Vai alla Collezione"

### ✅ Feature 4 — Collezione Utente Completa (COMPLETATA)
**Versione:** v0.4.0
- [x] Stats bar (carte uniche, totali, percentuale VinylDex)
- [x] Rarity counts cliccabili (filtra per rarità)
- [x] Filtri per classe artista (dropdown con tutte le classi)
- [x] Filtri per rarità
- [x] Ordinamento (data, nome, rarità, stats totali)
- [x] Direzione ordinamento (crescente/decrescente)
- [x] Badge quantità su carte duplicate (×N)
- [x] Dettaglio carta al click (modal fullscreen)
- [x] Stats barre animate (statBarGrow keyframe)
- [x] Data ottenimento formattata in italiano
- [x] Progresso classe artista completata
- [x] Chiusura modal con Escape click e click overlay
- [x] Filtro nessun risultato con pulsante reset

### 🔜 Feature 5 — VinylDex Completo
**Versione:** v0.5.0
**Priorità:** Alta
**Dipendenza:** Feature 1

- [ ] Griglia completa tutte le 40 carte
- [ ] Animazione scoperta carta (quando si ottiene per la prima volta)
- [ ] Filtri per classe e rarità
- [ ] Dettaglio carta anche per non scoperte (con suggerimento pacchetto)
- [ ] Ricompense progresso (25%, 50%, 75%, 100%)
- [ ] Effetto festa al 100% (confetti, glow)

### 🔜 Feature 6 — Debug Mode & Bilanciamento
**Versione:** v0.6.0
**Priorità:** Media
**Dipendenza:** Feature 1

- [ ] Tasto `D` per attivare debug mode
- [ ] Pannello debug UI
- [ ] Reset collezione/gold/XP/livello
- [ ] Aggiungi 9999 gold
- [ ] Pacchetti infiniti (senza consumare)
- [ ] Simulazione drop rate (1000 aperture con grafico)
- [ ] Test bilanciamento (carte ottenute per rarità)
- [ ] Esporta/Importa dati LocalStorage (JSON)

### 🔜 Feature 7 — Sistema PvP (Locale)
**Versione:** v0.7.0
**Priorità:** Media
**Dipendenza:** Feature 4

- [ ] Schermata selezione squadra (3 carte)
- [ ] Battle system base (3 round, confronto stats)
- [ ] Categorie round casuali (Fans, Style, Influence, Energy)
- [ ] Animazione confronto carte
- [ ] Gestione vittoria/sconfitta
- [ ] Calcolo punteggio per round
- [ ] Schermata risultato finale
- [ ] Modalità allenamento vs AI (semplice)

### 🔜 Feature 8 — Missioni e Livelli
**Versione:** v0.8.0
**Priorità:** Media
**Dipendenza:** Feature 4

- [ ] Sistema missioni: Daily, Weekly, Progress
- [ ] UI missioni (lista con progresso)
- [ ] Ricompense (gold, XP, pacchetti)
- [ ] Sistema livelli con formula XP
- [ ] Ricompense di livello
- [ ] Barra XP e notifica level up
- [ ] Login giornaliero (ricompensa)

### 🔜 Feature 9 — Integrazione AI
**Versione:** v0.9.0
**Priorità:** Bassa
**Dipendenza:** Feature 5

- [ ] Connessione OpenAI API
- [ ] Generazione artwork carte via prompt
- [ ] Generazione varianti (es. "Royal Echo" stili diversi)
- [ ] Prompt engineering per ogni classe
- [ ] Caching immagini generate
- [ ] Sostituzione placeholder SVG con immagini reali
- [ ] UI per rigenerare variante

### 🔜 Feature 10 — Backend + Auth + Cloud
**Versione:** v1.0.0
**Priorità:** Alta (per produzione)
**Dipendenza:** Tutte le feature precedenti

- [ ] Setup Node.js + Express project
- [ ] Setup Prisma + PostgreSQL
- [ ] Creazione tabelle DB (da database.md)
- [ ] Endpoint API REST
- [ ] Sistema auth JWT (register, login, profile)
- [ ] Migrazione dati da LocalStorage a DB
- [ ] Middleware logging, rate limiting, error handling
- [ ] Deploy backend su Railway/Render
- [ ] Deploy frontend su Vercel
- [ ] CI/CD pipeline

### 🔜 Feature 11 — React + TypeScript Refactor
**Versione:** v2.0.0
**Priorità:** Media
**Dipendenza:** Feature 10

- [ ] Setup React + TypeScript + Vite
- [ ] Componenti UI (Card, Pack, Button, ecc.)
- [ ] State management (Context/Redux/Zustand)
- [ ] React Router al posto di hash router
- [ ] CSS Modules / Tailwind / Styled Components
- [ ] Test unitari (Jest/Vitest)
- [ ] Test e2e (Playwright)

### 🔜 Feature 12 — App Mobile (PWA/React Native)
**Versione:** v3.0.0
**Priorità:** Bassa
**Dipendenza:** Feature 11

- [ ] PWA: manifest, service worker, offline mode
- [ ] Push notifications (pacchetto gratis disponibile)
- [ ] React Native (iOS + Android)
- [ ] Bridge con backend esistente
- [ ] App store deployment

---

## 📅 Timeline Stimata

| Feature | Versione | Stima | Stato |
|---------|----------|-------|-------|
| Feature 1 | v0.1.0 | 1 sett | ✅ Completata |
| Feature 2 | v0.2.0 | 3 giorni | ⏳ Next |
| Feature 3 | v0.3.0 | 5 giorni | 📋 Planned |
| Feature 4 | v0.4.0 | 4 giorni | 📋 Planned |
| Feature 5 | v0.5.0 | 3 giorni | 📋 Planned |
| Feature 6 | v0.6.0 | 2 giorni | 📋 Planned |
| Feature 7 | v0.7.0 | 1 sett | 📋 Planned |
| Feature 8 | v0.8.0 | 4 giorni | 📋 Planned |
| Feature 9 | v0.9.0 | 1 sett | 📋 Planned |
| Feature 10 | v1.0.0 | 2 sett | 📋 Planned |
| Feature 11 | v2.0.0 | 3 sett | 🔮 Future |
| Feature 12 | v3.0.0 | 1 mese | 🔮 Future |

---

## 🎯 Obiettivi Correnti

### Breve Termine (Prossima sessione)
- [ ] Feature 2: UI Home Page con animazioni ed effetti
- [ ] Feature 3: Apertura pacchetti con animazione flip
- [ ] Feature 4: Collezione con filtri e ordinamento

### Medio Termine (1-2 settimane)
- [ ] Feature 5: VinylDex completo
- [ ] Feature 6: Debug mode
- [ ] Feature 7: PvP locale vs AI

### Lungo Termine (3+ settimane)
- [ ] Feature 8: Missioni e livelli
- [ ] Feature 9: AI Integration
- [ ] Feature 10: Backend + deploy