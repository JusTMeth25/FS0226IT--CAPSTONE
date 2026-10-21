# 🛠️ Strumenti di sviluppo

Script Python che generano dati e risorse statiche del progetto. **Non fanno parte dell'app**:
si lanciano a mano quando serve rigenerare un file, e il risultato si committa nel repository.
Ne' il backend ne' il frontend li eseguono a runtime.

Tutti i percorsi di output sono calcolati a partire dalla posizione dello script, quindi si
possono lanciare da qualsiasi cartella (gli esempi sotto partono dalla radice del repository).

## 📋 Requisiti

- **Python 3.10+**, solo libreria standard (nessun `pip install`).
- **curl** nel `PATH`: `disco_djs.py`, `sketchfab_djs.py` e `sketchfab_guitars.py` lo usano al
  posto di `urllib`, perche' su alcune macchine i certificati di Python sono scaduti.
- **Node.js / npx** solo per `sketchfab_guitars.py` (usa `@gltf-transform/cli` per alleggerire
  le texture).
- 🔑 **Chiave API di Sketchfab** solo per gli script `sketchfab_*.py`, nella variabile d'ambiente
  `SKETCHFAB_API_KEY` (oppure `Sketchfab API KEY`). Gli script non la stampano mai.

## 📦 Gli script

| Script | Cosa fa | Cosa scrive |
| --- | --- | --- |
| `fc27_cards.py` | Elenco fisso delle carte EA FC 27 Ultimate Team: i primi 100 giocatori della classifica ufficiale EA (valutazione, ruolo, club, nazione, statistiche, foto) piu' le icone con statistiche e prezzi stimati. Serve ad avere le carte anche senza rete; un import successivo dal pannello admin le aggiorna (stesso id `ea-<id EA>`). | `BE/src/main/resources/fc27/cards.json` |
| `disco_djs.py` | Prepara i set dei DJ della Disco: per ogni brano cerca su iTunes Search API (gratuita, senza chiave) l'anteprima di 30 secondi, la copertina e il link ad Apple Music. Sceglie sempre la versione originale, mai quella censurata. | `BE/src/main/resources/music/djs.json` |
| `hotel_rooms.py` | Pianta, arredi e posti degli NPC delle stanze pubbliche dell'hotel. Prima di scrivere controlla che i mobili stiano dentro la stanza senza sovrapporsi, che ogni casella libera sia raggiungibile dalla porta (stesse regole di `Pathfinder.java`) e che ogni NPC parta da un posto valido. | Le migrazioni Flyway delle stanze in `BE/src/main/resources/db/migration/` (riscrive solo quella indicata da `CURRENT`, le altre sono gia' pubblicate e non si toccano) e, a video, le righe di `NpcRoster.java` con le posizioni degli NPC |
| `sketchfab_cars.py` | Scarica i modelli 3D (`.glb`) delle auto sportive del quartiere, uno per ogni veicolo del catalogo (`LuxuryCatalog.java`, parte `r`). | `frontend/public/models/cars/r<n>.glb` e `credits.json` |
| `sketchfab_djs.py` | Scarica i caschi dei DJ della Disco (parte `d` del codice aspetto, `DJ_HEADS` in `avatar.js`). | `frontend/public/models/djs/d<n>.glb` e `credits.json` |
| `sketchfab_guitars.py` | Scarica i controller chitarra del Rock Store (parte `g` del codice aspetto) e li alleggerisce con texture WebP a 512 px. | `frontend/public/models/guitars/` e `credits.json` |

I modelli di Sketchfab hanno licenza **CC Attribution**: gli autori vanno citati, ed e' per questo
che ogni cartella ha il suo `credits.json`, che l'app mostra nei crediti.

## ▶️ Come lanciarli

```bash
python tools/fc27_cards.py
python tools/disco_djs.py
python tools/hotel_rooms.py              # scrive la migrazione e stampa il roster degli NPC
python tools/hotel_rooms.py --preview    # disegna anche le piante in ASCII

# Sketchfab: serve la chiave
export SKETCHFAB_API_KEY=...             # PowerShell: $env:SKETCHFAB_API_KEY = "..."
python tools/sketchfab_cars.py
python tools/sketchfab_djs.py
python tools/sketchfab_guitars.py
```

## ⚠️ Attenzione

- Le migrazioni Flyway gia' applicate in produzione **non si modificano mai**: Flyway ne
  controlla il checksum e il backend non partirebbe. Per cambiare una stanza gia' pubblicata si
  aggiunge una migrazione nuova e si sposta `CURRENT` in `hotel_rooms.py`.
- Dopo aver rigenerato un file, controlla il diff prima di committarlo.
