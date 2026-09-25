-- Quante volte ogni carta e' scesa in campo, nelle battaglie del sito e nelle sfide dell'hotel:
-- sopra l'avatar si mostrano le tre carte piu' usate.
ALTER TABLE user_cards ADD COLUMN battles_used integer NOT NULL DEFAULT 0;

-- Il negozio dell'hotel ricompra le carte che hanno un prezzo di mercato, pagandole in gold.
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK'));
