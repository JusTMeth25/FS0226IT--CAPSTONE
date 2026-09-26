-- Animale da compagnia dell'hotel: uno per giocatore, lo segue nelle stanze. Se non mangia da un
-- giorno e' affamato (e si vede).
CREATE TABLE user_pets (
    user_id     uuid         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    type        varchar(20)  NOT NULL,
    name        varchar(20)  NOT NULL,
    fed_at      timestamptz  NOT NULL DEFAULT now(),
    adopted_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_user_pets_type CHECK (type IN ('dog', 'cat', 'bunny'))
);
