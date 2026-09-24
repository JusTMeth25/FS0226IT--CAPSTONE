-- VinylDex Hotel, tappa 1: aspetto degli avatar e stanze.

-- Aspetto dell'avatar nell'hotel, come codice compatto (es. "s2.h3.hc1.sh4.p2").
-- Null finche' l'utente non passa dal guardaroba: il server usa un aspetto predefinito.
ALTER TABLE users ADD COLUMN hotel_look varchar(40);

-- Stanze dell'hotel.
--
-- layout e' la mappa delle altezze, una riga per ogni y separata da "\n": "x" e' vuoto,
-- una cifra e' una casella camminabile a quell'altezza. Esempio di stanza 3x2 con la
-- colonna di sinistra rialzata e un buco in alto a destra:
--   10x
--   100
-- La porta e' la casella dove entrano gli avatar; door_dir e' la direzione in cui guardano.
CREATE TABLE rooms (
    id           uuid          PRIMARY KEY,
    owner_id     uuid          REFERENCES users(id) ON DELETE CASCADE,
    name         varchar(60)   NOT NULL,
    description  varchar(255),
    layout       text          NOT NULL,
    door_x       integer       NOT NULL,
    door_y       integer       NOT NULL,
    door_dir     integer       NOT NULL DEFAULT 2,
    floor_style  varchar(30)   NOT NULL DEFAULT 'neon',
    wall_style   varchar(30)   NOT NULL DEFAULT 'neon',
    door_mode    varchar(10)   NOT NULL DEFAULT 'open',
    max_users    integer       NOT NULL DEFAULT 25,
    is_public    boolean       NOT NULL DEFAULT false,
    sort_order   integer       NOT NULL DEFAULT 0,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_rooms_door_mode CHECK (door_mode IN ('open', 'closed')),
    CONSTRAINT ck_rooms_max_users CHECK (max_users BETWEEN 1 AND 50)
);

CREATE INDEX idx_rooms_owner ON rooms(owner_id);
CREATE INDEX idx_rooms_public ON rooms(is_public);

-- Stanze pubbliche di partenza.
-- La Lobby ha un palco rialzato in fondo a sinistra e la porta sulla parete sinistra.
INSERT INTO rooms (id, owner_id, name, description, layout, door_x, door_y, door_dir,
                   floor_style, wall_style, is_public, sort_order)
VALUES
    ('00000000-0000-0000-0000-00000000a001', NULL, 'VinylDex Lobby',
     'Il cuore dell''hotel: incontra gli altri collezionisti, chiacchiera e sfidali.',
     E'xxxxxxxxxxxxxxxx\n' ||
     E'x111110000000000\n' ||
     E'x111110000000000\n' ||
     E'x111110000000000\n' ||
     E'x000000000000000\n' ||
     E'x000000000000000\n' ||
     E'0000000000000000\n' ||
     E'x000000000000000\n' ||
     E'x000000000000000\n' ||
     E'x000000000000000\n' ||
     E'x000000000000000\n' ||
     E'x000000000000000\n' ||
     E'x000000000000000\n' ||
     E'x00000000000000x\n' ||
     E'x0000000000000xx',
     0, 6, 2, 'neon', 'neon', true, 1),
    ('00000000-0000-0000-0000-00000000a002', NULL, 'Arena',
     'Qui si regolano i conti: sfide a colpi di carte davanti al pubblico.',
     E'xxxxxxxxxxxx\n' ||
     E'x00000000000\n' ||
     E'x00000000000\n' ||
     E'x00011110000\n' ||
     E'000011110000\n' ||
     E'x00011110000\n' ||
     E'x00000000000\n' ||
     E'x00000000000\n' ||
     E'x00000000000',
     0, 4, 2, 'arena', 'arena', true, 2);
