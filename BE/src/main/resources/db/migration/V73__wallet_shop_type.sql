-- Causale dei gold spesi in Tabaccheria, al Green Shop e dal tipo losco della discoteca (SmokeShop).
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD',
    'AUCTION', 'GRADING', 'SET_REWARD', 'PET', 'EVENT_REWARD', 'GALLERY_REWARD',
    'DAILY_CARD', 'CLUB', 'PARTY', 'STALL', 'MAIL', 'TOURNAMENT', 'SEASON_REWARD', 'LUXURY', 'CASINO', 'SHOP'));
