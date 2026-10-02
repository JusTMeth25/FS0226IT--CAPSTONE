-- Carte NBA (NbaImporter, elenco curato in resources/nba/cards.json): pacchetto dedicato come
-- quelli di V53/V54. Pesca solo le carte della fonte "nba": 5 carte, 1 Rara garantita.

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0057-010000000000', 'pack-nba', 'Pacchetto NBA', '5 carte NBA (Prizm, Optic, Chrome, Downtown...) con 1 Rara garantita.', 100, 5, false, 0, NULL, true, 'nba');
INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0057-010100000000', '00000000-0000-0000-0057-010000000000', 'common', 0.45),
    ('00000000-0000-0000-0057-010200000000', '00000000-0000-0000-0057-010000000000', 'uncommon', 0.30),
    ('00000000-0000-0000-0057-010300000000', '00000000-0000-0000-0057-010000000000', 'rare', 0.15),
    ('00000000-0000-0000-0057-010400000000', '00000000-0000-0000-0057-010000000000', 'epic', 0.07),
    ('00000000-0000-0000-0057-010500000000', '00000000-0000-0000-0057-010000000000', 'legendary', 0.03);
INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES ('00000000-0000-0000-0057-011100000000', '00000000-0000-0000-0057-010000000000', 'rare', 1);
