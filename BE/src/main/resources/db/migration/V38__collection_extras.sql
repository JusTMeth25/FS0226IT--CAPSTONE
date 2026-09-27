-- Lista dei desideri: le carte che un giocatore cerca. Il sito avvisa quando una compare
-- al mercato, sul banchetto di un giocatore o nella vetrina di un NPC.
CREATE TABLE user_wishlist (
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id     uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, card_id)
);

-- Squadre da battaglia salvate con un nome (al massimo tre per giocatore).
-- cards: i codici delle tre carte separati da virgola, nell'ordine della squadra.
CREATE TABLE user_battle_teams (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        varchar(40)  NOT NULL,
    cards       text         NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_battle_teams_user ON user_battle_teams (user_id, created_at);

-- Prima edizione: i primi dieci giocatori che trovano una carta ne hanno una copia numerata
-- (#1/10 ... #10/10), che vale di piu'. Il numero resta anche vendendo la carta.
CREATE TABLE card_first_editions (
    card_id     uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    serial      smallint     NOT NULL CHECK (serial BETWEEN 1 AND 10),
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, serial),
    CONSTRAINT uk_card_first_editions_user UNIQUE (card_id, user_id)
);

CREATE INDEX idx_card_first_editions_user ON card_first_editions (user_id);

-- Chi aveva gia' le carte prima di questa versione: numeri in ordine di arrivo.
INSERT INTO card_first_editions (card_id, serial, user_id, created_at)
SELECT card_id, serial, user_id, obtained_at
FROM (
    SELECT card_id, user_id, obtained_at,
           ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY obtained_at, user_id) AS serial
    FROM user_cards
) ranked
WHERE serial <= 10;
