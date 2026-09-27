-- Pity counter: pacchetti aperti di fila senza una leggendaria. Piu' e' alto, piu' la prossima
-- leggendaria e' probabile; al quarantesimo pacchetto e' garantita. Si azzera quando ne esce una.
ALTER TABLE users ADD COLUMN pack_pity integer NOT NULL DEFAULT 0;

-- Vendite fra giocatori (mercato e banchetti dell'hotel): il prezzo medio di ogni carta in gold.
CREATE TABLE market_sales (
    id        bigserial    PRIMARY KEY,
    card_id   uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    price     integer      NOT NULL CHECK (price > 0),
    quantity  integer      NOT NULL DEFAULT 1 CHECK (quantity > 0),
    channel   varchar(10)  NOT NULL CHECK (channel IN ('market', 'stall')),
    sold_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_sales_card ON market_sales (card_id, sold_at DESC);

-- Le vendite gia' concluse al mercato: il prezzo unitario dell'annuncio, alla sua ultima modifica.
INSERT INTO market_sales (card_id, price, quantity, channel, sold_at)
SELECT card_id, price_per_unit, 1, 'market', updated_at FROM market_listings WHERE status = 'SOLD';

-- Pacchetto del weekend: solo sabato e domenica, con due carte del set della settimana.
INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0039-010000000000', 'pack-weekend', 'Pacchetto del Weekend',
        'Solo sabato e domenica: 5 carte, 2 del set della settimana e 1 Rara garantita.', 120, 5, false, 0, NULL, true, NULL);
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0039-010100000000', '00000000-0000-0000-0039-010000000000', 'common', 0.35),
    ('00000000-0000-0000-0039-010200000000', '00000000-0000-0000-0039-010000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0039-010300000000', '00000000-0000-0000-0039-010000000000', 'rare', 0.20),
    ('00000000-0000-0000-0039-010400000000', '00000000-0000-0000-0039-010000000000', 'epic', 0.10),
    ('00000000-0000-0000-0039-010500000000', '00000000-0000-0000-0039-010000000000', 'legendary', 0.05);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES
    ('00000000-0000-0000-0039-011100000000', '00000000-0000-0000-0039-010000000000', 'rare', 1);
