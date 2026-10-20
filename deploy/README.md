# Deploy di VinylDex su Oracle Cloud (Always Free)

Tutto gira su un solo server gratuito, sempre acceso, con Docker Compose:

| Servizio  | Cosa fa                                                                 |
|-----------|-------------------------------------------------------------------------|
| `db`      | PostgreSQL 18, dati nel volume `db-data`, mai esposto su Internet        |
| `backend` | Spring Boot (BE/Dockerfile), porta 4000 solo dentro la rete di Docker    |
| `web`     | Caddy: frontend (frontend/Dockerfile), `/api` e `/ws` al backend, HTTPS |

File: `docker-compose.yml`, `.env.example` (variabili), `scripts/` (setup, backup, restore,
aggiornamento, export del database locale). Il file `.env` e la cartella `backups/` non vanno
mai in git.

---

## 1. Account Oracle Cloud

1. Registrati su <https://www.oracle.com/cloud/free/>. Serve una carta di credito solo per la
   verifica: restando nelle risorse "Always Free" non viene addebitato niente.
2. Scegli una **Home Region** vicina (es. Milano o Francoforte): non si cambia piu' e le risorse
   gratuite stanno li'.
3. Attiva la verifica in due passaggi dell'account.

## 2. Creare il server

Menu > Compute > Instances > **Create instance**:

- **Image:** Canonical Ubuntu 24.04.
- **Shape:** Ampere > `VM.Standard.A1.Flex`, **4 OCPU e 24 GB** (il massimo gratuito; vanno bene
  anche 2 OCPU e 12 GB). Se dice "Out of capacity" riprova piu' tardi o cambia Availability Domain.
- **Networking:** VCN nuova con subnet pubblica, **Assign a public IPv4 address**.
- **SSH keys:** "Generate a key pair" e **scarica la chiave privata** (`.key`): senza non si entra.
- **Boot volume:** 100 GB va bene (il gratuito arriva a 200 GB in tutto).

Annota l'**IP pubblico** del server.

### Porte 80 e 443 nella rete Oracle

Instance > Subnet > Security List > **Add Ingress Rules**, sorgente `0.0.0.0/0`:

- TCP porta `80`
- TCP porta `443`
- UDP porta `443` (HTTP/3, facoltativa)

