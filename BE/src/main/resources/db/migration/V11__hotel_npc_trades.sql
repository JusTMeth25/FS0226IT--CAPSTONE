-- VinylDex Hotel: scambi di carte con gli NPC.

-- Storico degli scambi con gli NPC. Serve anche al limite giornaliero: prima il conteggio stava
-- in memoria e si azzerava a ogni riavvio del backend. day e' la data del server, come in
-- user_respects. Gli NPC non sono utenti veri, quindi se ne salva solo il nome.
CREATE TABLE hotel_npc_trades (
    id           uuid         PRIMARY KEY,
    user_id      uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    npc_name     varchar(40)  NOT NULL,
    gave_card_id uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    got_card_id  uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    day          date         NOT NULL,
    created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_hotel_npc_trades_user_day ON hotel_npc_trades(user_id, day);
