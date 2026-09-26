-- Carte EA FC 27 Ultimate Team: un pacchetto dedicato che pesca solo le carte di quella fonte.
-- packs.source vuoto vuol dire "tutte le carte", come i pacchetti di prima.
ALTER TABLE packs ADD COLUMN source varchar(40);

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free, free_cooldown_hours, img_url, is_active, source)
VALUES ('00000000-0000-0000-0000-0000000fc027', 'pack-ultimate', 'Pacchetto Ultimate Team',
        '6 carte EA FC 27 con 1 Rara garantita: giocatori, giocatrici e icone di Ultimate Team.',
        150, 6, false, 0, NULL, true, 'fc27');

INSERT INTO pack_drop_rates (id, pack_id, rarity, weight) VALUES
    ('00000000-0000-0000-0000-00000fc02701', '00000000-0000-0000-0000-0000000fc027', 'common', 0.35),
    ('00000000-0000-0000-0000-00000fc02702', '00000000-0000-0000-0000-0000000fc027', 'uncommon', 0.30),
    ('00000000-0000-0000-0000-00000fc02703', '00000000-0000-0000-0000-0000000fc027', 'rare', 0.20),
    ('00000000-0000-0000-0000-00000fc02704', '00000000-0000-0000-0000-0000000fc027', 'epic', 0.11),
    ('00000000-0000-0000-0000-00000fc02705', '00000000-0000-0000-0000-0000000fc027', 'legendary', 0.04);

INSERT INTO pack_guarantees (id, pack_id, rarity, count) VALUES
    ('00000000-0000-0000-0000-00000fc02711', '00000000-0000-0000-0000-0000000fc027', 'rare', 1);
