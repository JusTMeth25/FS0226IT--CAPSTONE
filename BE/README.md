# VinylDex — Backend Spring Boot

API REST del capstone. Ha sostituito il backend Node/Express/Prisma mantenendone la stessa
superficie HTTP, percio' il frontend non ha richiesto modifiche. Il codice precedente resta
nella storia di git.

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

# 2. Impostare i segreti
cp .env.example .env    # poi compilare DB_PASSWORD e JWT_SECRET

# 3. Avviare: Flyway crea lo schema al primo avvio
./mvnw spring-boot:run
```

L'API risponde su `http://localhost:4000`. Sonda di salute: `GET /health`.

---

## Configurazione

La configurazione arriva da `BE/.env`, letto all'avvio tramite `spring.config.import`,
oppure da normali variabili d'ambiente che hanno la precedenza. I valori di riserva stanno
in `src/main/resources/application.properties`. Nessun segreto sta nel codice, e `.env` e'
gitignorato.

Le due variabili obbligatorie sono `DB_PASSWORD` e `JWT_SECRET`. `JWT_SECRET` deve
misurare almeno 32 byte: l'applicazione si rifiuta di partire se e' piu corto.
E' lo stesso segreto che usava il backend Node, cosi' i token gia emessi sono rimasti
validi durante il passaggio.

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

### Migrazione dei dati da Supabase (gia' eseguita)

Il travaso dal vecchio database Supabase e' stato completato: 20 tabelle, 2099 righe,
conteggi identici fra origine e destinazione. Gli hash BCrypt sono arrivati invariati da
bcryptjs, quindi gli account esistenti funzionano con la stessa password.

Gli script restano in `scripts/` come riferimento, per ripetere l'operazione su un'altra
macchina o per ripartire da un backup:

```bash
export SUPABASE_DATABASE_URL="..."   # stringa in modalita' Session, porta 5432
export PGPASSWORD="..."              # password postgres locale

./scripts/migrate-from-supabase.sh            # crea il DB, scarica il dump, lo mette in "legacy"
./mvnw spring-boot:run                        # Flyway crea lo schema nuovo, poi fermare
psql -U postgres -d "FS0226IT-CAPSTONE" -v ON_ERROR_STOP=1 -f scripts/import-legacy-data.sql
```

`import-legacy-data.sql` traduce i nomi Prisma (`"User"`, `"passwordHash"`) in quelli
snake_case dello schema nuovo, e in coda stampa un confronto riga per riga fra origine e
destinazione. Quando i conteggi coincidono si elimina lo schema di appoggio:

```bash
psql -U postgres -d "FS0226IT-CAPSTONE" -c "DROP SCHEMA legacy CASCADE;"
```

Attenzione: `pg_dump` non funziona con il pooler Supabase in modalita' Transaction
(porta 6543). Serve la stringa in modalita' Session, porta 5432.

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
contesto richiede un database: gira se esiste `BE/.env` oppure se `DB_PASSWORD` e impostata
nell'ambiente, altrimenti viene saltato, cosi la suite resta verde su una macchina appena
clonata.

---

## Pacchetto per il deploy

```bash
./mvnw clean package
java -jar target/vinyldex-0.0.1-SNAPSHOT.jar
```
