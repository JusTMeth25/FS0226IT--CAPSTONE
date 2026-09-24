-- Pavimenti e pareti in stile Habbo per le stanze pubbliche: la Lobby diventa un locale con
-- parquet scuro e vetrate, l'Arena un magazzino in mattoni con il pavimento da ring.
UPDATE rooms SET floor_style = 'parquet', wall_style = 'windows' WHERE id = '00000000-0000-0000-0000-00000000a001';
UPDATE rooms SET floor_style = 'arena', wall_style = 'brick' WHERE id = '00000000-0000-0000-0000-00000000a002';
