-- Eternal Empress: la carta piu' rara di VinylDex. Esce da un pacchetto con probabilita'
-- 0,0000001% (PackGenerator.ULTIMATE_CHANCE) e non compare in nessun'altra estrazione casuale
-- (carta del giorno, pesca, aste, fusione, NPC). Prezzo di mercato fisso: 50 milioni di dollari.

INSERT INTO artist_classes (id, name, slug) VALUES (gen_random_uuid(), 'The Absolute', 'the-absolute')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO cards (id, code, name, artist_class_id, variant, rarity, img_url, full_image,
                   fans, style, influence, energy, description, is_active, source, metadata)
SELECT gen_random_uuid(), 'legendary-ultimate-001', 'Eternal Empress', (SELECT id FROM artist_classes WHERE slug = 'the-absolute'),
       'Eternal Empress', 'legendary', '/assets/img/EternalEmpress.webp', true,
       2500, 2500, 2500, 2499,
       'La regina definitiva di VinylDex. Capelli rossi fiammeggianti, occhi verdi smeraldo e una presenza magnetica impossibile da ignorare. Elegante, potente e seducente, domina il palco con uno stile leggendario e un carisma fuori scala.',
       true, 'original', jsonb_build_object('marketPrice', 50000000, 'ultimate', true)
WHERE NOT EXISTS (SELECT 1 FROM cards WHERE code = 'legendary-ultimate-001');
