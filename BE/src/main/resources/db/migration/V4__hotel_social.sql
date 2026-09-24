-- VinylDex Hotel, tappa 3: rispetto fra giocatori e "mi piace" alle stanze.

-- Rispetto, come su Habbo: ogni giocatore ne da' al massimo 3 al giorno, uno per persona.
-- day e' la data del server: il vincolo unico impedisce doppioni anche con due richieste insieme.
CREATE TABLE user_respects (
    id           uuid         PRIMARY KEY,
    giver_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id  uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day          date         NOT NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uk_user_respects_daily UNIQUE (giver_id, receiver_id, day),
    CONSTRAINT ck_user_respects_not_self CHECK (giver_id <> receiver_id)
);

CREATE INDEX idx_user_respects_receiver ON user_respects(receiver_id);
CREATE INDEX idx_user_respects_giver_day ON user_respects(giver_id, day);

-- "Mi piace" alle stanze: uno per giocatore e per stanza.
CREATE TABLE room_likes (
    id          uuid         PRIMARY KEY,
    room_id     uuid         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uk_room_likes UNIQUE (room_id, user_id)
);

CREATE INDEX idx_room_likes_room ON room_likes(room_id);
