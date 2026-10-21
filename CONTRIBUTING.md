# 🤝 Come lavorare sul progetto

Guida breve per chi mette le mani nel codice di VinylDex. Per installare e avviare il progetto vedi il
[README](README.md#-avvio-rapido).

## 🌿 Flusso di lavoro

1. Parti da `main` aggiornato e crea un branch: `git switch -c feature/nome-breve`.
2. Fai modifiche piccole e coerenti, con messaggi di commit che dicono **cosa cambia per chi usa il sito**.
3. Prima di aprire la pull request lancia i controlli qui sotto: la CI li ripete comunque.

## ✅ Controlli prima del push

```bash
# Backend: test unitari e di integrazione, con copertura
cd BE && ./mvnw verify

# Frontend: lint, test e build
cd frontend && npm run lint && npm test && npm run build
```

## 📐 Convenzioni

- **Lingua:** interfaccia, commenti e descrizioni dei test in italiano. Nomi di classi, metodi e variabili in
  inglese.
- **Commenti:** spiegano il *perché*, non il *cosa*.
- **Backend:**
  - i gold si muovono solo da `WalletService`;
  - il server decide sempre estrazioni, probabilità e ricompense;
  - le query usano sempre parametri.
- **Database:**
  - ogni cambio di schema è una **nuova** migrazione Flyway in `BE/src/main/resources/db/migration`;
  - le migrazioni già pubblicate non si modificano mai.
- **Frontend:**
  - componenti funzionali con hook; niente librerie di componenti;
  - lo stile Phantom sta sotto `:root[data-skin="phantom"]`, quello dell'hotel sotto
    `:root[data-shell="phantom"]`.
- **Accessibilità:**
  - bottoni e input veri, raggiungibili da tastiera e controller, aree di tocco di almeno 44 px;
  - ogni nuovo effetto con lampi va spento in modalità sicura (`isSafeMode()` in
    `frontend/src/services/accessibility.js`).
- **Segreti:** mai nel codice. Vanno in `BE/.env` e `deploy/.env`, che sono esclusi da git. Ogni nuova
  variabile va documentata in `.env.example`.
