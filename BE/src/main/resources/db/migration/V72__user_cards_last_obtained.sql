-- Data di "ottenuta" delle carte: e' l'ultima volta che la carta e' stata trovata. Dal passaggio a
-- Spring i doppioni non la aggiornavano piu' (colonna segnata come non aggiornabile), quindi le
-- carte ripescate non comparivano fra le ultime della collezione. Si rimette a posto con le
-- aperture dei pacchetti gia' fatte.
UPDATE user_cards uc
SET obtained_at = last.at
FROM (
    SELECT o.user_id, poc.card_id, max(poc.created_at) AS at
    FROM pack_opening_cards poc
    JOIN pack_openings o ON o.id = poc.pack_opening_id
    GROUP BY o.user_id, poc.card_id
) last
WHERE uc.user_id = last.user_id
  AND uc.card_id = last.card_id
  AND last.at > uc.obtained_at;
