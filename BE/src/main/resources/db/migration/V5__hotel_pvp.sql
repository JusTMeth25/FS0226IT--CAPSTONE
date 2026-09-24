-- VinylDex Hotel, tappa 4: sfide fra giocatori.

-- Storico delle partite. Serve anche a limitare le ricompense: un numero massimo di partite
-- premiate al giorno, e ancora meno contro lo stesso avversario, cosi' due amici non possono
-- farsi punti a vicenda giocando all'infinito.
CREATE TABLE pvp_matches (
    id           uuid         PRIMARY KEY,
    player_a_id  uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_b_id  uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    winner_id    uuid         REFERENCES users(id) ON DELETE SET NULL,
    score_a      integer      NOT NULL DEFAULT 0,
    score_b      integer      NOT NULL DEFAULT 0,
    ended_by     varchar(20)  NOT NULL,
    rounds       jsonb,
    rewarded_a   boolean      NOT NULL DEFAULT false,
    rewarded_b   boolean      NOT NULL DEFAULT false,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_pvp_matches_ended_by CHECK (ended_by IN ('complete', 'forfeit'))
);

CREATE INDEX idx_pvp_matches_a ON pvp_matches(player_a_id, created_at);
CREATE INDEX idx_pvp_matches_b ON pvp_matches(player_b_id, created_at);
