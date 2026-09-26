-- Carte: copie olografiche, carta del giorno, storico dei prezzi. E le causali dei gold per le
-- funzioni nuove (carta del giorno, club, feste, banchetti, posta, tornei, stagione sportiva).
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD',
    'AUCTION', 'GRADING', 'SET_REWARD', 'PET', 'EVENT_REWARD', 'GALLERY_REWARD',
    'DAILY_CARD', 'CLUB', 'PARTY', 'STALL', 'MAIL', 'TOURNAMENT', 'SEASON_REWARD'));

-- Quante delle copie possedute sono olografiche (trovate nei pacchetti, piu' rare).
ALTER TABLE user_cards ADD COLUMN foil_count integer NOT NULL DEFAULT 0;
ALTER TABLE user_cards ADD CONSTRAINT ck_user_cards_foil CHECK (foil_count >= 0 AND foil_count <= quantity);

-- Carta del giorno: la sfida (vincere una battaglia con quella carta) si premia una volta al giorno.
CREATE TABLE daily_card_claims (
    user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day         date         NOT NULL,
    card_id     uuid         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    claimed_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);

-- Valore di mercato di ogni carta giorno per giorno (per il grafico nel dettaglio carta).
CREATE TABLE card_price_history (
    card_id  uuid           NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    day      date           NOT NULL,
    price    numeric(12, 2) NOT NULL,
    PRIMARY KEY (card_id, day)
);

-- Il primo punto del grafico: il valore di oggi.
INSERT INTO card_price_history (card_id, day, price)
SELECT id, CURRENT_DATE, (metadata ->> 'marketPrice')::numeric
FROM cards
WHERE is_active AND metadata ->> 'marketPrice' ~ '^[0-9]+(\.[0-9]+)?$' AND (metadata ->> 'marketPrice')::numeric > 0
ON CONFLICT DO NOTHING;
