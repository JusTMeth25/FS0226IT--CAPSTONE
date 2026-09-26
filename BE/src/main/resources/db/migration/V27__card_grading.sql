-- Gradazione delle carte dal perito dell'hotel: un voto da 1 a 10 sulla propria copia, che ne
-- alza il valore al negozio e negli scambi con gli NPC. Si gradua una volta sola.
ALTER TABLE user_cards ADD COLUMN grade smallint;
ALTER TABLE user_cards ADD COLUMN graded_at timestamptz;
ALTER TABLE user_cards ADD CONSTRAINT ck_user_cards_grade CHECK (grade IS NULL OR grade BETWEEN 1 AND 10);
