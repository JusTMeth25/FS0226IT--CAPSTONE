-- Eventi a orario dell'hotel (torneo di calcio, gare di bowling e basket): punteggi per edizione
-- e premi gia' consegnati, cosi' un riavvio non paga due volte.
CREATE TABLE hotel_event_scores (
    event_key   varchar(40)  NOT NULL,
    edition     date         NOT NULL,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username    varchar(50)  NOT NULL,
    score       integer      NOT NULL DEFAULT 0,
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (event_key, edition, user_id)
);

CREATE INDEX idx_hotel_event_scores_board ON hotel_event_scores (event_key, edition, score DESC);

CREATE TABLE hotel_event_editions (
    event_key   varchar(40)  NOT NULL,
    edition     date         NOT NULL,
    awarded_at  timestamptz  NOT NULL DEFAULT now(),
    winners     jsonb        NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (event_key, edition)
);
