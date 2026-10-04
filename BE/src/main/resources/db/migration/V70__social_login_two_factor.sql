-- Accesso con Google e Apple e verifica in due passaggi (codice a 6 cifre di un'app come
-- Google Authenticator), richiesta di rado grazie ai dispositivi fidati.

ALTER TABLE users
    ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false,
    -- Segreti TOTP cifrati (AES-GCM, vedi SecretBox): quello attivo e quello in attesa di conferma.
    ADD COLUMN totp_secret        varchar(255),
    ADD COLUMN totp_pending       varchar(255),
    -- Ultimo intervallo di 30 secondi gia' usato: lo stesso codice non vale due volte.
    ADD COLUMN totp_last_step     bigint NOT NULL DEFAULT 0;

-- Account esterni collegati (Google, Apple): "sub" e' l'id stabile dell'utente presso il fornitore.
CREATE TABLE user_identities
(
    id         uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider   varchar(20) NOT NULL,
    subject    varchar(255) NOT NULL,
    email      varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, subject)
);
CREATE INDEX idx_user_identities_user ON user_identities (user_id);

-- Dispositivi su cui il secondo passaggio e' gia' stato fatto: si salva solo l'hash del token.
-- La scadenza si sposta in avanti a ogni accesso.
CREATE TABLE trusted_devices
(
    id           uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   char(64)    NOT NULL UNIQUE,
    label        varchar(120),
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL
);
CREATE INDEX idx_trusted_devices_user ON trusted_devices (user_id);

-- Codici di emergenza monouso, per chi perde il telefono con l'app dei codici.
CREATE TABLE two_factor_backup_codes
(
    id        uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash char(64)    NOT NULL,
    used_at   timestamptz
);
CREATE INDEX idx_backup_codes_user ON two_factor_backup_codes (user_id);
