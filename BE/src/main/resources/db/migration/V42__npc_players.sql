-- Giocatori NPC: alcuni personaggi dell'hotel hanno un account (senza accesso) per partecipare
-- ad asta, eventi a orario, tornei, mostra e stagione, cosi' non restano mai vuoti.
-- Le classifiche dei giocatori veri (gold, battaglie, collezione) li escludono.
ALTER TABLE users ADD COLUMN is_npc boolean NOT NULL DEFAULT false;
