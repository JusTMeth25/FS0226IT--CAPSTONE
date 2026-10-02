-- Carte sopra la testa dell'avatar scelte dal giocatore (codici separati da virgola, al massimo
-- tre). Null = scelta automatica: le piu' usate in battaglia, poi le piu' costose.
ALTER TABLE users ADD COLUMN hotel_top_cards varchar(400);
