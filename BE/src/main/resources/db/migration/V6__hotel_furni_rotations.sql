-- Quattro rotazioni per i mobili a pavimento: rot 4 e' il mezzo giro, rot 6 il mezzo giro
-- con gli assi scambiati. I mobili a parete continuano a usare solo 0 e 2 (le due pareti).
ALTER TABLE room_items DROP CONSTRAINT ck_room_items_rot;
ALTER TABLE room_items ADD CONSTRAINT ck_room_items_rot CHECK (rot IN (0, 2, 4, 6));
