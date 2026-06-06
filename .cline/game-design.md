# VinylDex — Game Design Document (GDD)

> **Ultimo aggiornamento:** 06/06/2026
> **Versione:** MVP v0.1.0

## 1. Concept

VinylDex è un gioco collezionabile a tema musicale. Gli utenti aprono pacchetti di carte virtuali per collezionare artisti e gruppi musicali originali, completare un catalogo (VinylDex) e combattere online con le proprie carte.

**Target:** Appassionati di giochi collezionabili, musica, anime e cultura gaming.
**Piattaforma:** Web (MVP), mobile (futuro).

---

## 2. Classi di Artisti (8 Classi)

| # | Classe | Archetipo | Stats primarie |
|---|--------|-----------|----------------|
| 1 | **The Showman** | Carismatico, intrattenitore | Style, Fans |
| 2 | **The Rebel** | Ribelle, anticonformista | Influence, Energy |
| 3 | **The Virtuoso** | Tecnico, perfezionista | Style, Fans |
| 4 | **The Innovator** | Futuristico, sperimentale | Style, Influence |
| 5 | **The Poet** | Lirico, emotivo | Influence, Fans |
| 6 | **The King of Riffs** | Potente, energico | Energy, Fans |
| 7 | **The Dreamer** | Sognatore, etereo | Style, Energy |
| 8 | **The Synth Master** | Elettronico, digitale | Influence, Energy |

Ogni classe ha 5 carte (1 per rarità) per un totale di **40 carte MVP**.

---

## 3. Sistema Rarità

