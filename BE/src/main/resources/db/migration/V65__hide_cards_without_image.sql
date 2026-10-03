-- Carte importate senza immagine (soprattutto promo giapponesi che TCGplayer pubblica senza
-- foto): nei pacchetti, nei set e nel raccoglitore si vedeva solo un riquadro vuoto. Si
-- disattivano, tranne quelle che qualcuno possiede gia', le carte disegnate dal backend (FC 27,
-- NBA) e le originali di VinylDex. CardImportWriter fa lo stesso con i prossimi import.
UPDATE cards c
SET is_active = FALSE
WHERE c.is_active
  AND COALESCE(TRIM(c.img_url), '') = ''
  AND c.source NOT IN ('fc27', 'nba', 'original')
  AND NOT EXISTS (SELECT 1 FROM user_cards uc WHERE uc.card_id = c.id);
