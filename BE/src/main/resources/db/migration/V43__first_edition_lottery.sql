-- Prima edizione piu' rara: prima i primi dieci proprietari di ogni carta la ricevevano sempre, e
-- con pochi giocatori erano prime edizioni quasi tutte le carte. Ora ogni carta trovata ha una
-- piccola probabilita' (dall'1% delle comuni al 10% delle leggendarie) di essere una delle dieci
-- copie numerate. Le assegnazioni gia' fatte si rifanno con la stessa estrazione.
DELETE FROM card_first_editions;

INSERT INTO card_first_editions (card_id, serial, user_id, created_at)
SELECT card_id, serial, user_id, obtained_at
FROM (
    SELECT uc.card_id, uc.user_id, uc.obtained_at,
           ROW_NUMBER() OVER (PARTITION BY uc.card_id ORDER BY uc.obtained_at, uc.user_id) AS serial
    FROM user_cards uc
    JOIN cards c ON c.id = uc.card_id
    JOIN users u ON u.id = uc.user_id
    WHERE uc.quantity > 0 AND NOT u.is_npc
      AND random() < CASE c.rarity WHEN 'legendary' THEN 0.10 WHEN 'epic' THEN 0.06 WHEN 'rare' THEN 0.04
                                   WHEN 'uncommon' THEN 0.02 ELSE 0.01 END
) drawn
WHERE serial <= 10;