| Rarità | Stelle | Drop Rate Base | Colore | Effetto Visivo |
|--------|--------|----------------|--------|-----------------|
| Common | ★☆☆☆☆ | 50% | Verde (#4CAF50) | Bordo semplice |
| Uncommon | ★★☆☆☆ | 30% | Blu (#2196F3) | Bordo leggero |
| Rare | ★★★☆☆ | 12% | Viola (#8B5CF6) | Glow medio |
| Epic | ★★★★☆ | 6% | Arancio (#FF9800) | Glow intenso |
| Legendary | ★★★★★ | 2% | Oro (#FFD700) | Glow pulsante animato |

### Meccaniche Rarità:
- **Common/Uncommon**: drop frequenti, base della collezione
- **Rare**: garantita in ogni pacchetto Base
- **Epic**: garantita in ogni pacchetto Deluxe
- **Legendary**: garantita in ogni pacchetto Premium
- Le carte leggendarie hanno un'animazione di glow pulsante (`legendaryPulse`)

---

## 4. Sistema Pacchetti

| Pacchetto | Prezzo | Carte | Garanzie | Drop Rate |
|-----------|--------|-------|----------|-----------|
| **Base** | Gratuito (cooldown 4h) | 5 | 1 Rara | C:50%, UC:30%, R:12%, E:6%, L:2% |
| **Deluxe** | 100 Gold | 7 | 1 Rara + 1 Epica | C:30%, UC:30%, R:20%, E:15%, L:5% |
| **Premium** | 250 Gold | 10 | 1 Rara + 1 Leggendaria | C:20%, UC:25%, R:25%, E:20%, L:10% |

### Flusso di Apertura:
1. Utente seleziona pacchetto
2. Verifica costo/gratuità
3. Animazione apertura (flip/rivelazione)
4. 5-10 carte rivelate una alla volta
5. Aggiunte automaticamente alla collezione

---

## 5. Statistiche Carte (4 categorie)

| Stat | Nome | Descrizione |
|------|------|-------------|
| 🎤 Fans | Popolarità | Quanto è amato dal pubblico |
| 💃 Style | Stile | Qualità estetica e presenza scenica |
| 📢 Influence | Influenza | Capacità di influenzare tendenze |
| ⚡ Energy | Energia | Potenza e resistenza performativa |

Ogni carta ha valori da 50 a 100 (base). Le leggendarie hanno range 85-100.

---

## 6. Sistema PvP (Pianificato)

### Formato Battaglia
- **3 round** (best of 3)
- Ogni round ha una **categoria** casuale tra Fans, Style, Influence, Energy
- Giocatori selezionano **3 carte** (squadra)
- In ogni round, si sfida una carta per giocatore nella categoria scelta
- Chi ha il punteggio più alto vince il round

### Abilità Speciali (Future)
Ogni carta può avere un'abilità speciale che:
- Aumenta una stat del 25% per 1 round
- O riduce la stat avversaria
- Si attiva 1 volta per battaglia

### Sistema Matchmaking (Futuro)
- Coda basata su livello
- Trovato avversario → Schermata VS
- Inizio battaglia

---

## 7. Sistema Economia

| Valuta | Come si ottiene | Come si spende |
|--------|-----------------|----------------|
| 🪙 Gold | Missioni, battaglie, login giornaliero | Pacchetti Deluxe/Premium |
| ⚡ XP | Apertura pacchetti, missioni, battaglie | Salire di livello |
| 🎁 Pacchetto Base | Gratis ogni 4h | - |

### Gold per azione:
- Pacchetto Base: **0 Gold** (gratis ogni 4h) o **50 Gold** (acquisto immediato)
- Pacchetto Deluxe: **100 Gold**
- Pacchetto Premium: **250 Gold**

---

## 8. Sistema Livelli

| Livello | XP Necessaria | Ricompensa |
|---------|---------------|------------|
| 1 | 0 | Inizio |
| 2 | 100 | 50 Gold |
| 3 | 250 | Pacchetto Base |
| 4 | 500 | 100 Gold |
| 5 | 800 | Pacchetto Deluxe |
| 6+ | scale | Gold + XP |

Formula XP per livello: `lv * 100 + (lv - 1) * 50`

---

## 9. VinylDex (Catalogo)

- **40 carte** totali da collezionare (MVP)
- Progresso mostrato come percentuale e barra
- Carte non ottenute: placeholder `?` con sagoma scura
- Carte ottenute: full-color con bordo rarità
- Filtri per classe artista e rarità (futuro)

### Ricompense Completamento:
- 25% (10 carte): 100 Gold
- 50% (20 carte): Pacchetto Deluxe
- 75% (30 carte): 200 Gold
- 100% (40 carte): Titolo esclusivo "Collezionista Assoluto" + Trofeo

---

## 10. Missioni (Pianificate)

| Tipo | Esempio | Ricompensa |
|------|---------|------------|
| Daily | Apri 1 pacchetto | 25 Gold |
| Daily | Ottieni 3 carte | 50 XP |
| Weekly | Completa 5 battaglie | 100 Gold + Pacchetto Base |
| Weekly | Ottieni 1 carta Rara+ | 150 XP |
| Progress | Colleziona 10 carte | 100 Gold |
| Progress | Vinci 3 battaglie PvP | 200 Gold + Pacchetto Deluxe |

---

## 11. Debug Mode (Pianificata)

Tasto `D` per attivare:
- Reset collezione
- Reset gold/XP/livello
- Aggiungi 9999 gold
- Apri pacchetti infiniti (senza consumare)
- Simulazione drop rate (1000 aperture)
- Log probabilità

---

## 12. Bilanciamento Note

### Drop Rate Target (1000 aperture simulate):
| Rarità | Target | Base | Deluxe | Premium |
|--------|--------|------|--------|---------|
| Common | ~500 | 500 | 300 | 200 |
| Uncommon | ~275 | 300 | 300 | 250 |
| Rare | ~140 | 120 | 200 | 250 |
| Epic | ~60 | 60 | 150 | 200 |
| Legendary | ~25 | 20 | 50 | 100 |

### Tempo per completare VinylDex (stima):
- Solo pacchetti Base: ~150 aperture (~25 giorni con cooldown)
- Con Deluxe/Premium: ~50 aperture (più veloce con gold)
- Giocatore attivo: ~2 settimane per completare al 100%