-- Cassa del banco del casino: quello che i giocatori perdono ai giochi entra, quello che vincono
-- esce (fiches e gold separati). L'admin, gestore del locale, riscuote il saldo nel suo portafoglio.
-- Il cambio gold/fiches alla cassa e il regalo giornaliero di fiches non contano: non sono gioco.
CREATE TABLE casino_bank
(
    currency   varchar(10) PRIMARY KEY CHECK (currency IN ('CHIPS', 'GOLD')),
    balance    bigint      NOT NULL DEFAULT 0,
    earned     bigint      NOT NULL DEFAULT 0,
    withdrawn  bigint      NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO casino_bank (currency) VALUES ('CHIPS'), ('GOLD');

-- Riscossioni dell'admin, per lo storico.
CREATE TABLE casino_bank_withdrawals
(
    id         uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    admin_id   uuid        NOT NULL REFERENCES users (id),
    currency   varchar(10) NOT NULL,
    amount     bigint      NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_casino_bank_withdrawals_at ON casino_bank_withdrawals (created_at DESC);
