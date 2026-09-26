-- Asta dell'hotel: il banditore mette all'asta una carta alla volta. L'offerta piu' alta tiene
-- bloccati i gold dell'offerente (restituiti se qualcuno rilancia); alla chiusura la carta va a lui.
CREATE TABLE hotel_auctions (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id      uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    start_bid    integer      NOT NULL,
    current_bid  integer,
    bidder_id    uuid         REFERENCES users(id) ON DELETE SET NULL,
    bidder_name  varchar(50),
    bids         integer      NOT NULL DEFAULT 0,
    starts_at    timestamptz  NOT NULL DEFAULT now(),
    ends_at      timestamptz  NOT NULL,
    status       varchar(10)  NOT NULL DEFAULT 'OPEN',
    CONSTRAINT ck_hotel_auctions_status CHECK (status IN ('OPEN', 'SOLD', 'UNSOLD'))
);

CREATE INDEX idx_hotel_auctions_status ON hotel_auctions (status, ends_at);
