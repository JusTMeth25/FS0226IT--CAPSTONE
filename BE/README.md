# VinylDex — Backend Spring Boot

API REST del capstone. Sostituisce il backend Node/Express/Prisma che vive in `../backend`,
mantenendo la stessa superficie HTTP: il frontend non richiede modifiche.

- **Spring Boot 4.1.1** su **Java 25**
- **PostgreSQL** locale (`FS0226IT-CAPSTONE`), schema gestito da **Flyway**
- **Spring Security** con JWT stateless (jjwt), password BCrypt

---

## Requisiti

| Strumento | Versione | Note |
|---|---|---|
| JDK | 25 | `java -version` |
| PostgreSQL | 16+ | Testato su 18.4 |
| Maven | — | Usare il wrapper `./mvnw` incluso |

---

## Avvio rapido

```bash
# 1. Creare il database (da pgAdmin oppure da riga di comando)
createdb -U postgres -E UTF8 "FS0226IT-CAPSTONE"

# 2. Impostare le variabili d'ambiente
cp .env.example .env    # poi compilare DB_PASSWORD e JWT_SECRET

# 3. Avviare: Flyway crea lo schema al primo avvio
DB_PASSWORD="..." JWT_SECRET="..." ./mvnw spring-boot:run
```

L'API risponde su `http://localhost:4000`. Sonda di salute: `GET /health`.

---

## Configurazione

Tutta la configurazione passa da variabili d'ambiente, con valori di riserva in
`src/main/resources/application.properties`. Nessun segreto sta nel codice.

Le due variabili obbligatorie sono `DB_PASSWORD` e `JWT_SECRET`. `JWT_SECRET` deve
misurare almeno 32 byte: l'applicazione si rifiuta di partire se e' piu corto.
Va tenuto uguale a quello del backend Node, altrimenti i token gia emessi smettono
di valere e tutti devono rifare il login.

L'elenco completo sta in `.env.example`.

---

## Struttura

```
src/main/java/com/capstone/vinyldex/
├── config/       SecurityConfig, rate limit, client HTTP
├── controller/   Endpoint REST
├── dto/          Corpi di richiesta e risposta (record)
├── entity/       Entita JPA ed enum
├── exception/    ApiException e gestore globale
├── importer/     Import da API esterne di carte (9 fonti)
├── repository/   Spring Data JPA
├── security/     JWT, filtro di autenticazione, principal
└── service/      Logica applicativa
```

### Tre invarianti da non rompere

1. **I gold passano solo da `WalletService`.** Rilegge sempre il saldo dal database con
   un lock in scrittura e registra ogni movimento in `user_wallet_transactions`. Nessun
   altro punto del codice deve scrivere `user.gold` direttamente.

2. **Il server decide tutto quello che vale qualcosa.** Carte estratte da un pacchetto,
   probabilita di drop, ricompense di battaglia, progresso delle missioni: il client
   comunica solo l'evento, mai l'importo.

3. **L'id pubblico di una carta e il suo `code`**, non lo UUID della riga. Vale anche per
   pacchetti e missioni. Gli UUID compaiono solo negli endpoint `/api/admin`.

---

## Database

Lo schema e definito in `src/main/resources/db/migration/V1__init_schema.sql` e applicato
da Flyway all'avvio. Hibernate e in modalita `validate`: non genera DDL, ma segnala subito
se entita e tabelle divergono.

Per cambiare lo schema si aggiunge un nuovo file `V2__...sql`. Non si modifica mai una
migrazione gia applicata: Flyway confronta il checksum e rifiuta di partire.

### Migrazione dei dati da Supabase

Il travaso e una operazione una tantum, gia predisposta in `scripts/`:

```bash
export SUPABASE_DATABASE_URL="..."   # dalla voce DATABASE_URL di backend/.env
export PGPASSWORD="..."              # password postgres locale

./scripts/migrate-from-supabase.sh            # crea il DB, scarica il dump, lo mette in "legacy"
./mvnw spring-boot:run                        # Flyway crea lo schema nuovo, poi fermare
psql -U postgres -d "FS0226IT-CAPSTONE" -v ON_ERROR_STOP=1 -f scripts/import-legacy-data.sql
```

