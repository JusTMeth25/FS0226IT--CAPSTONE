-- Incarichi degli NPC dell'hotel: ogni giorno tre richieste ("portami una carta rara di One Piece").
-- Qui si segna chi le ha gia' consegnate, con la carta data.
CREATE TABLE hotel_quest_done (
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day         date         NOT NULL,
    quest       smallint     NOT NULL,
    card_id     uuid         REFERENCES cards(id) ON DELETE SET NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day, quest)
);
