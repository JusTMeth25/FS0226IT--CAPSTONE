-- GODDESS OF VICTORY: NIKKE (Union Arena): pacchetto dedicato come quelli di V16. Pesca solo le
-- carte della fonte "nikke" (NikkeImporter, dal catalogo TCGplayer via tcgcsv.com): 5 carte,
-- 1 Rara garantita, stesse probabilita' degli altri pacchetti di un solo gioco.

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0053-010000000000', 'pack-nikke', 'Pacchetto NIKKE', '5 carte solo GODDESS OF VICTORY: NIKKE con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'nikke');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0053-010100000000', '00000000-0000-0000-0053-010000000000', 'common', 0.45),
    ('00000000-0000-0000-0053-010200000000', '00000000-0000-0000-0053-010000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0053-010300000000', '00000000-0000-0000-0053-010000000000', 'rare', 0.15),
    ('00000000-0000-0000-0053-010400000000', '00000000-0000-0000-0053-010000000000', 'epic', 0.07),
    ('00000000-0000-0000-0053-010500000000', '00000000-0000-0000-0053-010000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0053-011100000000', '00000000-0000-0000-0053-010000000000', 'rare', 1);
