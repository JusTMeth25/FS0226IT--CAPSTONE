-- Versione alternativa di Eternal Empress, in stile realistico: e' anche lei una carta ultimate
-- (codice legendary-ultimate-*), con il suo tiro a parte da una su un miliardo in PackGenerator,
-- le stesse statistiche e lo stesso prezzo di mercato fisso della carta di V80.

INSERT INTO cards (id, code, name, artist_class_id, variant, rarity, img_url, full_image,
                   fans, style, influence, energy, description, is_active, source, metadata)
SELECT gen_random_uuid(), 'legendary-ultimate-002', 'Eternal Empress', (SELECT id FROM artist_classes WHERE slug = 'the-absolute'),
       'Eternal Empress Realistic', 'legendary', '/assets/img/EternalEmpressRealistic.webp', true,
       2500, 2500, 2500, 2499,
       'La regina definitiva di VinylDex. Capelli rossi fiammeggianti, occhi verdi smeraldo e una presenza magnetica impossibile da ignorare. Elegante, potente e seducente, domina il palco con uno stile leggendario e un carisma fuori scala.',
       true, 'original', jsonb_build_object('marketPrice', 50000000, 'ultimate', true)
WHERE NOT EXISTS (SELECT 1 FROM cards WHERE code = 'legendary-ultimate-002');
