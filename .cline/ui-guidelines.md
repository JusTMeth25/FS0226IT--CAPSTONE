# VinylDex — UI/UX Guidelines

> **Ultimo aggiornamento:** 06/06/2026
> **Stile:** Dark Neon Anime Gaming UI

## 1. Palette Colori

### Background
```css
--bg-primary:   #050816   // Nero profondo
--bg-secondary: #0A1024   // Blu notte scuro
--bg-tertiary:  #0E1635   // Blu navy profondo
--bg-card:      #111B3D   // Sfondo carte
--bg-card-hover:#162050   // Hover carte
```

### Accenti Neon
```css
--neon-purple:  #8B5CF6   // Viola primario
--neon-magenta: #EC4899   // Rosa/magenta
--neon-blue:    #3B82F6   // Blu elettrico
--neon-cyan:    #22D3EE   // Ciano
--neon-gold:    #FFD700   // Oro
```

### Rarità
```css
--rarity-common:    #4CAF50   // Verde
--rarity-uncommon:  #2196F3   // Blu
--rarity-rare:      #8B5CF6   // Viola
--rarity-epic:      #FF9800   // Arancio
--rarity-legendary: #FFD700   // Oro
```

### Testo
```css
--text-primary:   #F0F0F0   // Bianco leggermente caldo
--text-secondary: #A0A0B0   // Grigio chiaro
--text-muted:     #606080   // Grigio scuro
```

## 2. Tipografia

- **Font principale**: `'Segoe UI', system-ui, -apple-system, sans-serif`
- **Pesi**: Regular (400), Medium (500), Semibold (600), Bold (700), Extrabold (800), Black (900)
- **Uso**:
  - Titoli: weight 800-900, uppercase, letter-spacing 1-2px
  - Testo corpo: weight 400, 16px base
  - Stats: weight 900, numeri grandi
  - Badge: weight 700, uppercase, 0.65rem
  - Nome carta: weight 700, 0.85rem

### Gerarchia Tipografica
```
Home Title:     2.5rem, weight 900, gradient neon
Section Title:  1.5rem, weight 800, uppercase, gradient neon
Card Name:      0.85rem, weight 700
Card Class:     0.7rem, weight 500, text-secondary
Stat Value:     1.8rem, weight 900
Stat Label:     0.8rem, uppercase, letter-spacing 1px
Rarity Badge:   0.65rem, weight 700, uppercase
```

## 3. Spaziatura

```css
--space-xs:  4px
--space-sm:  8px
--space-md:  16px
--space-lg:  24px
--space-xl:  32px
--space-2xl: 48px
```

## 4. Card Design

### Dimensioni
```css
Desktop: 180px × 260px
Tablet:  150px × 220px
Mobile:  140px × 200px
```

### Struttura Carta
```
┌─────────────────────┐
│ [Rarity Badge]      │  ← Angolo superiore dx
│                     │
│   Artwork/Placeholder│  ← 70% altezza
│   (SVG o immagine)  │
│                     │
│─────────────────────│
│ Nome Carta          │  ← weight 700
│ Classe Artista      │  ← weight 500, text-secondary
│ ★★★★☆              │  ← Stelle rarità
└─────────────────────┘
```

### Bordo e Glow per Rarità
- **Common**: bordo verde, shadow leggera
- **Uncommon**: bordo blu, shadow media
- **Rare**: bordo viola, shadow glow viola
- **Epic**: bordo arancio, shadow glow arancio
- **Legendary**: bordo oro, shadow glow oro con animazione pulse

## 5. Componenti UI

### Pulsanti
```css
.btn-primary:    Gradient viola→magenta, glow viola
.btn-secondary:  Trasparente, bordo ciano 2px
.btn-gold:       Gradient oro→arancio, shadow oro
.btn-large:      padding maggiore, font-size 1.1rem
```

### Pannelli Glass
```css
.glass-panel:
  background: rgba(14, 22, 53, 0.8)
  backdrop-filter: blur(8px)
  border: 1px solid rgba(139, 92, 246, 0.15)
  border-radius: 16px
```

### Progress Bar
```css
.progress-bar:
  height: 8px
  background: var(--bg-tertiary)
  border-radius: 4px

.progress-fill:
  gradient: viola → magenta
  transition: width 0.5s ease
```

### Navigation
```css
Header: sticky, blur backdrop, glass-bottom-border
Nav link: text-secondary, hover→text-primary+purple bg
Active: purple text, purple underline
```

