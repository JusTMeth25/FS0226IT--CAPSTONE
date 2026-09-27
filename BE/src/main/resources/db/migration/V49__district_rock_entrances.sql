-- Quartiere (V46): nel parco, girati verso la via, gli ingressi del Locale Rock e del Rock Store
-- (le stanze sono nella V48). Si tolgono l'aiuola e i due alberi che stavano davanti alle porte.
-- La V46 e' pubblicata: le modifiche al quartiere si fanno qui, a mano.
DELETE FROM room_items WHERE id IN (
    '00000000-0000-0000-0000-c0150000001f',  -- aiuola (12, 25)
    '00000000-0000-0000-0000-c01500000021',  -- albero (13, 22)
    '00000000-0000-0000-0000-c01500000023'   -- albero (13, 30)
);

INSERT INTO room_items (id, owner_id, room_id, furni_type, x, y, z, rot) VALUES
    ('00000000-0000-0000-0000-c01500000100', NULL, '00000000-0000-0000-0000-00000000a015', 'facade_rock', 11, 22, 0, 2),
    ('00000000-0000-0000-0000-c01500000101', NULL, '00000000-0000-0000-0000-00000000a015', 'facade_guitars', 11, 28, 0, 2),
    ('00000000-0000-0000-0000-c01500000102', NULL, '00000000-0000-0000-0000-00000000a015', 'street_tree', 14, 27, 0, 0);
