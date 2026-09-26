-- Amici dell'hotel: una richiesta (PENDING) diventa amicizia quando l'altro accetta (ACCEPTED).
-- Una riga sola per coppia: user_id e' chi ha chiesto, friend_id chi ha ricevuto.
CREATE TABLE hotel_friendships (
    id          uuid         PRIMARY KEY,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id   uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      varchar(10)  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_hotel_friendships_status CHECK (status IN ('PENDING', 'ACCEPTED')),
    CONSTRAINT ck_hotel_friendships_self CHECK (user_id <> friend_id),
    CONSTRAINT uk_hotel_friendships UNIQUE (user_id, friend_id)
);
CREATE INDEX idx_hotel_friendships_friend ON hotel_friendships(friend_id);

-- Messaggi privati fra amici: restano anche se il destinatario non e' online.
CREATE TABLE hotel_direct_messages (
    id          uuid          PRIMARY KEY,
    from_id     uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id       uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        varchar(300)  NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    read_at     timestamptz
);
CREATE INDEX idx_hotel_dm_pair ON hotel_direct_messages(from_id, to_id, created_at);
CREATE INDEX idx_hotel_dm_unread ON hotel_direct_messages(to_id) WHERE read_at IS NULL;
