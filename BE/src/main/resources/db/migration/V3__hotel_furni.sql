-- VinylDex Hotel, tappa 2: mobili, inventario e vetrine delle carte.

-- Mobili. room_id null = nell'inventario del proprietario, non ancora posizionato.
-- owner_id null = arredo fisso di una stanza pubblica (bancone, consolle), di nessuno.
--
-- Mobili a pavimento: x, y e' la casella d'angolo (quella con x e y minori) e rot dice
-- l'orientamento: 0 = lato lungo lungo l'asse x, 2 = lungo l'asse y.
-- Mobili a parete: x, y e' la casella davanti alla parete; rot 0 = parete sul lato -y
-- (a destra sullo schermo), rot 2 = parete sul lato -x (a sinistra).
CREATE TABLE room_items (
    id          uuid         PRIMARY KEY,
    owner_id    uuid         REFERENCES users(id) ON DELETE CASCADE,
    room_id     uuid         REFERENCES rooms(id) ON DELETE CASCADE,
    furni_type  varchar(40)  NOT NULL,
    x           integer      NOT NULL DEFAULT 0,
    y           integer      NOT NULL DEFAULT 0,
    z           integer      NOT NULL DEFAULT 0,
    rot         integer      NOT NULL DEFAULT 0,
    card_id     uuid         REFERENCES cards(id) ON DELETE SET NULL,
    state       jsonb,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_room_items_rot CHECK (rot IN (0, 2))
);

CREATE INDEX idx_room_items_room ON room_items(room_id);
CREATE INDEX idx_room_items_owner ON room_items(owner_id);

-- Acquisti di mobili e ricompense delle sfide fra giocatori (tappa 4) nel portafoglio.
ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;
ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (
    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',
    'FURNI_PURCHASE', 'PVP_REWARD'));

-- Arredo della Lobby: bancone e consolle sul palco, pista, divani, piante e casse.
INSERT INTO room_items (id, owner_id, room_id, furni_type, x, y, z, rot) VALUES
    ('00000000-0000-0000-0000-0000000f0001', NULL, '00000000-0000-0000-0000-00000000a001', 'dj_booth',    2, 1, 1, 0),
    ('00000000-0000-0000-0000-0000000f0002', NULL, '00000000-0000-0000-0000-00000000a001', 'speaker',     1, 1, 1, 0),
    ('00000000-0000-0000-0000-0000000f0003', NULL, '00000000-0000-0000-0000-00000000a001', 'speaker',     5, 1, 1, 0),
    ('00000000-0000-0000-0000-0000000f0004', NULL, '00000000-0000-0000-0000-00000000a001', 'bar_counter', 11, 1, 0, 0),
    ('00000000-0000-0000-0000-0000000f0005', NULL, '00000000-0000-0000-0000-00000000a001', 'jukebox',     15, 3, 0, 0),
    ('00000000-0000-0000-0000-0000000f0006', NULL, '00000000-0000-0000-0000-00000000a001', 'sofa_vinyl',  8, 12, 0, 0),
    ('00000000-0000-0000-0000-0000000f0007', NULL, '00000000-0000-0000-0000-00000000a001', 'sofa_vinyl',  11, 12, 0, 0),
    ('00000000-0000-0000-0000-0000000f0008', NULL, '00000000-0000-0000-0000-00000000a001', 'table_round', 10, 11, 0, 0),
    ('00000000-0000-0000-0000-0000000f0009', NULL, '00000000-0000-0000-0000-00000000a001', 'plant_palm',  1, 4, 0, 0),
    ('00000000-0000-0000-0000-0000000f000a', NULL, '00000000-0000-0000-0000-00000000a001', 'plant_palm',  15, 1, 0, 0),
    ('00000000-0000-0000-0000-0000000f000b', NULL, '00000000-0000-0000-0000-00000000a001', 'lamp_neon',   1, 12, 0, 0),
    ('00000000-0000-0000-0000-0000000f000c', NULL, '00000000-0000-0000-0000-00000000a001', 'poster_neon', 8, 1, 0, 0),
    ('00000000-0000-0000-0000-0000000f000d', NULL, '00000000-0000-0000-0000-00000000a001', 'poster_neon', 1, 9, 0, 2);

-- Pista da ballo 4x4 al centro della Lobby.
INSERT INTO room_items (id, owner_id, room_id, furni_type, x, y, z, rot)
SELECT ('00000000-0000-0000-0000-0000000fd' || lpad(to_hex(gx * 4 + gy), 3, '0'))::uuid,
       NULL, '00000000-0000-0000-0000-00000000a001', 'dance_tile', 7 + gx, 6 + gy, 0, 0
FROM generate_series(0, 3) AS gx, generate_series(0, 3) AS gy;

-- Arena: due sedie ai lati del palco centrale e piante agli angoli.
INSERT INTO room_items (id, owner_id, room_id, furni_type, x, y, z, rot) VALUES
    ('00000000-0000-0000-0000-0000000fa001', NULL, '00000000-0000-0000-0000-00000000a002', 'trophy',     5, 4, 1, 0),
    ('00000000-0000-0000-0000-0000000fa002', NULL, '00000000-0000-0000-0000-00000000a002', 'plant_palm', 1, 1, 0, 0),
    ('00000000-0000-0000-0000-0000000fa003', NULL, '00000000-0000-0000-0000-00000000a002', 'plant_palm', 11, 1, 0, 0),
    ('00000000-0000-0000-0000-0000000fa004', NULL, '00000000-0000-0000-0000-00000000a002', 'speaker',    9, 1, 0, 0);
