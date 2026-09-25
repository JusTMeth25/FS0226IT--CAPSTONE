-- Premi in gold per i record dei minigiochi dell'hotel (MinigameRewardService).
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD'));
