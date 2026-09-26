-- Pesca dal molo: i pesci rari portano una carta. Si tiene traccia delle carte pescate per il
-- limite giornaliero.
CREATE TABLE fishing_catches (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id     uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    score       integer      NOT NULL,
    caught_on   date         NOT NULL,
    caught_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_fishing_catches_day ON fishing_catches (user_id, caught_on);
