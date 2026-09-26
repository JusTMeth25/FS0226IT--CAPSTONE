-- Hotel: club con la loro stanza, feste nelle stanze, banchetti per vendere carte, foto
-- dell'hotel nel profilo, posta fra amici (gold e carte, anche offline).

CREATE TABLE clubs (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(30)  NOT NULL UNIQUE,
    tag         varchar(4)   NOT NULL UNIQUE,
    color       varchar(7)   NOT NULL,
    icon        varchar(30)  NOT NULL,
    motto       varchar(120),
    owner_id    uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id     uuid         REFERENCES rooms(id) ON DELETE SET NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE club_members (
    user_id    uuid         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    club_id    uuid         NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    role       varchar(10)  NOT NULL DEFAULT 'MEMBER',
    joined_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_club_members_role CHECK (role IN ('OWNER', 'MEMBER'))
);

CREATE INDEX idx_club_members_club ON club_members (club_id);

CREATE TABLE room_parties (
    room_id     uuid         PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    host_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       varchar(60)  NOT NULL,
    starts_at   timestamptz  NOT NULL DEFAULT now(),
    ends_at     timestamptz  NOT NULL
);

-- XP della festa gia' dati a ogni ospite (al massimo uno ogni cinque minuti, sei per festa).
CREATE TABLE party_guests (
    room_id     uuid         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rewards     integer      NOT NULL DEFAULT 0,
    last_at     timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

-- Carte in vendita sul banchetto di una stanza (il mobile card_stall).
CREATE TABLE stall_items (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     uuid         NOT NULL REFERENCES room_items(id) ON DELETE CASCADE,
    seller_id   uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id     uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    price       integer      NOT NULL CHECK (price BETWEEN 1 AND 100000),
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_stall_items_item ON stall_items (item_id);

-- Foto scattate nell'hotel (JPEG ridotto, come data URL): al massimo dodici per giocatore.
CREATE TABLE user_photos (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_name   varchar(80),
    image       text         NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_photos_user ON user_photos (user_id, created_at DESC);

-- Posta: gold e/o una carta con un biglietto. Il mittente paga subito, chi riceve ritira quando vuole.
CREATE TABLE hotel_mail (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id     uuid         REFERENCES users(id) ON DELETE SET NULL,
    to_id       uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gold        integer      NOT NULL DEFAULT 0 CHECK (gold >= 0),
    card_id     uuid         REFERENCES cards(id) ON DELETE SET NULL,
    note        varchar(200),
    created_at  timestamptz  NOT NULL DEFAULT now(),
    claimed_at  timestamptz
);

CREATE INDEX idx_hotel_mail_to ON hotel_mail (to_id, claimed_at);
