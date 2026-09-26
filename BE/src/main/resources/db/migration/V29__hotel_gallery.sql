-- Mostra delle collezioni: ogni settimana ogni giocatore espone fino a 5 carte, gli altri votano
-- (un voto a testa a settimana) e i primi tre vincono gold.
CREATE TABLE gallery_entries (
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week        date         NOT NULL,
    card_ids    uuid[]       NOT NULL,
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, week)
);

CREATE TABLE gallery_votes (
    voter_id    uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week        date         NOT NULL,
    target_id   uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voted_at    timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (voter_id, week)
);

CREATE INDEX idx_gallery_votes_target ON gallery_votes (week, target_id);

CREATE TABLE gallery_weeks (
    week        date         PRIMARY KEY,
    awarded_at  timestamptz  NOT NULL DEFAULT now(),
    winners     jsonb        NOT NULL DEFAULT '[]'::jsonb
);
