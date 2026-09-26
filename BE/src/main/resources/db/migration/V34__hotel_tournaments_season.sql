-- Tornei a eliminazione (bowling o biliardo, fino a otto giocatori) e stagione sportiva mensile.

CREATE TABLE tournaments (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    game        varchar(20)  NOT NULL,
    status      varchar(10)  NOT NULL DEFAULT 'SIGNUP',
    round       integer      NOT NULL DEFAULT 0,
    signup_ends timestamptz  NOT NULL,
    winner_id   uuid         REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    ended_at    timestamptz,
    CONSTRAINT ck_tournaments_status CHECK (status IN ('SIGNUP', 'RUNNING', 'DONE', 'CANCELLED'))
);

CREATE TABLE tournament_players (
    tournament_id uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username      varchar(50) NOT NULL,
    joined_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, user_id)
);

-- Un incontro del tabellone: turno, posizione, i due giocatori (b null = passa il turno), punteggi.
CREATE TABLE tournament_matches (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round         integer     NOT NULL,
    slot          integer     NOT NULL,
    a_id          uuid        REFERENCES users(id) ON DELETE SET NULL,
    b_id          uuid        REFERENCES users(id) ON DELETE SET NULL,
    a_score       integer,
    b_score       integer,
    winner_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
    deadline      timestamptz NOT NULL,
    UNIQUE (tournament_id, round, slot)
);

-- Stagione sportiva: punti del mese da tutti gli sport dell'hotel.
CREATE TABLE season_points (
    season      varchar(7)   NOT NULL,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username    varchar(50)  NOT NULL,
    points      integer      NOT NULL DEFAULT 0,
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (season, user_id)
);

CREATE INDEX idx_season_points_rank ON season_points (season, points DESC);

CREATE TABLE seasons_awarded (
    season      varchar(7)   PRIMARY KEY,
    awarded_at  timestamptz  NOT NULL DEFAULT now(),
    winners     jsonb        NOT NULL DEFAULT '[]'::jsonb
);
