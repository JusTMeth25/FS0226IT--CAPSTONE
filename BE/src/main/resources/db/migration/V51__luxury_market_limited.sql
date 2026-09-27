-- Edizioni limitate: i pezzi vinti all'asta hanno un numero di serie (da 1 a 10 per pezzo).
ALTER TABLE user_wardrobe ADD COLUMN serial smallint;

-- L'asta dell'hotel mette in palio anche capi, orologi, gioielli, chitarre e auto numerati.
ALTER TABLE hotel_auctions ALTER COLUMN card_id DROP NOT NULL;
ALTER TABLE hotel_auctions ADD COLUMN luxury_item varchar(8);
ALTER TABLE hotel_auctions ADD COLUMN serial smallint;

-- Mercato dell'usato: pezzi dei negozi messi in vendita da un giocatore agli altri.
-- Il pezzo esce dal guardaroba del venditore finche' e' in vendita.
CREATE TABLE luxury_listings (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item        varchar(8)  NOT NULL,
    serial      smallint,
    price       integer     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_luxury_listings_item ON luxury_listings (item);
