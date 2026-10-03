-- Pacchetti delle Court Legends (V60): pescano solo le carte VinylDex di basket. La fonte
-- "original/Court Legends" vuol dire carte originali del gruppo Court Legends (vedi PackGenerator).

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0061-010000000000', 'pack-court', 'Pacchetto Court Legends', '5 carte solo Court Legends con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'original/Court Legends');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0061-010100000000', '00000000-0000-0000-0061-010000000000', 'common', 0.45),
    ('00000000-0000-0000-0061-010200000000', '00000000-0000-0000-0061-010000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0061-010300000000', '00000000-0000-0000-0061-010000000000', 'rare', 0.15),
    ('00000000-0000-0000-0061-010400000000', '00000000-0000-0000-0061-010000000000', 'epic', 0.07),
    ('00000000-0000-0000-0061-010500000000', '00000000-0000-0000-0061-010000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0061-011100000000', '00000000-0000-0000-0061-010000000000', 'rare', 1);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0061-020000000000', 'pack-court-mvp', 'Court Legends MVP', '5 carte solo Court Legends con 1 Leggendaria garantita.', 300, 5, false, 0, NULL, true, 'original/Court Legends');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0061-020100000000', '00000000-0000-0000-0061-020000000000', 'common', 0.20),
    ('00000000-0000-0000-0061-020200000000', '00000000-0000-0000-0061-020000000000', 'uncommon', 0.25),
    ('00000000-0000-0000-0061-020300000000', '00000000-0000-0000-0061-020000000000', 'rare', 0.25),
    ('00000000-0000-0000-0061-020400000000', '00000000-0000-0000-0061-020000000000', 'epic', 0.20),
    ('00000000-0000-0000-0061-020500000000', '00000000-0000-0000-0061-020000000000', 'legendary', 0.10);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES
    ('00000000-0000-0000-0061-021100000000', '00000000-0000-0000-0061-020000000000', 'rare', 1),
    ('00000000-0000-0000-0061-021200000000', '00000000-0000-0000-0061-020000000000', 'legendary', 1);