(La porta 22 per SSH c'e' gia'.) Le regole del firewall dentro Ubuntu le apre lo script del passo 4.

### Server introvabile ("Out of host capacity")

I server ARM gratuiti finiscono spesso. Invece di riprovare a mano, lo script
`scripts/oracle_crea_istanza.py` riprova da solo ogni 5 minuti, una misura per volta a rotazione (4 OCPU/24 GB, 2/12, 1/6),
e si ferma appena il server esiste, stampando l'IP. Resta sempre nei limiti gratuiti.

1. **Ambiente Python** (una volta): `python -m venv %USERPROFILE%\.oci-cli` e poi
   `%USERPROFILE%\.oci-cli\Scripts\python -m pip install oci`.
2. **Chiave API**: Console Oracle > icona profilo > **My profile** > **API keys** > **Add API key**
   > "Generate API key pair" > **Download private key** > **Add**. Salva la chiave come
   `%USERPROFILE%\.oci\oci_api_key.pem`.
3. Oracle mostra un'**anteprima della configurazione**: copiala in `%USERPROFILE%\.oci\config`
   e cambia la riga `key_file` in `key_file=C:\Users\<utente>\.oci\oci_api_key.pem`.
4. Crea prima la rete (VCN Wizard, "Create VCN with Internet Connectivity") e la regola per le
   porte 80 e 443: lo script usa la subnet pubblica che trova.
5. Lancia `deploy\scripts\oracle-crea-istanza.cmd` e lascia la finestra aperta. Il PC deve restare
   acceso solo finche' il server non viene creato.

Usa la chiave SSH `%USERPROFILE%\.ssh\vinyldex.key.pub` (opzione `--ssh-key` per un'altra).

## 3. Entrare nel server

Da PowerShell sul tuo PC:

```powershell
icacls C:\percorso\chiave.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i C:\percorso\chiave.key ubuntu@<IP>
```

## 4. Preparare il server (una volta sola)

```bash
git clone https://github.com/JusTMeth25/FS0226IT--CAPSTONE.git vinyldex
cd vinyldex
sudo bash deploy/scripts/setup-server.sh
exit          # esci e rientra con ssh: serve per usare docker senza sudo
```

Lo script installa Docker, apre 80 e 443, crea 4 GB di swap, attiva gli aggiornamenti di
sicurezza automatici e il backup notturno del database.

Se il repository e' privato, `git clone` chiede utente e un **token** GitHub (Settings >
Developer settings > Personal access tokens, permesso di sola lettura sul repository).

## 5. Variabili di produzione

```bash
cd ~/vinyldex/deploy
cp .env.example .env
nano .env
```

- **Prima prova senza dominio:** `DOMAIN=:80` e `PUBLIC_URL=http://<IP>`.
- `DB_PASSWORD`, `JWT_SECRET`: casuali, generali sul server con `openssl rand -base64 48`.
- `TWO_FACTOR_KEY`: **se copi il database locale**, deve essere uguale alla chiave usata in
  locale, altrimenti chi ha la verifica in due passaggi non riesce piu' a entrare. In locale
  `TWO_FACTOR_KEY` non e' impostata, quindi vale il `JWT_SECRET` di `BE/.env`: copia quel valore.
  Con un database nuovo, invece, mettine uno casuale.
- Email (Brevo), Google e chiavi API: gli stessi valori di `BE/.env`.

## 6. Primo avvio

```bash
docker compose up -d --build      # la prima build impiega qualche minuto
docker compose ps
docker compose logs -f backend    # Ctrl+C per uscire; aspetta "Started VinylDexApplication"
```

Apri `http://<IP>` nel browser: deve comparire la pagina di accesso.

## 7. Copiare il database locale (facoltativo)

Sul PC, dalla cartella del progetto:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\export-local-db.ps1
scp -i C:\percorso\chiave.key deploy\backups\locale.dump ubuntu@<IP>:~/vinyldex/deploy/backups/
```

Sul server:

```bash
cd ~/vinyldex/deploy
bash scripts/restore.sh backups/locale.dump
```

Il database locale contiene anche account e dati di prova: valuta se ripartire da zero
(basta non fare questo passo: le migrazioni creano tutto e il catalogo si importa dal pannello
Admin).

## 8. Dominio e HTTPS (quando vinyldex.eu.org e' attivo)

1. Cloudflare > `vinyldex.eu.org` > DNS > **Add record**:
   - Type `A`, Name `@`, IPv4 `<IP del server>`, Proxy status **DNS only** (nuvola grigia).
   - Type `CNAME`, Name `www`, Target `vinyldex.eu.org`, DNS only.
2. Aspetta che `nslookup vinyldex.eu.org` restituisca l'IP del server.
3. In `deploy/.env`: `DOMAIN=vinyldex.eu.org` e `PUBLIC_URL=https://vinyldex.eu.org`, poi
   `docker compose up -d`. Caddy ottiene da solo il certificato HTTPS.
4. Google Cloud Console > Credenziali > client web > **Origini JavaScript autorizzate**:
   aggiungi `https://vinyldex.eu.org`.
5. Brevo: dominio autenticato e `MAIL_FROM=noreply@vinyldex.eu.org` (vedi la guida email).

## 9. Lavoro di tutti i giorni

| Cosa                          | Comando (in `~/vinyldex/deploy`)                       |
|-------------------------------|--------------------------------------------------------|
| Aggiornare all'ultimo commit  | `bash scripts/update.sh` (backup, pull, rebuild)       |
| Log del backend               | `docker compose logs -f --tail 200 backend`            |
| Riavviare                     | `docker compose restart backend`                       |
| Backup a mano                 | `bash scripts/backup.sh`                               |
| Copiare i backup sul PC       | dal PC: `scp -i chiave.key ubuntu@<IP>:~/vinyldex/deploy/backups/*.dump .` |
| Spazio su disco               | `df -h` e `docker system df`                           |

I backup notturni stanno sullo stesso server: ogni tanto copiane uno sul PC.

## Note

- Oracle puo' recuperare le istanze gratuite rimaste quasi inattive per una settimana (CPU,
  rete e memoria sotto il 20%). Con il backend sempre attivo e qualche utente di solito non
  succede; tieni comunque i backup.
- Cambiare `JWT_SECRET` fa uscire tutti gli utenti; cambiare `TWO_FACTOR_KEY` rompe la verifica
  in due passaggi di chi l'ha attiva.
