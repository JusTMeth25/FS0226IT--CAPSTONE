-- Regali per posta: oltre a gold e carte anche un mobile della borsa.
ALTER TABLE hotel_mail ADD COLUMN furni_item_id uuid REFERENCES room_items(id) ON DELETE SET NULL;

-- Classifiche per gioco: chi ha piu' carte di un gioco a fine settimana vince un premio.
-- Una riga per settimana e gioco: il premio si paga una volta sola anche se il job riparte.
CREATE TABLE leaderboard_prizes (
    week        date         NOT NULL,
    source      varchar(40)  NOT NULL,
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cards       integer      NOT NULL,
    gold        integer      NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (week, source)
);
