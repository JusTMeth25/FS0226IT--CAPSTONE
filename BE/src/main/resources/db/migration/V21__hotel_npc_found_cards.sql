-- Carte trovate dagli NPC nei pacchetti aperti nell'hotel: stanno nella loro vetrina degli scambi.
-- Prima erano in memoria e sparivano a ogni riavvio del backend. npc_id e' l'id stabile dell'NPC
-- (NpcRoster.NpcSpec.id): gli NPC non sono utenti veri, quindi niente chiave esterna.
CREATE TABLE hotel_npc_found_cards (
    id        uuid         PRIMARY KEY,
    npc_id    uuid         NOT NULL,
    card_id   uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    found_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uk_hotel_npc_found_cards UNIQUE (npc_id, card_id)
);

CREATE INDEX idx_hotel_npc_found_cards_npc ON hotel_npc_found_cards(npc_id, found_at DESC);