Lo script di import traduce i nomi Prisma (`"User"`, `"passwordHash"`) in quelli snake_case
dello schema nuovo, e in coda stampa un confronto riga per riga fra origine e destinazione.
Quando i conteggi coincidono si puo eliminare lo schema di appoggio:

```bash
psql -U postgres -d "FS0226IT-CAPSTONE" -c "DROP SCHEMA legacy CASCADE;"
```

Gli hash BCrypt arrivano invariati da bcryptjs: gli account esistenti continuano a
funzionare con la stessa password.

---

## Endpoint

### Pubblici
| Metodo | Percorso | Descrizione |
|---|---|---|
| GET | `/health` | Stato applicazione e database |
| POST | `/api/auth/register` | Registrazione |
| POST | `/api/auth/login` | Accesso |
| GET | `/api/cards/{code}` | Dettaglio carta |
| GET | `/api/packs` | Pacchetti (con token: anche quelli regalati) |
| GET | `/api/market/listings` | Inserzioni attive |
| GET | `/api/events` | Eventi in corso |
| GET | `/api/leaderboard` | Classifica (`?type=collection\|gold\|battles`) |

### Autenticati
| Metodo | Percorso | Descrizione |
|---|---|---|
| GET | `/api/auth/profile` | Profilo corrente |
| PATCH | `/api/auth/avatar` | Cambio avatar |
| GET | `/api/collection` | Catalogo con stato di possesso |
| POST | `/api/collection/{code}/favorite` | Preferito on/off |
| POST | `/api/open-pack` | Apertura pacchetto |
| POST | `/api/market/list` | Metti in vendita |
| POST | `/api/market/buy` | Acquista |
| DELETE | `/api/market/listings/{id}` | Ritira inserzione |
| POST | `/api/trades` | Proponi scambio |
| GET | `/api/trades/incoming` · `/outgoing` | Scambi |
| POST | `/api/trades/{id}/accept` · `/reject` · `/cancel` | Esito scambio |
| GET | `/api/missions` | Missioni con progresso |
| POST | `/api/missions/{code}/claim` | Riscuoti ricompensa |
| POST | `/api/missions/daily-login/claim` | Bonus giornaliero |
| POST | `/api/battles/reward` | Ricompensa di battaglia |

### Solo amministratori (`ROLE_ADMIN`)
`/api/admin/**` — utenti, carte, pacchetti, missioni, eventi, log, import.
`/api/ai/**` — generazione immagini.

> **Differenza rispetto al backend Node:** `/api/ai/generate-batch` era raggiungibile da
> chiunque. Qui richiede il ruolo amministratore, perche ogni chiamata consuma credito
> OpenAI a pagamento.

### Formato degli errori

Sempre `{"error": "<codice>"}`, con gli stessi codici del backend Node
(`insufficient_gold`, `card_not_found`, `cooldown`, `forbidden`, …), cosi il frontend
non richiede modifiche.

---

## Import di carte esterne

Nove fonti: Pokemon TCG, Scryfall, YGOPRODeck, One Piece, Digimon, Lorcana, Riftbound,
Gundam, Dragon Ball.

`POST /api/admin/import/{fonte}` con corpo facoltativo `{ "limit": 100, "page": 3 }`.

Quando possibile la rarita non viene presa da quella dichiarata dall'editore ma dedotta dal
prezzo di mercato reale, con soglie calibrate per fonte (vedi `PriceRarityMapper`): una carta
da 300 dollari diventa `legendary` qualunque simbolo porti stampato.

Se una API non risponde, l'import non fallisce: salva un paio di carte segnaposto disattivate
e restituisce `usedFallback: true` con il motivo. Le carte segnaposto restano `is_active = false`,
quindi non escono mai dai pacchetti veri.

Aggiungere una fonte significa scrivere una classe che estende `AbstractCardImporter`:
Spring la registra da sola, senza toccare controller o servizi.

---

## Test

```bash
./mvnw test
```

I test di logica pura (livelli, JWT, soglie di rarita) girano sempre. Il test di avvio del
contesto richiede un database e viene saltato se `DB_PASSWORD` non e impostata, cosi la
suite resta verde su una macchina pulita:

```bash
DB_PASSWORD="..." ./mvnw test
```

---

## Pacchetto per il deploy

```bash
./mvnw clean package
java -jar target/vinyldex-0.0.1-SNAPSHOT.jar
```
