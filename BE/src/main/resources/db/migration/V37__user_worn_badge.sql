-- Distintivo "indossato" nell'hotel: uno fra quelli sbloccati (set completati, livello,
-- collezione, battaglie), mostrato accanto al nome dell'avatar. Null = nessuno.
ALTER TABLE users ADD COLUMN worn_badge VARCHAR(80);
