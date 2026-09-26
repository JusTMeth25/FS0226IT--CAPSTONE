-- Tutorial dell'hotel: la guida si presenta solo la prima volta.
ALTER TABLE users ADD COLUMN hotel_tutorial_done boolean NOT NULL DEFAULT false;

-- Movimenti del portafoglio delle novita' dell'hotel: asta, perito, set completati, animali,
-- premi degli eventi a orario e della mostra delle collezioni.
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE', 'CARD_BUYBACK', 'MINIGAME_REWARD',
    'AUCTION', 'GRADING', 'SET_REWARD', 'PET', 'EVENT_REWARD', 'GALLERY_REWARD'));

-- Missioni giornaliere dell'hotel. hotel_minigame conta le partite finite con almeno minScore
-- punti al gioco indicato (senza gioco: qualunque minigioco; "golf" vale per tutte le buche);
-- hotel_goal conta i gol segnati allo stadio.
INSERT INTO missions (id, code, title, description, type, target_value, reward_gold, reward_xp, is_daily, is_active, metadata)
VALUES
    (gen_random_uuid(), 'hotel-daily-goals', 'Bomber dell''hotel', 'Segna 2 gol allo Stadio.',
     'hotel_goal', 2, 60, 40, true, true, NULL),
    (gen_random_uuid(), 'hotel-daily-bowling', 'Serata al bowling', 'Chiudi una partita di bowling con almeno 40 punti.',
     'hotel_minigame', 1, 60, 40, true, true, '{"game": "bowling", "minScore": 40}'),
    (gen_random_uuid(), 'hotel-daily-basket', 'Tiratore scelto', 'Fai almeno 10 punti ai tiri liberi del Palazzetto.',
     'hotel_minigame', 1, 50, 30, true, true, '{"game": "basket", "minScore": 10}'),
    (gen_random_uuid(), 'hotel-daily-golf', 'Buca da campioni', 'Fai una buca del minigolf con almeno 4 punti (tre colpi o meno).',
     'hotel_minigame', 1, 50, 30, true, true, '{"game": "golf", "minScore": 4}'),
    (gen_random_uuid(), 'hotel-daily-games', 'Giocatore dell''hotel', 'Gioca 3 partite ai minigiochi dell''hotel.',
     'hotel_minigame', 3, 40, 25, true, true, '{"minScore": 0}');
