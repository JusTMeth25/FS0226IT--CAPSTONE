-- Casino dell'hotel (stanza nella V67): le fiches dei giocatori, il giorno dell'ultimo regalo di
-- fiches e la causale dei movimenti di gold fatti al casino (cassa, puntate e vincite in gold).
ALTER TABLE users ADD COLUMN casino_chips INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN casino_bonus_day DATE;
ALTER TABLE users ADD CONSTRAINT ck_users_casino_chips CHECK (casino_chips >= 0);

ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD',
    'AUCTION', 'GRADING', 'SET_REWARD', 'PET', 'EVENT_REWARD', 'GALLERY_REWARD',
    'DAILY_CARD', 'CLUB', 'PARTY', 'STALL', 'MAIL', 'TOURNAMENT', 'SEASON_REWARD', 'LUXURY', 'CASINO'));
