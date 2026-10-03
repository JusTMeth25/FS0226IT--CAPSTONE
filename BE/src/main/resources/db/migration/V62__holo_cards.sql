-- Carte olografiche come versioni a se' (HoloCardService): una carta "<codice>-holo" con prezzo
-- triplo, invece di un contatore di copie lucide dentro la carta normale (user_cards.foil_count).
-- Le versioni olografiche restano fuori dal catalogo (pacchetti, raccoglitore, set, conteggi).

ALTER TABLE cards ADD COLUMN holo boolean NOT NULL DEFAULT false;
CREATE INDEX idx_cards_holo ON cards (holo) WHERE holo;

-- Le olografiche gia' trovate: si crea la loro carta...
INSERT INTO cards (id, code, name, artist_class_id, variant, card_group, rarity, img_url, full_image,
                   fans, style, influence, energy, description, is_active, source, set_name, set_code, number,
                   metadata, holo)
SELECT gen_random_uuid(), c.code || '-holo', c.name || ' (Olografica)', c.artist_class_id, c.variant, c.card_group,
       c.rarity, c.img_url, c.full_image, c.fans, c.style, c.influence, c.energy, c.description, true, c.source,
       c.set_name, c.set_code, c.number,
       COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('holo', true, 'baseCode', c.code)
           || CASE WHEN (c.metadata ->> 'marketPrice') IS NULL THEN '{}'::jsonb
                   ELSE jsonb_build_object('marketPrice', round(((c.metadata ->> 'marketPrice')::numeric) * 3, 2)) END,
       true
FROM cards c
WHERE c.id IN (SELECT card_id FROM user_cards WHERE foil_count > 0)
ON CONFLICT (code) DO NOTHING;

-- ...le copie olografiche passano alla nuova carta...
INSERT INTO user_cards (id, user_id, card_id, obtained_at, is_favorite, quantity, battles_used, foil_count)
SELECT gen_random_uuid(), uc.user_id, h.id, uc.obtained_at, false, uc.foil_count, 0, 0
FROM user_cards uc
JOIN cards c ON c.id = uc.card_id
JOIN cards h ON h.code = c.code || '-holo'
WHERE uc.foil_count > 0
ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = user_cards.quantity + EXCLUDED.quantity;

-- ...e la carta normale tiene solo le copie normali.
UPDATE user_cards SET quantity = quantity - foil_count, foil_count = 0 WHERE foil_count > 0;
