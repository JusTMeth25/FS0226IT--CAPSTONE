-- Pacchetti di un solo gioco, come il Pacchetto Ultimate Team: pescano solo carte di quella fonte
-- (packs.source, vedi V15). 5 carte, 1 Rara garantita, stesse probabilita' per tutti. Se una
-- rarita' manca nel catalogo di quella fonte, PackGenerator ripiega su un'altra carta della fonte.
--
-- Rimosse del tutto le carte originali di Carlos Santana e Michael Jackson, con collezioni,
-- mercato, scambi, album, vetrine e storico aperture che le contenevano.

DELETE FROM market_listings WHERE card_id IN (SELECT id FROM cards WHERE code IN ('virtuoso-000', 'showman-extra-001'));
DELETE FROM trade_items WHERE card_id IN (SELECT id FROM cards WHERE code IN ('virtuoso-000', 'showman-extra-001'));
DELETE FROM album_cards WHERE card_id IN (SELECT id FROM cards WHERE code IN ('virtuoso-000', 'showman-extra-001'));
DELETE FROM pack_opening_cards WHERE card_id IN (SELECT id FROM cards WHERE code IN ('virtuoso-000', 'showman-extra-001'));
DELETE FROM user_cards WHERE card_id IN (SELECT id FROM cards WHERE code IN ('virtuoso-000', 'showman-extra-001'));
-- room_items (SET NULL) e hotel_npc_trades (CASCADE) si sistemano da soli con la cancellazione.
DELETE FROM cards WHERE code IN ('virtuoso-000', 'showman-extra-001');

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-010000000000', 'pack-pokemon', 'Pacchetto Pokémon', '5 carte solo Pokémon con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'pokemon');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-010100000000', '00000000-0000-0000-0016-010000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-010200000000', '00000000-0000-0000-0016-010000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-010300000000', '00000000-0000-0000-0016-010000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-010400000000', '00000000-0000-0000-0016-010000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-010500000000', '00000000-0000-0000-0016-010000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-011100000000', '00000000-0000-0000-0016-010000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-020000000000', 'pack-yugioh', 'Pacchetto Yu-Gi-Oh!', '5 carte solo Yu-Gi-Oh! con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'yugioh');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-020100000000', '00000000-0000-0000-0016-020000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-020200000000', '00000000-0000-0000-0016-020000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-020300000000', '00000000-0000-0000-0016-020000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-020400000000', '00000000-0000-0000-0016-020000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-020500000000', '00000000-0000-0000-0016-020000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-021100000000', '00000000-0000-0000-0016-020000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-030000000000', 'pack-scryfall', 'Pacchetto Magic', '5 carte solo Magic con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'scryfall');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-030100000000', '00000000-0000-0000-0016-030000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-030200000000', '00000000-0000-0000-0016-030000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-030300000000', '00000000-0000-0000-0016-030000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-030400000000', '00000000-0000-0000-0016-030000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-030500000000', '00000000-0000-0000-0016-030000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-031100000000', '00000000-0000-0000-0016-030000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-040000000000', 'pack-onepiece', 'Pacchetto One Piece', '5 carte solo One Piece con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'onepiece');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-040100000000', '00000000-0000-0000-0016-040000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-040200000000', '00000000-0000-0000-0016-040000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-040300000000', '00000000-0000-0000-0016-040000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-040400000000', '00000000-0000-0000-0016-040000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-040500000000', '00000000-0000-0000-0016-040000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-041100000000', '00000000-0000-0000-0016-040000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-050000000000', 'pack-dragonball', 'Pacchetto Dragon Ball', '5 carte solo Dragon Ball con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'dragonball');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-050100000000', '00000000-0000-0000-0016-050000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-050200000000', '00000000-0000-0000-0016-050000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-050300000000', '00000000-0000-0000-0016-050000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-050400000000', '00000000-0000-0000-0016-050000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-050500000000', '00000000-0000-0000-0016-050000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-051100000000', '00000000-0000-0000-0016-050000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-060000000000', 'pack-digimon', 'Pacchetto Digimon', '5 carte solo Digimon con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'digimon');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-060100000000', '00000000-0000-0000-0016-060000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-060200000000', '00000000-0000-0000-0016-060000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-060300000000', '00000000-0000-0000-0016-060000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-060400000000', '00000000-0000-0000-0016-060000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-060500000000', '00000000-0000-0000-0016-060000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-061100000000', '00000000-0000-0000-0016-060000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-070000000000', 'pack-lorcana', 'Pacchetto Lorcana', '5 carte solo Lorcana con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'lorcana');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-070100000000', '00000000-0000-0000-0016-070000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-070200000000', '00000000-0000-0000-0016-070000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-070300000000', '00000000-0000-0000-0016-070000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-070400000000', '00000000-0000-0000-0016-070000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-070500000000', '00000000-0000-0000-0016-070000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-071100000000', '00000000-0000-0000-0016-070000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-080000000000', 'pack-riftbound', 'Pacchetto Riftbound', '5 carte solo Riftbound con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'riftbound');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-080100000000', '00000000-0000-0000-0016-080000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-080200000000', '00000000-0000-0000-0016-080000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-080300000000', '00000000-0000-0000-0016-080000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-080400000000', '00000000-0000-0000-0016-080000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-080500000000', '00000000-0000-0000-0016-080000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-081100000000', '00000000-0000-0000-0016-080000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-090000000000', 'pack-gundam', 'Pacchetto Gundam', '5 carte solo Gundam con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'gundam');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-090100000000', '00000000-0000-0000-0016-090000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-090200000000', '00000000-0000-0000-0016-090000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-090300000000', '00000000-0000-0000-0016-090000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-090400000000', '00000000-0000-0000-0016-090000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-090500000000', '00000000-0000-0000-0016-090000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-091100000000', '00000000-0000-0000-0016-090000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0016-100000000000', 'pack-original', 'Pacchetto VinylDex Originali', '5 carte solo VinylDex Originali con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'original');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0016-100100000000', '00000000-0000-0000-0016-100000000000', 'common', 0.45),
    ('00000000-0000-0000-0016-100200000000', '00000000-0000-0000-0016-100000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0016-100300000000', '00000000-0000-0000-0016-100000000000', 'rare', 0.15),
    ('00000000-0000-0000-0016-100400000000', '00000000-0000-0000-0016-100000000000', 'epic', 0.07),
    ('00000000-0000-0000-0016-100500000000', '00000000-0000-0000-0016-100000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0016-101100000000', '00000000-0000-0000-0016-100000000000', 'rare', 1);
