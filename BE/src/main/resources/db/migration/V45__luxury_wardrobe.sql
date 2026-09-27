-- Guardaroba di lusso del quartiere: capi firmati, orologi e veicoli comprati nei negozi.
-- Ogni riga e' un pezzo posseduto, con la chiave del catalogo (LuxuryCatalog): "o3" e' il terzo
-- abito, "w2" il secondo orologio, "r5" il quinto veicolo. Il codice aspetto li indossa.
CREATE TABLE user_wardrobe (
    user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item      varchar(8)  NOT NULL,
    bought_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, item)
);

-- Causale dei gold per gli acquisti nei negozi del quartiere.
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD',
    'AUCTION', 'GRADING', 'SET_REWARD', 'PET', 'EVENT_REWARD', 'GALLERY_REWARD',
    'DAILY_CARD', 'CLUB', 'PARTY', 'STALL', 'MAIL', 'TOURNAMENT', 'SEASON_REWARD', 'LUXURY'));
