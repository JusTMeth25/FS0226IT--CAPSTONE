-- Set da completare: quando un giocatore ha tutte le carte di un set ritira il premio una volta
-- sola e ottiene il distintivo del set (nel profilo e nella scheda dell'hotel).
CREATE TABLE user_set_rewards (
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    set_key     varchar(60)  NOT NULL,
    claimed_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, set_key)
);
