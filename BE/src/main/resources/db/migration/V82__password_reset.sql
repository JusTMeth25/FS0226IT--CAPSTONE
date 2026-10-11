-- "Non ricordo la password": link via email con un token monouso. Si salva solo l'hash SHA-256
-- del token, mai il token. password_changed_at invalida i token di accesso emessi prima del cambio.

CREATE TABLE password_reset_tokens
(
    id         uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    ip         varchar(64),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id, created_at);

ALTER TABLE users ADD COLUMN password_changed_at timestamptz;
