-- Feste a tema: musica e luci nella stanza di chi fa la festa.
ALTER TABLE room_parties ADD COLUMN theme varchar(12) NOT NULL DEFAULT 'classic';

-- Quartiere (V46): il semaforo della gara in citta' e il posteggio dei taxi. La V46 e' pubblicata.
INSERT INTO room_items (id, owner_id, room_id, furni_type, x, y, z, rot) VALUES
    ('00000000-0000-0000-0000-c01500000110', NULL, '00000000-0000-0000-0000-00000000a015', 'race_start', 27, 13, 0, 0),
    ('00000000-0000-0000-0000-c01500000111', NULL, '00000000-0000-0000-0000-00000000a015', 'taxi_stand', 33, 21, 0, 0);
