-- Pacchetti dei giochi importati dal catalogo TCGplayer (TcgcsvImporter), come quelli di V16 e V53:
-- 5 carte di un solo gioco, 1 Rara garantita, stesse probabilita' per tutti.

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-010000000000', 'pack-cyberpunk', 'Pacchetto Cyberpunk', '5 carte solo Cyberpunk TCG con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'cyberpunk');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-010100000000', '00000000-0000-0000-0054-010000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-010200000000', '00000000-0000-0000-0054-010000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-010300000000', '00000000-0000-0000-0054-010000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-010400000000', '00000000-0000-0000-0054-010000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-010500000000', '00000000-0000-0000-0054-010000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-011100000000', '00000000-0000-0000-0054-010000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-020000000000', 'pack-hololive', 'Pacchetto hololive', '5 carte solo hololive OFFICIAL CARD GAME con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'hololive');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-020100000000', '00000000-0000-0000-0054-020000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-020200000000', '00000000-0000-0000-0054-020000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-020300000000', '00000000-0000-0000-0054-020000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-020400000000', '00000000-0000-0000-0054-020000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-020500000000', '00000000-0000-0000-0054-020000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-021100000000', '00000000-0000-0000-0054-020000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-030000000000', 'pack-unionarena', 'Pacchetto Union Arena', '5 carte solo Union Arena (anime) con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'unionarena');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-030100000000', '00000000-0000-0000-0054-030000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-030200000000', '00000000-0000-0000-0054-030000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-030300000000', '00000000-0000-0000-0054-030000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-030400000000', '00000000-0000-0000-0054-030000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-030500000000', '00000000-0000-0000-0054-030000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-031100000000', '00000000-0000-0000-0054-030000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-040000000000', 'pack-shadowverse', 'Pacchetto Shadowverse', '5 carte solo Shadowverse: Evolve con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'shadowverse');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-040100000000', '00000000-0000-0000-0054-040000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-040200000000', '00000000-0000-0000-0054-040000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-040300000000', '00000000-0000-0000-0054-040000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-040400000000', '00000000-0000-0000-0054-040000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-040500000000', '00000000-0000-0000-0054-040000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-041100000000', '00000000-0000-0000-0054-040000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-050000000000', 'pack-wixoss', 'Pacchetto WIXOSS', '5 carte solo WIXOSS con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'wixoss');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-050100000000', '00000000-0000-0000-0054-050000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-050200000000', '00000000-0000-0000-0054-050000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-050300000000', '00000000-0000-0000-0054-050000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-050400000000', '00000000-0000-0000-0054-050000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-050500000000', '00000000-0000-0000-0054-050000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-051100000000', '00000000-0000-0000-0054-050000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-060000000000', 'pack-grandarchive', 'Pacchetto Grand Archive', '5 carte solo Grand Archive con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'grandarchive');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-060100000000', '00000000-0000-0000-0054-060000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-060200000000', '00000000-0000-0000-0054-060000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-060300000000', '00000000-0000-0000-0054-060000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-060400000000', '00000000-0000-0000-0054-060000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-060500000000', '00000000-0000-0000-0054-060000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-061100000000', '00000000-0000-0000-0054-060000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-070000000000', 'pack-weiss', 'Pacchetto Weiss Schwarz', '5 carte solo Weiss Schwarz con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'weiss');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-070100000000', '00000000-0000-0000-0054-070000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-070200000000', '00000000-0000-0000-0054-070000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-070300000000', '00000000-0000-0000-0054-070000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-070400000000', '00000000-0000-0000-0054-070000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-070500000000', '00000000-0000-0000-0054-070000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-071100000000', '00000000-0000-0000-0054-070000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0054-080000000000', 'pack-vanguard', 'Pacchetto Vanguard', '5 carte solo Cardfight!! Vanguard con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'vanguard');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0054-080100000000', '00000000-0000-0000-0054-080000000000', 'common', 0.45),
    ('00000000-0000-0000-0054-080200000000', '00000000-0000-0000-0054-080000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0054-080300000000', '00000000-0000-0000-0054-080000000000', 'rare', 0.15),
    ('00000000-0000-0000-0054-080400000000', '00000000-0000-0000-0054-080000000000', 'epic', 0.07),
    ('00000000-0000-0000-0054-080500000000', '00000000-0000-0000-0054-080000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0054-081100000000', '00000000-0000-0000-0054-080000000000', 'rare', 1);
