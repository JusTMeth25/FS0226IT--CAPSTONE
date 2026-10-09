-- Borsa di Wall Street: azioni dei giochi di carte e delle carte piu' preziose. La quotazione
-- segue i prezzi veri delle carte (il "fondamentale") e oscilla col mercato; i giocatori comprano e
-- vendono con i gold.

-- Titoli quotati: il coefficiente k lega la quotazione al fondamentale (prezzo medio delle carte).
CREATE TABLE stocks
(
    symbol      varchar(10) PRIMARY KEY,
    name        varchar(80)    NOT NULL,
    k           numeric(18, 8) NOT NULL,
    price       numeric(12, 2) NOT NULL,
    listed_at   timestamptz    NOT NULL DEFAULT now()
);

-- Quotazioni nel tempo (una al minuto, tenute una settimana) per i grafici.
CREATE TABLE stock_prices
(
    symbol varchar(10)    NOT NULL REFERENCES stocks (symbol) ON DELETE CASCADE,
    at     timestamptz    NOT NULL,
    price  numeric(12, 2) NOT NULL,
    PRIMARY KEY (symbol, at)
);

-- Azioni possedute: quante e quanto sono costate in tutto (per il guadagno o la perdita).
CREATE TABLE user_stocks
(
    user_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol  varchar(10) NOT NULL REFERENCES stocks (symbol) ON DELETE CASCADE,
    shares  integer     NOT NULL CHECK (shares >= 0),
    cost    bigint      NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, symbol)
);

-- Causale dei gold spesi e incassati in borsa.
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD',
    'AUCTION', 'GRADING', 'SET_REWARD', 'PET', 'EVENT_REWARD', 'GALLERY_REWARD',
    'DAILY_CARD', 'CLUB', 'PARTY', 'STALL', 'MAIL', 'TOURNAMENT', 'SEASON_REWARD', 'LUXURY', 'CASINO', 'SHOP', 'STOCK'));
