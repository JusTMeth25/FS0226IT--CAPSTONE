# ⚙️ VinylDex — Backend Spring Boot

API REST e WebSocket dell'hotel: tutta la logica di gioco di VinylDex.

- **Spring Boot 4.1.1** su **Java 25**
- **PostgreSQL**, schema gestito da **Flyway**
- **Spring Security** con JWT stateless (jjwt) in cookie HttpOnly o Bearer, password BCrypt
- **WebSocket** per l'hotel in tempo reale, **springdoc-openapi** per la documentazione

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
createdb -U postgres -E UTF8 vinyldex

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
Cambiarlo invalida tutti i token gia' emessi.

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

Lo schema nasce da `src/main/resources/db/migration/V1__init_schema.sql` ed evolve con le migrazioni
successive (86 in tutto), applicate da Flyway all'avvio. Hibernate e' in modalita' `validate`: non genera DDL,
ma segnala subito se entita' e tabelle divergono.

Per cambiare lo schema si aggiunge un nuovo file `V<n>__descrizione.sql`. Non si modifica mai una migrazione
gia' applicata: Flyway confronta il checksum e rifiuta di partire.

---

## Endpoint

Tutti gli endpoint REST sono documentati con **OpenAPI 3** (springdoc), raggruppati per area:

- Swagger UI: `http://localhost:4000/api/docs` (online: https://vinyldex.duckdns.org/api/docs)
- Specifica JSON: `/api/docs/openapi.json`

Pubblici, senza login: `/health`, registrazione, accesso e recupero password, catalogo delle carte, pacchetti,
inserzioni del mercato, eventi, classifica e documentazione. Tutto il resto richiede la sessione.
`/api/admin/**` e `/api/ai/**` sono riservati al ruolo `ADMIN`.

L'hotel in tempo reale usa il WebSocket `/ws/hotel`: il protocollo dei messaggi e' descritto in testa a
`hotel/HotelSocketHandler.java`.

### Autenticazione

- **Sito:** il login risponde con il cookie `vinyldex_session` (`HttpOnly`, `Secure`, `SameSite=Strict`). Le
  richieste che modificano dati fatte col cookie devono avere l'intestazione `X-VinylDex-Client`
  (protezione CSRF).
- **App nativa e prove da Swagger:** login con `X-VinylDex-Client: native`, che restituisce il token nel corpo,
  poi `Authorization: Bearer <token>`.

### Formato degli errori

Sempre `{"error": "<codice>"}` (`insufficient_gold`, `card_not_found`, `cooldown`,
`forbidden`, …): il frontend sceglie il messaggio da mostrare in base al codice.

---

## Import di carte esterne

Ventitre fonti, una classe per fonte in `importer/sources/`: Pokemon TCG (anche Giappone e promo), Scryfall
(Magic), YGOPRODeck (Yu-Gi-Oh!), One Piece, Digimon, Lorcana, Riftbound, Gundam, Dragon Ball, Weiss Schwarz,
Vanguard, Shadowverse, Union Arena, NIKKE, hololive, WIXOSS, Grand Archive, Cyberpunk, NBA ed EA FC 27.

`POST /api/admin/import/{fonte}` con corpo facoltativo `{ "limit": 100, "page": 3 }`.

Quando possibile la rarita' non viene presa da quella dichiarata dall'editore ma dedotta dal prezzo di mercato
reale, con soglie calibrate per fonte (vedi `PriceRarityMapper`): una carta da 300 dollari diventa `legendary`
qualunque simbolo porti stampato.

Se una API non risponde, l'import non fallisce: salva un paio di carte segnaposto disattivate e restituisce
`usedFallback: true` con il motivo. Le carte segnaposto restano `is_active = false`, quindi non escono mai dai
pacchetti veri.

Aggiungere una fonte significa scrivere una classe che estende `AbstractCardImporter`: Spring la registra da
sola, senza toccare controller o servizi.

---

## Test

```bash
./mvnw test      # test unitari e di integrazione
./mvnw verify    # in piu' il report di copertura JaCoCo in target/site/jacoco/index.html
```

I test di logica pura (livelli, JWT, soglie di rarita', freno ai tentativi, casino'...) girano sempre. Quelli di
integrazione usano un vero PostgreSQL: girano se esiste `BE/.env` o se le credenziali del database sono nelle
variabili d'ambiente, altrimenti vengono saltati, cosi' la suite resta verde su una macchina appena clonata.
In GitHub Actions girano tutti, con un PostgreSQL di servizio (vedi `.github/workflows/ci.yml`).

---

## Pacchetto per il deploy

```bash
./mvnw clean package
java -jar target/vinyldex-0.0.1-SNAPSHOT.jar
```