## 6. Layout

### Home Page
```
┌──────────────────────────────────┐
│         Hero Section             │
│   Benvenuto su VinylDex          │
│   [Apri un Pacchetto]            │
├────────┬──────┬──────┬───────────┤
│ Livello│ Gold │  XP  │ VinylDex  │
├────────┴──────┴──────┴───────────┤
│      Progress Bar VinylDex       │
├──────────────────────────────────┤
│       Azioni Rapide (3 card)     │
├──────────────────────────────────┤
│     Ultime Carte Ottenute (5)    │
└──────────────────────────────────┘
```

### Collezione
```
┌──────────────────────────────────┐
│  La Mia Collezione (X carte)     │
│  [Filtri: Classe] [Rarità] [Ord] │
├──────────────────────────────────┤
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│ │ C │ │ C │ │ C │ │ C │ │ C │  │
│ │ a │ │ a │ │ a │ │ a │ │ a │  │
│ │ r │ │ r │ │ r │ │ r │ │ r │  │
│ │ d │ │ d │ │ d │ │ d │ │ d │  │
│ └───┘ └───┘ └───┘ └───┘ └───┘  │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│ │ C │ │ C │ │ C │ │ C │ │ C │  │
│ │ a │ │ a │ │ a │ │ a │ │ a │  │
│ │ r │ │ r │ │ r │ │ r │ │ r │  │
│ │ d │ │ d │ │ d │ │ d │ │ d │  │
│ └───┘ └───┘ └───┘ └───┘ └───┘  │
└──────────────────────────────────┘
```

### VinylDex (Catalogo)
```
┌──────────────────────────────────┐
│  VinylDex (25/40 — 62.5%)       │
│  ████████████████░░░░░░░░░░░░░   │
├──────────────────────────────────┤
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│ │ C │ │ ? │ │ C │ │ ? │ │ C │  │
│ │ a │ │   │ │ a │ │   │ │ a │  │
│ │ r │ │ N │ │ r │ │ N │ │ r │  │
│ │ d │ │ S │ │ d │ │ S │ │ d │  │
│ └───┘ └───┘ └───┘ └───┘ └───┘  │
│  (posseduta) (mancante)          │
└──────────────────────────────────┘
```

## 7. Animazioni e Transizioni

### Elemento | Tipo | Durata | Descrizione
Hero glow | `heroGlow` | 4s | Radiale pulsante sullo sfondo
Legendary pulse | `legendaryPulse` | 2s | Glow oro che pulsa
Card hover | translateY(-4px) + shadow | 0.3s | Sollevamento carta
Button hover | translateY(-2px) | 0.3s | Sollevamento bottone
Progress fill | width transition | 0.5s | Riempimento smooth
Page transition | (future) fade/slide | 0.3s | Transizione pagine
Pack opening | (future) flip/rivelazione | 0.5s per carta | Animazione apertura

### Regole Animazioni
- Preferire `transform` e `opacity` per performance
- Usare `will-change` solo su elementi animati
- `prefers-reduced-motion: reduce` → disabilitare animazioni
- Non superare 4s per animazioni infinite

## 8. Responsive Breakpoints

### Desktop (>768px)
- Layout a griglia 4-5 colonne
- Card 180×260
- Header orizzontale

### Tablet (480-768px)
- Griglia 3-4 colonne
- Card 150×220
- Header compattato

### Mobile (<480px)
- Griglia 2 colonne
- Card 140×200
- Menu hamburger (futuro)

## 9. Accessibilità (Target)

- **Contrasto**: Tutti i testi hanno rapporto di contrasto ≥4.5:1
- **Focus**: outline visibile su elementi interattivi
- **Keyboard**: navigazione completa via tastiera
- **ARIA**: labels sui pulsanti, ruoli su componenti custom
- **Motion**: rispettare `prefers-reduced-motion`
- **Screen reader**: testi alternativi su immagini

## 10. Immagini Placeholder (MVP)

Le carte usano SVG inline generati dal `Card._generatePlaceholderImg()`:

```svg
SVG 200×280
- Rettangolo sfondo scuro (#111B3D)
- Cerchio trasparente con colore rarità (opacity 0.3)
- Iniziale del nome in grande, colore rarità
```

Quando arriveranno le immagini AI, verranno salvate in `assets/img/cards/` con nome file come `showman-royal-echo.png`.