"""
Stanze pubbliche dell'hotel: pianta, arredi e posti degli NPC.

Genera le migrazioni Flyway con le stanze (layout e mobili) e stampa le righe di NpcRoster.java
con le posizioni degli NPC. Prima di scrivere controlla che tutto torni:
- ogni mobile sta dentro la stanza, su caselle della stessa altezza, senza bloccare la porta;
- due mobili solidi (o due tappeti) non si sovrappongono;
- i mobili a parete sono appesi a una parete vera;
- ogni casella libera e' raggiungibile dalla porta, con le stesse regole di Pathfinder.java;
- ogni NPC parte da una casella libera e raggiungibile, e ogni bancone ha un posto davanti.

Uso:  python BE/scripts/hotel_rooms.py            (scrive la migrazione e stampa il roster)
      python BE/scripts/hotel_rooms.py --preview  (disegna anche le piante in ASCII)
"""
import os
import sys
from collections import deque

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'main', 'resources', 'db', 'migration')
MIGRATION = os.path.join(MIGRATIONS_DIR, 'V12__hotel_big_rooms.sql')
# Le stanze aggiunte dopo la V12 (gia' applicata, non si puo' cambiare) finiscono in migrazioni loro.
V17 = os.path.join(MIGRATIONS_DIR, 'V17__hotel_stadium.sql')
V18 = os.path.join(MIGRATIONS_DIR, 'V18__hotel_bowling_minigolf.sql')
V19 = os.path.join(MIGRATIONS_DIR, 'V19__hotel_basket_court_bowling.sql')
V20 = os.path.join(MIGRATIONS_DIR, 'V20__hotel_comic_shop_billiards.sql')
LATER_MIGRATIONS = {15: V17, 16: V18, 17: V18, 18: V19}
# Migrazione in lavorazione: le altre, gia' pubblicate, non si riscrivono piu' (Flyway ne controlla
# il contenuto). Le stanze cambiate dopo la pubblicazione si rifanno qui (REBUILT) e gli arredi da
# togliere si elencano in REMOVED.
CURRENT = V20
REBUILT = {16: V19, 8: V20, 12: V20}
REMOVED = {V19: [('00000000-0000-0000-0000-00000000a00f', 'basket_hoop')]}
# Arredi aggiunti a stanze gia' pubblicate: finiscono nella migrazione indicata (vedi Room.migration).
MIGRATION_TITLES = {
    V17: 'Nuova stanza pubblica: Stadio.',
    V18: 'Canestri nello stadio e due stanze nuove: Bowling e Minigolf.',
    V19: 'Palazzetto con il campo da basket, bowling rifatto con piu\' piste, canestri tolti dallo stadio.',
    V20: 'Edicola come un negozio di fumetti e carte con il museo VinylDex, biliardi grandi in sala giochi.',
}

# ------------------------------------------------------------------ catalogo (come FurniCatalog.java)

# type: (larghezza, lunghezza, a parete, calpestabile, direzione da seduti o -1)
FURNI = {
    'chair_neon': (1, 1, False, False, 2), 'sofa_vinyl': (2, 1, False, False, 4),
    'table_round': (1, 1, False, False, -1), 'plant_palm': (1, 1, False, False, -1),
    'lamp_neon': (1, 1, False, False, -1), 'rug_vinyl': (2, 2, False, True, -1),
    'speaker': (1, 1, False, False, -1), 'jukebox': (1, 1, False, False, -1),
    'dance_tile': (1, 1, False, True, -1), 'trophy': (1, 1, False, False, -1),
    'card_pedestal': (1, 1, False, False, -1), 'card_frame': (1, 1, True, False, -1),
    'poster_neon': (1, 1, True, False, -1), 'armchair': (1, 1, False, False, 2),
    'bar_stool': (1, 1, False, False, 2), 'beanbag': (1, 1, False, False, 2),
    'cafe_table': (1, 1, False, False, -1), 'coffee_table': (2, 1, False, False, -1),
    'bookshelf': (1, 1, False, False, -1), 'plant_big': (1, 1, False, False, -1),
    'rug_round': (2, 2, False, True, -1), 'arcade': (1, 1, False, False, -1),
    'cafe_counter': (2, 1, False, False, -1), 'coffee_machine': (1, 1, False, False, -1),
    'lamp_floor': (1, 1, False, False, -1), 'turntable': (1, 1, False, False, -1),
    'record_shelf': (1, 1, False, False, -1), 'neon_sign': (1, 1, True, False, -1),
    'window_wall': (1, 1, True, False, -1), 'chalkboard': (1, 1, True, False, -1),
    'pool_water': (1, 1, False, True, -1), 'sunbed': (1, 1, False, False, 2),
    'umbrella': (1, 1, False, False, -1), 'lifeguard_chair': (1, 1, False, False, -1),
    'aquarium': (2, 1, False, False, -1), 'fireplace': (2, 1, False, False, -1),
    'bench': (2, 1, False, False, 4), 'fountain': (2, 2, False, False, -1),
    'flower_bed': (1, 1, False, False, -1), 'icecream_cart': (2, 1, False, False, -1),
    'pizza_oven': (2, 1, False, False, -1), 'pool_table': (2, 1, False, False, -1),
    'claw_machine': (1, 1, False, False, -1), 'globe': (1, 1, False, False, -1),
    'fire_pit': (1, 1, False, False, -1), 'bar_counter': (3, 1, False, False, -1),
    'dj_booth': (2, 1, False, False, -1),
    # Spiaggia
    'sea_water': (2, 2, False, True, -1), 'sea_foam': (1, 1, False, True, -1),
    'beach_towel': (1, 2, False, True, -1), 'sand_castle': (1, 1, False, False, -1),
    'beach_bar': (2, 1, False, False, -1), 'palm_tree': (1, 1, False, False, -1),
    'volley_net': (3, 1, False, False, -1),
    # Edicola
    'newsstand': (3, 1, False, False, -1), 'pack_display': (1, 1, False, False, -1),
    'magazine_rack': (1, 1, False, False, -1), 'street_lamp': (1, 1, False, False, -1),
    # Cinema
    'cinema_screen': (6, 1, False, False, -1), 'cinema_seat': (1, 1, False, False, 0),
    'popcorn_machine': (1, 1, False, False, -1), 'movie_poster': (1, 1, True, False, -1),
    # Palestra
    'treadmill': (1, 2, False, False, -1), 'weight_bench': (2, 1, False, False, 4),
    'punching_bag': (1, 1, False, False, -1), 'yoga_mat': (1, 2, False, True, -1),
    'dumbbell_rack': (2, 1, False, False, -1), 'water_cooler': (1, 1, False, False, -1),
    # Stadio
    'football_goal': (1, 3, False, False, -1), 'corner_flag': (1, 1, False, False, -1),
    'floodlight': (1, 1, False, False, -1), 'scoreboard': (1, 1, True, False, -1),
    'basket_hoop': (1, 1, False, False, -1), 'billiard_table': (4, 2, False, False, -1),
    'comic_shelf': (1, 1, False, False, -1),
    # Bowling
    'bowling_lane': (1, 8, False, False, -1), 'bowling_rack': (1, 1, False, False, -1),
    'shoe_counter': (2, 1, False, False, -1),
    # Minigolf
    **{f'golf_hole_{n}': (3, 2, False, False, -1) for n in range(1, 7)},
}

# Mobili che si usano cliccandoli: serve una casella libera accanto.
SERVING = {'billiard_table', 'bar_counter', 'cafe_counter', 'coffee_machine', 'icecream_cart', 'pizza_oven', 'beach_bar',
           'popcorn_machine', 'water_cooler', 'newsstand', 'basket_hoop', 'bowling_lane', 'shoe_counter',
           *[f'golf_hole_{n}' for n in range(1, 7)]}


def footprint(kind, rot):
    w, l, wall, _, _ = FURNI[kind]
    if wall:
        return 1, 1
    return (l, w) if rot in (2, 6) else (w, l)


def passable(kind):
    _, _, _, walk, sit = FURNI[kind]
    return walk or sit >= 0


def flat(kind):
    _, _, wall, walk, sit = FURNI[kind]
    return walk and sit < 0 and not wall


# ------------------------------------------------------------------ stanza

class Room:
    def __init__(self, num, key, name, desc, w, h, door_y, floor, wall, sort, base=0):
        self.num = num
        self.id = f'00000000-0000-0000-0000-00000000a{num:03x}'
        self.key = key
        self.name = name
        self.desc = desc
        self.w = w
        self.h = h
        self.door = (0, door_y)
        self.floor = floor
        self.wall = wall
        self.sort = sort
        # Caselle da (1, 1) a (w, h); la porta sta sulla parete sinistra, in (0, door_y).
        self.heights = {(x, y): base for x in range(1, w + 1) for y in range(1, h + 1)}
        self.heights[self.door] = base
        self.items = []
        self.npcs = []
        # Arredi aggiunti dopo la pubblicazione della stanza: indice del primo e migrazione in cui vanno.
        self.split = None
        self.split_migration = None
        # Carte esposte (vetrine e quadri): indice dell'arredo -> code della carta.
        self.cards = {}

    # --- pianta
    def level(self, x0, y0, x1, y1, z):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                if (x, y) in self.heights:
                    self.heights[(x, y)] = z
        # La porta sta alla stessa altezza della casella da cui si entra.
        self.heights[self.door] = self.heights[(self.door[0] + 1, self.door[1])]

    def void(self, x0, y0, x1, y1):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                self.heights.pop((x, y), None)

    def layout(self):
        rows = []
        for y in range(0, self.h + 1):
            row = ''
            for x in range(0, self.w + 1):
                z = self.heights.get((x, y))
                row += 'x' if z is None else str(z)
            rows.append(row)
        return rows

    # --- arredi
    def add(self, kind, x, y, rot=0):
        assert kind in FURNI, kind
        self.items.append((kind, x, y, rot))
        return self

    def row(self, kind, x, y, n, dx=1, dy=0, rot=0):
        for i in range(n):
            self.add(kind, x + i * dx, y + i * dy, rot)
        return self

    def table_for_two(self, x, y, chair='chair_neon', table='cafe_table'):
        """Tavolino con una sedia a sinistra (girata a est) e una a destra (girata a ovest)."""
        self.add(chair, x - 1, y, 0).add(table, x, y).add(chair, x + 1, y, 4)
        return self

    def lounge(self, x, y, seat='beanbag'):
        """Tavolino basso 2x1 con quattro sedute intorno, tutte girate verso il tavolino."""
        self.add('coffee_table', x, y)
        self.add(seat, x, y - 1, 2).add(seat, x + 1, y - 1, 2)
        self.add(seat, x, y + 1, 6).add(seat, x + 1, y + 1, 6)
        return self

    def show(self, kind, x, y, code, rot=0):
        """Vetrina o quadro con una carta esposta (il code della carta nel catalogo)."""
        self.cards[len(self.items)] = code
        return self.add(kind, x, y, rot)

    def migration(self, path):
        """Gli arredi aggiunti da qui in poi vanno nella migrazione indicata, non in quella della stanza."""
        self.split = len(self.items)
        self.split_migration = path
        return self

    def published_items(self):
        return self.items if self.split is None else self.items[:self.split]

    # --- NPC
    def worker(self, key, name, role, look, x, y, direction, *menu):
        self.npcs.append(('worker', key, name, role, look, x, y, direction, menu))
        return self

    def walker(self, key, name, role, look, x, y, radius, *menu):
        self.npcs.append(('walker', key, name, role, look, x, y, radius, menu))
        return self

    # --- verifiche
    def z(self, x, y):
        return self.heights.get((x, y))

    def check(self):
        errors = []
        solid = {}
        floor_flat = {}
        walls = set()
        dx0, dy0 = self.door
        entrance = {(dx0, dy0), (dx0 + 1, dy0)}
        for kind, x, y, rot in self.items:
            label = f'{kind}@{x},{y}'
            _, _, wall, _, _ = FURNI[kind]
            if wall:
                if (x, y) not in self.heights or (x, y) == self.door:
                    errors.append(f'{label}: fuori dalla stanza')
                wx, wy = (x - 1, y) if rot == 2 else (x, y - 1)
                if (wx, wy) in self.heights:
                    errors.append(f'{label}: nessuna parete dietro')
                if (x, y, rot) in walls:
                    errors.append(f'{label}: parete gia\' occupata')
                walls.add((x, y, rot))
                continue
            fx, fy = footprint(kind, rot)
            zs = set()
            for tx in range(x, x + fx):
                for ty in range(y, y + fy):
                    if (tx, ty) not in self.heights:
                        errors.append(f'{label}: esce dalla stanza in {tx},{ty}')
                        continue
                    zs.add(self.heights[(tx, ty)])
                    if (tx, ty) in entrance and not passable(kind):
                        errors.append(f'{label}: blocca la porta')
                    target = floor_flat if flat(kind) else solid
                    if (tx, ty) in target:
                        errors.append(f'{label}: sovrapposto a {target[(tx, ty)]}')
                    target[(tx, ty)] = label
            if len(zs) > 1:
                errors.append(f'{label}: su altezze diverse')
        self.solid = {t for t, label in solid.items() if not self._passable_label(label)}

        def blocked(t):
            return t not in self.heights or t in self.solid

        def can_step(a, b):
            return not blocked(b) and abs(self.heights[a] - self.heights[b]) <= 1

        seen = {self.door}
        queue = deque([self.door])
        while queue:
            cx, cy = queue.popleft()
            for ddx, ddy in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
                n = (cx + ddx, cy + ddy)
                if n in seen or not can_step((cx, cy), n):
                    continue
                if ddx and ddy and (not can_step((cx, cy), (cx + ddx, cy)) or not can_step((cx, cy), (cx, cy + ddy))):
                    continue
                seen.add(n)
                queue.append(n)
        unreachable = [t for t in self.heights if not blocked(t) and t not in seen]
        if unreachable:
            errors.append(f'caselle irraggiungibili: {sorted(unreachable)[:12]}')
        self.reachable = seen

        taken = set()
        for kind, key, name, role, look, x, y, extra, menu in self.npcs:
            if (x, y) not in seen:
                errors.append(f'NPC {name}: {x},{y} non raggiungibile o bloccata')
            if max(abs(x - dx0), abs(y - dy0)) <= 1:
                errors.append(f'NPC {name}: troppo vicino alla porta')
            if (x, y) in taken:
                errors.append(f'NPC {name}: casella gia\' presa')
            taken.add((x, y))

        for kind, x, y, rot in self.items:
            if kind not in SERVING:
                continue
            fx, fy = footprint(kind, rot)
            around = {(tx, ty) for tx in range(x - 1, x + fx + 1) for ty in range(y - 1, y + fy + 1)}
            if not any(t in seen for t in around):
                errors.append(f'{kind}@{x},{y}: nessun posto libero accanto')
        return errors

    def _passable_label(self, label):
        return passable(label.split('@')[0])

    def preview(self):
        grid = {}
        for kind, x, y, rot in self.items:
            if FURNI[kind][2]:
                continue
            fx, fy = footprint(kind, rot)
            ch = '~' if kind in ('sea_water', 'pool_water') else ('-' if flat(kind) else ('s' if FURNI[kind][4] >= 0 else '#'))
            for tx in range(x, x + fx):
                for ty in range(y, y + fy):
                    grid.setdefault((tx, ty), ch)
        for kind, key, name, *_ in self.npcs:
            pass
        npc_at = {(n[5], n[6]): n[2][0] for n in self.npcs}
        lines = [f'== {self.name} ({self.w}x{self.h})']
        for y in range(0, self.h + 1):
            row = ''
            for x in range(0, self.w + 1):
                if (x, y) in npc_at:
                    row += npc_at[(x, y)]
                elif (x, y) not in self.heights:
                    row += ' '
                elif (x, y) == self.door:
                    row += 'D'
                else:
                    row += grid.get((x, y), '.' if self.heights[(x, y)] == 0 else str(self.heights[(x, y)]))
            lines.append(row)
        return '\n'.join(lines)


ROOMS = []


def room(*args, **kwargs):
    r = Room(*args, **kwargs)
    ROOMS.append(r)
    return r


# ------------------------------------------------------------------ Lobby

r = room(1, 'LOBBY', 'VinylDex Lobby',
         'Il cuore dell''hotel: incontra gli altri collezionisti, chiacchiera e sfidali.',
         26, 24, 12, 'parquet', 'windows', 1)
r.level(1, 1, 7, 5, 1)  # palco rialzato in fondo a sinistra
r.add('dj_booth', 3, 2, 0).add('speaker', 1, 1).add('speaker', 7, 1).add('trophy', 6, 4)
r.add('lamp_neon', 1, 5).add('lamp_neon', 7, 5)
r.row('bookshelf', 9, 1, 4).add('record_shelf', 13, 1).add('jukebox', 14, 1)
# Caffetteria: bancone lungo con gli sgabelli, macchina del caffe' dietro.
r.add('bar_counter', 17, 4).add('bar_counter', 20, 4)
r.add('coffee_machine', 18, 1).add('record_shelf', 20, 1).add('plant_big', 22, 1).add('turntable', 23, 1)
r.row('bar_stool', 17, 5, 6, rot=6)
r.add('neon_sign', 19, 1, 0).add('chalkboard', 22, 1, 0).add('neon_sign', 10, 1, 0)
for tx, ty in [(17, 9), (21, 9), (25, 9), (17, 13), (21, 13), (25, 13), (17, 17), (21, 17)]:
    r.table_for_two(tx, ty)
# Reception vicino alla porta.
r.add('bar_counter', 4, 14, 2).add('plant_big', 1, 17).add('lamp_floor', 3, 18)
# Salotti.
r.add('rug_round', 8, 18).add('coffee_table', 8, 18).add('armchair', 7, 18, 0).add('armchair', 10, 18, 4)
r.add('armchair', 8, 19, 6).add('armchair', 9, 19, 6)
r.add('sofa_vinyl', 12, 21, 0).add('coffee_table', 12, 22).add('sofa_vinyl', 12, 23, 4)
r.row('arcade', 22, 24, 4).add('claw_machine', 26, 21)
r.add('plant_big', 1, 24).add('plant_big', 26, 1).add('plant_big', 15, 24).add('lamp_floor', 26, 17)
r.add('window_wall', 1, 8, 2).add('window_wall', 1, 16, 2).add('window_wall', 1, 20, 2)
r.add('poster_neon', 16, 1, 0)
r.worker('vera', 'Vera', 'RECEPTIONIST', 's1.h8.hc6.sh0.p1.t2.f0.a1.b1', 3, 15, 2)
r.worker('marco', 'Marco', 'BARISTA', 's3.h0.hc0.sh8.p1.t3.f0.a0', 19, 3, 4, 'coffee', 'cola', 'juice', 'bubble')
r.walker('leo', 'Leo', 'WAITER', 's2.h9.hc7.sh7.p1.t2.f0.a0', 20, 11, 5, 'coffee', 'cola', 'juice')
r.walker('sofia', 'Sofia', 'GUEST', 's0.h2.hc2.sh1.p3.t1.f1.a3.b1', 10, 15, 5)
r.walker('greta', 'Greta', 'GUEST', 's1.h6.hc3.sh4.p3.t4.f3.a1.b1', 19, 21, 4)

# ------------------------------------------------------------------ Arena

r = room(2, 'ARENA', 'Arena',
         'Qui si regolano i conti: sfide a colpi di carte davanti al pubblico.',
         24, 22, 11, 'arena', 'brick', 2)
r.level(9, 8, 16, 14, 1)  # ring rialzato al centro
r.add('trophy', 12, 8).add('lamp_floor', 9, 8).add('lamp_floor', 16, 8).add('lamp_floor', 9, 14).add('lamp_floor', 16, 14)
for x in (9, 11, 13, 15):
    r.add('bench', x, 5, 0).add('bench', x, 17, 4)
for y in (8, 10, 12):
    r.add('bench', 6, y, 2).add('bench', 19, y, 6)
r.add('neon_sign', 12, 1, 0).add('neon_sign', 1, 5, 2).add('poster_neon', 8, 1, 0).add('poster_neon', 17, 1, 0)
r.add('speaker', 3, 1).add('speaker', 22, 1).add('plant_palm', 1, 1).add('plant_palm', 24, 1)
r.add('plant_palm', 1, 22).add('plant_palm', 24, 22).add('trophy', 5, 1).add('trophy', 20, 1)
r.add('cafe_counter', 21, 19).add('coffee_machine', 23, 19)
r.worker('rocco', 'Rocco', 'REFEREE', 's4.h9.hc7.sh8.p1.t0.f0.a0', 12, 7, 4)
r.walker('dario', 'Dario', 'FIGHTER', 's2.h4.hc6.sh6.p1.t0.f2.a0', 5, 16, 4)
r.walker('kira', 'Kira', 'FIGHTER', 's0.h7.hc4.sh9.p1.t3.f3.a2.b1', 20, 15, 4)
r.walker('brutus', 'Brutus', 'FIGHTER', 's4.h9.hc7.sh6.p5.t4.f0.a6', 4, 4, 3)

# ------------------------------------------------------------------ Sala Relax

r = room(3, 'RELAX', 'Sala Relax',
         'Poltrone, camino e acquario: il posto giusto per chiacchierare con calma davanti a un te''.',
         24, 22, 11, 'carpet', 'wood', 3)
r.add('fireplace', 11, 1).add('rug_round', 11, 3).add('coffee_table', 11, 4)
r.add('armchair', 10, 4, 0).add('armchair', 13, 4, 4).add('sofa_vinyl', 11, 6, 4)
r.row('bookshelf', 3, 1, 5).add('lamp_floor', 9, 1).add('lamp_floor', 14, 1)
r.add('aquarium', 18, 1).add('plant_big', 21, 1).add('plant_big', 24, 1).add('coffee_machine', 16, 1)
r.lounge(5, 15).lounge(18, 8, 'armchair').lounge(17, 17)
r.add('rug_vinyl', 5, 7).add('sofa_vinyl', 5, 6, 0).add('coffee_table', 5, 8).add('sofa_vinyl', 5, 9, 4)
r.add('plant_big', 1, 22).add('plant_big', 24, 22).add('lamp_floor', 10, 21).add('globe', 13, 21)
r.add('window_wall', 1, 6, 2).add('window_wall', 1, 17, 2).add('window_wall', 7, 1, 0)
r.walker('luna', 'Luna', 'WAITER', 's1.h3.hc1.sh11.p1.t2.f0.a0.b1', 12, 12, 6, 'tea', 'coffee')
r.walker('otto', 'Otto', 'GUEST', 's2.h0.hc9.sh3.p0.t3.f4.a1', 17, 14, 5)
r.walker('mira', 'Mira', 'GUEST', 's5.h6.hc0.sh4.p6.t1.f3.a5.b1', 7, 13, 5)

# ------------------------------------------------------------------ Piscina

r = room(4, 'POOL', 'Piscina Lido',
         'Tuffati! Lettini, ombrelloni e cocktail a bordo vasca. Il bagnino ti tiene d''occhio.',
         26, 24, 12, 'pooldeck', 'pooltile', 4)
for x in range(8, 19):
    for y in range(8, 17):
        r.add('pool_water', x, y)
r.add('bar_counter', 9, 4).add('bar_counter', 12, 4)
r.row('bar_stool', 9, 5, 6, rot=6).add('umbrella', 16, 4).add('plant_palm', 7, 1).add('plant_palm', 16, 1)
r.add('coffee_machine', 10, 1).add('record_shelf', 13, 1)
r.add('lifeguard_chair', 20, 11)
for y in (8, 10, 12, 14, 16):
    r.add('sunbed', 4, y, 0).add('sunbed', 23, y, 4)
for y in (9, 13, 17):
    r.add('umbrella', 3, y).add('umbrella', 24, y)
for x in (8, 10, 12, 14, 16, 18):
    r.add('sunbed', x, 20, 6)
for x in (9, 13, 17):
    r.add('umbrella', x, 21)
r.add('plant_palm', 1, 1).add('plant_palm', 26, 1).add('plant_palm', 1, 24).add('plant_palm', 26, 24)
r.add('window_wall', 1, 6, 2).add('window_wall', 1, 18, 2).add('window_wall', 21, 1, 0)
r.worker('rico', 'Rico', 'BARISTA', 's3.h5.hc5.sh10.p0.t0.f1.a2', 11, 3, 4, 'cocktail', 'juice', 'cola', 'bubble')
r.worker('bruno', 'Bruno', 'LIFEGUARD', 's4.h9.hc7.sh6.p5.t4.f2.a2', 20, 13, 6)
r.walker('nina', 'Nina', 'GUEST', 's0.h7.hc4.sh2.p3.t4.f5.a2.b1', 13, 12, 4)
r.walker('teo', 'Teo', 'GUEST', 's2.h1.hc8.sh5.p7.t4.f1.a0', 6, 19, 4)

# ------------------------------------------------------------------ Neon Bar

r = room(5, 'NEON_BAR', 'Neon Bar',
         'Cocktail al neon, la consolle di DJ Byte e una pista che non si ferma mai.',
         24, 22, 11, 'checker', 'neon', 5)
r.level(9, 1, 15, 3, 1)  # palco del DJ
r.add('dj_booth', 11, 3).add('speaker', 9, 1).add('speaker', 15, 1).add('lamp_neon', 9, 3).add('lamp_neon', 15, 3)
for x in range(9, 16):
    for y in range(8, 14):
        r.add('dance_tile', x, y)
r.add('bar_counter', 5, 3, 2).add('bar_counter', 5, 6, 2)
r.row('bar_stool', 6, 3, 6, dx=0, dy=1, rot=4)
r.add('jukebox', 1, 1).add('record_shelf', 2, 1).add('coffee_machine', 3, 1)
for x in (19, 22):
    r.add('sofa_vinyl', x, 5, 0).add('coffee_table', x, 6).add('sofa_vinyl', x, 7, 4)
    r.add('sofa_vinyl', x, 15, 0).add('coffee_table', x, 16).add('sofa_vinyl', x, 17, 4)
r.table_for_two(4, 17).table_for_two(8, 19).table_for_two(4, 21)
r.add('lamp_neon', 17, 1).add('lamp_neon', 24, 1).add('plant_palm', 24, 22).add('arcade', 13, 22).add('arcade', 14, 22)
r.add('neon_sign', 12, 1, 0).add('neon_sign', 20, 1, 0).add('poster_neon', 1, 7, 2).add('poster_neon', 1, 17, 2)
r.worker('vinnie', 'Vinnie', 'BARISTA', 's2.h4.hc4.sh9.p1.t3.f0.a4', 3, 5, 2, 'cocktail', 'cola', 'bubble', 'juice')
r.worker('byte', 'DJ Byte', 'DJ', 's5.h1.hc5.sh8.p1.t1.f5.a3', 12, 2, 4)
r.walker('gio', 'Gio', 'WAITER', 's1.h0.hc1.sh7.p1.t2.f0.a0', 17, 12, 5, 'cocktail', 'cola', 'bubble')
r.walker('stella', 'Stella', 'GUEST', 's0.h2.hc6.sh1.p4.t4.f3.a4.b1', 12, 11, 3)
r.walker('remo', 'Remo', 'GUEST', 's3.h4.hc0.sh9.p0.t1.f2.a3', 20, 11, 4)

# ------------------------------------------------------------------ Giardino

r = room(6, 'GARDEN', 'Giardino',
         'Prato, fontana e panchine all''ombra. Gigi vende i gelati, Flora cura le aiuole.',
         28, 24, 12, 'grass', 'hedge', 6)
r.add('fountain', 14, 11)
r.add('bench', 14, 8, 0).add('bench', 14, 14, 4).add('bench', 11, 11, 2).add('bench', 17, 11, 6)
for x, y in [(8, 5), (20, 5), (8, 18), (20, 18)]:
    r.add('plant_palm', x, y).add('flower_bed', x + 1, y).add('flower_bed', x, y + 1)
r.row('flower_bed', 3, 1, 10).row('flower_bed', 17, 1, 10)
r.row('plant_big', 1, 1, 3, dx=0, dy=3).row('plant_big', 1, 16, 3, dx=0, dy=3)
r.add('icecream_cart', 23, 17).add('umbrella', 26, 17).add('table_round', 23, 21).add('chair_neon', 22, 21, 0)
r.add('chair_neon', 24, 21, 4).add('table_round', 26, 21).add('chair_neon', 25, 21, 0).add('chair_neon', 27, 21, 4)
r.add('rug_round', 5, 20).add('beanbag', 4, 20, 0).add('beanbag', 7, 21, 4)
r.add('lamp_floor', 13, 1).add('lamp_floor', 28, 1).add('lamp_floor', 28, 24).add('fire_pit', 25, 8)
r.add('bench', 24, 6, 0).add('bench', 24, 10, 4)
r.worker('gigi', 'Gigi', 'ICE_CREAM', 's1.h5.hc7.sh7.p3.t0.f1.a0', 24, 16, 4, 'gelato')
r.walker('flora', 'Flora', 'GARDENER', 's3.h7.hc1.sh5.p7.t2.f4.a6.b1', 6, 15, 5)
r.walker('pietro', 'Pietro', 'GUEST', 's0.h1.hc3.sh10.p0.t0.f1.a0', 18, 7, 5)
r.walker('alma', 'Alma', 'GUEST', 's5.h8.hc2.sh3.p3.t1.f1.a5.b1', 11, 19, 4)

# ------------------------------------------------------------------ Pizzeria

r = room(7, 'PIZZERIA', 'Pizzeria',
         'Forno a legna, tavoli a quadretti e Salvatore che sforna margherite tutto il giorno.',
         22, 20, 10, 'terracotta', 'brick', 7)
r.add('pizza_oven', 6, 1).add('pizza_oven', 10, 1).add('cafe_counter', 6, 4).add('cafe_counter', 9, 4)
r.add('coffee_machine', 13, 1).add('plant_big', 14, 1).add('lamp_floor', 4, 1)
for tx in (5, 9, 13, 17):
    for ty in (8, 12, 16):
        r.table_for_two(tx, ty)
r.add('plant_big', 22, 1).add('plant_big', 1, 20).add('plant_big', 22, 20).add('lamp_floor', 20, 1)
r.add('chalkboard', 16, 1, 0).add('window_wall', 1, 5, 2).add('window_wall', 1, 15, 2).add('neon_sign', 8, 1, 0)
r.worker('salvatore', 'Salvatore', 'CHEF', 's2.h5.hc7.sh7.p1.t2.f0.a0', 8, 3, 4, 'pizza')
r.walker('carla', 'Carla', 'WAITER', 's1.h7.hc1.sh6.p1.t2.f0.a0.b1', 11, 10, 6, 'pizza', 'cola', 'juice')
r.walker('enzo', 'Enzo', 'GUEST', 's3.h0.hc7.sh3.p0.t3.f4.a1', 15, 14, 4)

# ------------------------------------------------------------------ Sala Giochi

r = room(8, 'GAMES', 'Sala Giochi',
         'Cabinati arcade, biliardo e la pesca-peluche: chi fa il punteggio piu'' alto?',
         24, 22, 11, 'carpet', 'neon', 8)
r.row('arcade', 5, 1, 12).row('claw_machine', 19, 1, 4).add('jukebox', 1, 1)
r.row('arcade', 1, 3, 3, dx=0, dy=2)
# Quattro biliardi grandi (V20), ognuno con la sua lampada.
for x, y in [(5, 7), (13, 7), (5, 13), (13, 13)]:
    r.add('billiard_table', x, y).add('lamp_neon', x - 2, y)
r.lounge(19, 9).lounge(19, 16)
r.table_for_two(5, 19).table_for_two(10, 19)
r.add('cafe_counter', 15, 21).add('coffee_machine', 17, 21)
r.add('neon_sign', 10, 1, 0).add('poster_neon', 1, 15, 2).add('poster_neon', 1, 19, 2)
r.add('plant_palm', 24, 22).add('plant_palm', 1, 22).add('trophy', 24, 5)
r.walker('tito', 'Tito', 'WAITER', 's4.h9.hc7.sh2.p1.t0.f1.a3', 11, 10, 6, 'cola', 'bubble')
r.walker('pixel', 'Pixel', 'GUEST', 's0.h4.hc5.sh8.p1.t1.f5.a3', 10, 3, 4)
r.walker('max', 'Max', 'GUEST', 's2.h1.hc0.sh6.p0.t0.f2.a2', 16, 15, 4)

# ------------------------------------------------------------------ Biblioteca

r = room(9, 'LIBRARY', 'Biblioteca',
         'Scaffali fino al soffitto, poltrone e silenzio. Agata ti consiglia il libro giusto.',
         24, 22, 11, 'parquet', 'wood', 9)
r.row('bookshelf', 1, 1, 24).row('bookshelf', 1, 2, 6, dx=0, dy=1).row('bookshelf', 1, 16, 7, dx=0, dy=1)
for y in (6, 10):
    r.row('bookshelf', 15, y, 8)
r.add('cafe_counter', 7, 7).add('globe', 6, 7).add('lamp_floor', 9, 7)
for tx, ty in [(6, 14), (11, 14), (6, 18), (11, 18)]:
    r.table_for_two(tx, ty, chair='armchair', table='cafe_table')
r.lounge(17, 15, 'armchair').lounge(17, 19, 'armchair')
r.add('rug_round', 21, 13).add('globe', 24, 22).add('plant_big', 24, 12).add('lamp_floor', 14, 22)
r.add('window_wall', 1, 9, 2).add('window_wall', 1, 13, 2)
r.worker('agata', 'Agata', 'LIBRARIAN', 's1.h3.hc9.sh11.p1.t2.f4.a1.b1', 8, 6, 4, 'book', 'tea')
r.walker('ugo', 'Ugo', 'GUEST', 's3.h9.hc9.sh7.p7.t3.f4.a1', 8, 16, 4)
r.walker('lia', 'Lia', 'GUEST', 's0.h8.hc8.sh4.p3.t1.f1.a0.b1', 19, 12, 4)

# ------------------------------------------------------------------ Terrazza

r = room(10, 'ROOFTOP', 'Terrazza sul tetto',
         'La citta'' di notte ai tuoi piedi: cocktail, braciere e lettini sotto le stelle.',
         26, 22, 11, 'wooddeck', 'skyline', 10)
r.add('bar_counter', 9, 4).add('bar_counter', 12, 4).row('bar_stool', 9, 5, 6, rot=6)
r.add('coffee_machine', 10, 1).add('plant_palm', 8, 1).add('plant_palm', 15, 1)
for cx, cy in [(6, 13), (18, 13)]:
    r.add('fire_pit', cx, cy)
    r.add('beanbag', cx - 1, cy, 0).add('beanbag', cx + 1, cy, 4).add('beanbag', cx, cy - 1, 2).add('beanbag', cx, cy + 1, 6)
for x in (5, 8, 11, 14, 17, 20):
    r.add('sunbed', x, 21, 6)
for x in (6, 12, 18):
    r.add('umbrella', x, 22)
r.lounge(21, 6, 'armchair')
r.add('plant_palm', 1, 1).add('plant_palm', 26, 1).add('plant_palm', 26, 22).add('lamp_floor', 1, 22)
r.add('lamp_floor', 12, 9).add('lamp_floor', 24, 17)
r.worker('nico', 'Nico', 'BARISTA', 's5.h0.hc7.sh8.p1.t3.f0.a2', 11, 3, 4, 'cocktail', 'bubble', 'juice')
r.walker('bea', 'Bea', 'GUEST', 's1.h2.hc4.sh1.p4.t4.f3.a2.b1', 16, 16, 5)
r.walker('ivo', 'Ivo', 'GUEST', 's2.h1.hc3.sh10.p0.t0.f1.a0', 7, 17, 4)

# ------------------------------------------------------------------ Spiaggia

r = room(11, 'BEACH', 'Spiaggia',
         'Sabbia calda, ombrelloni e il mare con le onde. Tuffati e nuota fino al largo!',
         31, 26, 6, 'sand', 'seaside', 11)
SHORE = 20  # prima colonna d'acqua
for y in range(1, 27):
    wet = SHORE - 1 - (1 if y % 7 in (2, 3, 4) else 0)
    for x in range(wet, SHORE):
        r.add('sea_foam', x, y)
for x in range(SHORE, 32, 2):
    for y in range(1, 27, 2):
        r.add('sea_water', x, y)
r.add('beach_bar', 8, 3).add('beach_bar', 11, 3).add('umbrella', 13, 3).add('palm_tree', 7, 1).add('palm_tree', 14, 1)
r.row('bar_stool', 8, 4, 4, rot=6)
for x, y in [(4, 10), (8, 10), (12, 10), (4, 15), (8, 15), (12, 15), (4, 21), (8, 21), (12, 21)]:
    r.add('beach_towel', x, y).add('umbrella', x + 1, y)
for y in (8, 11, 14, 17, 20, 23):
    r.add('sunbed', 16, y, 0)
r.add('lifeguard_chair', 17, 13)
r.add('volley_net', 4, 25).add('sand_castle', 11, 18).add('sand_castle', 15, 25).add('sand_castle', 2, 18)
r.add('palm_tree', 1, 1).add('palm_tree', 1, 12).add('palm_tree', 1, 26).add('palm_tree', 17, 1)
r.add('icecream_cart', 3, 1)
r.worker('sandro', 'Sandro', 'BARISTA', 's4.h1.hc4.sh10.p0.t0.f1.a2', 10, 2, 4, 'cocktail', 'juice', 'cola', 'gelato')
r.worker('marina', 'Marina', 'LIFEGUARD', 's1.h7.hc2.sh6.p5.t4.f2.a2.b1', 17, 15, 2)
r.walker('kai', 'Kai', 'GUEST', 's3.h5.hc4.sh2.p7.t4.f1.a0', 24, 12, 4)
r.walker('sole', 'Sole', 'GUEST', 's0.h8.hc5.sh10.p3.t4.f3.a2.b1', 10, 18, 5)
r.walker('tommy', 'Tommy', 'GUEST', 's2.h9.hc3.sh5.p0.t0.f5.a3', 7, 23, 4)

# ------------------------------------------------------------------ Edicola

r = room(12, 'NEWSSTAND', 'Edicola',
         'Fumetti, pacchetti di carte e il museo VinylDex: le carte piu\' belle esposte in vetrina.',
         20, 18, 9, 'marble', 'comics', 12)
# Banco dei pacchetti (si comprano qui e si aprono dalla borsa).
r.add('newsstand', 8, 4).add('pack_display', 7, 4).add('pack_display', 11, 4)
# Scaffali di fumetti lungo le pareti.
r.row('comic_shelf', 1, 1, 6).row('comic_shelf', 14, 1, 7).row('comic_shelf', 1, 2, 5, dx=0, dy=1)
r.row('comic_shelf', 1, 12, 6, dx=0, dy=1)
# Museo VinylDex: le carte con l'illustrazione vera, in vetrina e nei quadri.
MUSEUM = ['synth-001', 'showman-001', 'rebel-001', 'rebel-extra-001', 'showman-002', 'synth-002', 'synth-003', 'dreamer-004']
for i, (x, y) in enumerate([(13, 8), (15, 8), (17, 8), (19, 8), (13, 11), (15, 11), (17, 11), (19, 11)]):
    r.show('card_pedestal', x, y, MUSEUM[i])
for x, code in [(8, 'synth-004'), (10, 'synth-005'), (12, 'dreamer-005')]:
    r.show('card_frame', x, 1, code, 0)
r.add('bench', 13, 15, 0).add('bench', 17, 15, 0).add('lamp_floor', 12, 6).add('lamp_floor', 20, 6)
r.add('plant_big', 20, 18).add('plant_big', 1, 18).add('plant_big', 20, 13).add('cafe_table', 5, 8).add('chair_neon', 4, 8, 0)
r.worker('edo', 'Edo', 'NEWSAGENT', 's3.h1.hc9.sh4.p1.t2.f4.a1', 9, 3, 4)
r.walker('nando', 'Nando', 'GUEST', 's2.h0.hc2.sh9.p0.t0.f2.a0', 6, 13, 3)
r.walker('bianca', 'Bianca', 'GUEST', 's0.h3.hc6.sh1.p3.t1.f3.a5.b1', 16, 13, 3)

# ------------------------------------------------------------------ Cinema

r = room(13, 'CINEMA', 'Cinema',
         'Luci spente, popcorn e il grande schermo. Siediti in platea, il film sta per cominciare.',
         22, 22, 20, 'cinema', 'curtain', 13)
r.level(1, 11, 22, 14, 1)
r.level(1, 15, 22, 22, 2)
r.add('cinema_screen', 9, 1).add('speaker', 7, 1).add('speaker', 16, 1)
for y in (5, 7, 9, 12, 14, 16):
    r.row('cinema_seat', 4, y, 6).row('cinema_seat', 13, y, 6)
r.add('popcorn_machine', 20, 19).add('cafe_counter', 18, 19).add('lamp_floor', 22, 19)
r.add('plant_big', 22, 22).add('lamp_floor', 1, 1).add('lamp_floor', 22, 1)
for y in (4, 8, 12, 16):
    r.add('movie_poster', 1, y, 2)
r.add('movie_poster', 4, 1, 0).add('movie_poster', 19, 1, 0)
r.walker('mario', 'Mario', 'USHER', 's2.h9.hc0.sh8.p1.t2.f0.a0', 18, 21, 4, 'popcorn', 'cola')
r.walker('irene', 'Irene', 'GUEST', 's1.h6.hc4.sh11.p4.t1.f3.a2.b1', 11, 13, 5)
r.walker('fede', 'Fede', 'GUEST', 's3.h2.hc7.sh2.p0.t3.f1.a1', 11, 18, 4)

# ------------------------------------------------------------------ Palestra

r = room(14, 'GYM', 'Palestra',
         'Tapis roulant, sacchi da boxe e tappetini: Sara ti allena, l''acqua e'' sempre fresca.',
         24, 22, 11, 'rubber', 'mirror', 14)
r.row('treadmill', 5, 1, 7, dx=2).add('water_cooler', 20, 1).add('dumbbell_rack', 21, 1).add('plant_big', 24, 1)
r.row('punching_bag', 19, 7, 3, dx=2).row('punching_bag', 19, 11, 3, dx=2)
for y in (7, 11, 15):
    r.add('weight_bench', 5, y, 0).add('dumbbell_rack', 8, y)
for x in (13, 15, 17, 19, 21):
    r.add('yoga_mat', x, 17).add('yoga_mat', x, 20)
r.add('bench', 3, 21, 0).add('lamp_floor', 1, 22).add('plant_big', 24, 22).add('trophy', 1, 1)
r.add('chalkboard', 3, 1, 0).add('poster_neon', 1, 6, 2).add('poster_neon', 1, 17, 2)
r.walker('sara', 'Sara', 'TRAINER', 's1.h4.hc4.sh9.p1.t0.f5.a2.b1', 13, 11, 6, 'water')
r.walker('gino', 'Gino', 'GUEST', 's4.h9.hc7.sh6.p5.t0.f0.a0', 9, 18, 4)
r.walker('vale', 'Vale', 'GUEST', 's0.h7.hc1.sh6.p1.t0.f5.a3.b1', 17, 14, 4)


# ------------------------------------------------------------------ Stadio

r = room(15, 'STADIUM', 'Stadio',
         'Campo da calcio con le porte vere: passa sul pallone per calciarlo e segna! Blu contro Rossi, si arriva a 5.',
         35, 23, 2, 'pitch', 'stadium', 15)
# Campo dalla colonna 3 alla 33 e dalla riga 3 alla 21 (le righe del prato le disegna il
# pavimento "pitch"); intorno la pista. Porte fuori dalla linea di fondo, al centro.
r.add('football_goal', 2, 11).add('football_goal', 34, 11)
for x, y in [(2, 2), (34, 2), (2, 22), (34, 22)]:
    r.add('corner_flag', x, y)
for x, y in [(1, 1), (35, 1), (1, 23), (35, 23)]:
    r.add('floodlight', x, y)
# Panchine delle squadre e tribunetta lungo il lato alto, rivolte verso il campo.
for x in (5, 8, 11, 14, 21, 24, 27, 30):
    r.add('bench', x, 1, 0)
r.add('water_cooler', 18, 1).add('scoreboard', 17, 1, 0).add('scoreboard', 19, 1, 0)
r.walker('bomber', 'Bomber', 'FOOTBALLER', 's2.h9.hc0.sh3.p0.t0.f1.a0', 12, 8, 10)
r.walker('mago', 'Mago', 'FOOTBALLER', 's4.h1.hc4.sh3.p0.t0.f1.a0', 12, 16, 10)
r.walker('razzo', 'Razzo', 'FOOTBALLER', 's1.h0.hc2.sh6.p0.t0.f1.a0', 24, 8, 10)
r.walker('muro', 'Muro', 'FOOTBALLER', 's3.h9.hc7.sh6.p0.t0.f1.a0', 24, 16, 10)
r.walker('ultra', 'Ultra', 'GUEST', 's0.h3.hc6.sh1.p3.t1.f3.a5.b1', 16, 3, 4)
# I canestri a bordo campo (V18) sono passati al Palazzetto: la V19 li toglie dallo stadio.

# ------------------------------------------------------------------ Bowling

r = room(16, 'BOWLING', 'Bowling',
         'Dodici piste, luci al neon e il rumore dei birilli: prendi una palla e punta allo strike!',
         26, 20, 10, 'carpet', 'neon', 16)
# Piste verso chi guarda: si lancia dalla riga 3 e i birilli stanno in fondo alla pista, in primo
# piano. Dodici piste affiancate, dalla colonna 6 alla 17.
for x in range(6, 18):
    r.add('bowling_lane', x, 4, 0)
for x in (7, 10, 13, 16):
    r.add('bowling_rack', x, 2)
for x in (7, 11, 15):
    r.add('scoreboard', x, 1, 0)
# Divanetti davanti ai birilli per chi guarda, tavolini in mezzo.
for x in (7, 11, 15):
    r.add('sofa_vinyl', x, 15, 4).add('coffee_table', x, 17)
# Bar a destra, noleggio scarpe e giochi a sinistra.
r.add('bar_counter', 21, 3).row('bar_stool', 21, 4, 3, rot=6).add('coffee_machine', 25, 1).add('jukebox', 20, 1)
r.add('shoe_counter', 2, 16).add('arcade', 24, 20).add('arcade', 25, 20).add('claw_machine', 26, 20)
r.add('plant_big', 1, 1).add('plant_big', 26, 9).add('plant_big', 1, 20).add('lamp_neon', 19, 19).add('trophy', 4, 1)
r.add('neon_sign', 1, 6, 2).add('neon_sign', 1, 14, 2).add('poster_neon', 23, 1, 0)
r.worker('rita', 'Rita', 'BARISTA', 's0.h2.hc5.sh1.p3.t1.f3.a2.b1', 22, 2, 4, 'cola', 'juice', 'bubble')
r.worker('beppe', 'Beppe', 'RECEPTIONIST', 's3.h1.hc2.sh7.p1.t2.f0.a1', 2, 17, 0)
r.walker('strike', 'Strike', 'GUEST', 's2.h9.hc0.sh6.p0.t0.f1.a0', 20, 12, 4)
r.walker('lulu', 'Lulu', 'GUEST', 's1.h7.hc4.sh2.p4.t4.f2.a2.b1', 11, 13, 4)

# ------------------------------------------------------------------ Minigolf

r = room(17, 'MINIGOLF', 'Minigolf',
         'Sei buche all\'aperto tra siepi e fontane: mulino, ponticello, giro della morte... quanti colpi ti servono?',
         30, 24, 12, 'grass', 'hedge', 17)
for n, (x, y) in enumerate([(4, 3), (13, 3), (22, 3), (4, 19), (13, 19), (22, 19)], start=1):
    r.add(f'golf_hole_{n}', x, y)
r.add('fountain', 14, 11).add('bench', 6, 11, 0).add('bench', 22, 11, 0).add('icecream_cart', 2, 23)
for x, y in [(1, 1), (30, 1), (1, 15), (30, 15), (30, 24), (10, 8), (20, 8), (10, 16), (20, 16)]:
    r.add('flower_bed', x, y)
r.add('plant_palm', 11, 11).add('plant_palm', 18, 11).add('umbrella', 26, 11).add('lamp_floor', 28, 12)
r.worker('gigi', 'Gigi', 'ICE_CREAM', 's1.h0.hc3.sh7.p1.t2.f0.a0', 3, 22, 2, 'gelato')
r.walker('birdie', 'Birdie', 'GUEST', 's1.h6.hc1.sh5.p3.t1.f1.a2.b1', 16, 16, 5)
r.walker('par', 'Par', 'GUEST', 's4.h9.hc7.sh3.p0.t2.f0.a0', 12, 9, 5)


# ------------------------------------------------------------------ Palazzetto (basket)

r = room(18, 'BASKET', 'Palazzetto',
         'Campo da basket con il parquet e due canestri: prendi la palla e tira dalla lunetta!',
         30, 18, 2, 'court', 'arena', 18)
# Canestri alle due testate, rivolti verso il campo; si tira dalla lunetta, quattro caselle davanti.
r.add('basket_hoop', 2, 9, 2).add('basket_hoop', 29, 9, 6)
for x in (5, 8, 11, 18, 21, 24):
    r.add('bench', x, 1, 0)
r.add('water_cooler', 15, 1).add('scoreboard', 14, 1, 0).add('scoreboard', 16, 1, 0)
r.add('plant_big', 1, 18).add('plant_big', 30, 18).add('plant_big', 30, 1).add('trophy', 1, 1)
r.walker('tripla', 'Tripla', 'GUEST', 's3.h9.hc0.sh7.p0.t4.f1.a0', 10, 12, 5)
r.walker('schiacciata', 'Schiacciata', 'GUEST', 's5.h0.hc2.sh6.p0.t4.f1.a0', 20, 12, 5)
r.walker('tifosa', 'Tifosa', 'GUEST', 's0.h3.hc6.sh1.p3.t1.f3.a5.b1', 15, 3, 3)


# ------------------------------------------------------------------ output

def sql_string(s):
    return "'" + s.replace("'", "''") + "'"


def java_string(s):
    return '"' + s + '"'


def layout_sql(rm):
    rows = rm.layout()
    return " ||\n     ".join("E'" + row + ("\\n'" if i < len(rows) - 1 else "'") for i, row in enumerate(rows))


def insert_room(rm):
    return [
        'INSERT INTO rooms (id, owner_id, name, description, layout, door_x, door_y, door_dir,',
        '                   floor_style, wall_style, max_users, is_public, sort_order)',
        f'VALUES ({sql_string(rm.id)}, NULL, {sql_string(rm.name)},',
        f'     {sql_string(rm.desc)},',
        f'     {layout_sql(rm)},',
        f'     {rm.door[0]}, {rm.door[1]}, 2, {sql_string(rm.floor)}, {sql_string(rm.wall)}, 50, true, {rm.sort});',
    ]


def insert_items(rm, items, start=0):
    rows = []
    with_cards = any(start + k in rm.cards for k in range(len(items)))
    for i, (kind, x, y, rot) in enumerate(items, start=start + 1):
        item_id = f'00000000-0000-0000-0000-c0{rm.num:02x}{i:08x}'
        row = f"    ('{item_id}', NULL, '{rm.id}', {sql_string(kind)}, {x}, {y}, {rm.z(x, y)}, {rot}"
        if with_cards:
            code = rm.cards.get(i - 1)
            # La carta si cerca per code: in un database senza quella carta la vetrina resta vuota.
            row += f", (SELECT id FROM cards WHERE code = {sql_string(code)})" if code else ", NULL"
        rows.append(row + ')')
    columns = 'id, owner_id, room_id, furni_type, x, y, z, rot' + (', card_id' if with_cards else '')
    return [f'-- Arredi: {rm.name}.', f'INSERT INTO room_items ({columns}) VALUES', ',\n'.join(rows) + ';', '']


def main():
    preview = '--preview' in sys.argv
    failed = False
    for rm in ROOMS:
        errors = rm.check()
        if preview:
            print(rm.preview())
        if errors:
            failed = True
            print(f'!! {rm.name}:')
            for e in errors:
                print('   ', e)
    if failed:
        sys.exit(1)

    base_rooms = [rm for rm in ROOMS if rm.num not in LATER_MIGRATIONS]
    out = []
    out.append('-- Stanze pubbliche piu\' grandi, come i locali di Habbo, e quattro locali nuovi:')
    out.append('-- spiaggia, edicola, cinema e palestra. Pianta e arredi sono generati da')
    out.append('-- BE/scripts/hotel_rooms.py, che controlla anche che ogni casella sia raggiungibile.')
    out.append('')
    out.append('-- I pacchetti comprati in edicola finiscono nella borsa (user_pack_credits).')
    out.append('ALTER TABLE user_wallet_transactions DROP CONSTRAINT ck_wallet_tx_type;')
    out.append('ALTER TABLE user_wallet_transactions ADD CONSTRAINT ck_wallet_tx_type CHECK (type IN (')
    out.append("    'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',")
    out.append("    'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST',")
    out.append("    'FURNI_PURCHASE', 'PVP_REWARD', 'PACK_PURCHASE'));")
    out.append('')
    out.append('-- Gli arredi fissi delle stanze pubbliche si rifanno da capo.')
    ids = ', '.join(sql_string(rm.id) for rm in base_rooms if rm.num <= 10)
    out.append(f'DELETE FROM room_items WHERE owner_id IS NULL AND room_id IN ({ids});')
    out.append('')
    for rm in base_rooms:
        layout = " ||\n     ".join("E'" + row + ("\\n'" if i < len(rm.layout()) - 1 else "'")
                                    for i, row in enumerate(rm.layout()))
        if rm.num <= 10:
            out.append(f'UPDATE rooms SET layout =\n     {layout},')
            out.append(f'    door_x = {rm.door[0]}, door_y = {rm.door[1]}, door_dir = 2, max_users = 50,')
            out.append(f'    floor_style = {sql_string(rm.floor)}, wall_style = {sql_string(rm.wall)}')
            out.append(f'WHERE id = {sql_string(rm.id)};')
        else:
            out.extend(insert_room(rm))
        out.append('')
    for rm in base_rooms:
        out.extend(insert_items(rm, rm.published_items()))
    if os.path.exists(MIGRATION):
        print(f'Pubblicata, non si tocca: {os.path.normpath(MIGRATION)}.')
    else:
        with open(MIGRATION, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(out))
        print(f'Scritta {os.path.normpath(MIGRATION)}.')

    files = {}
    for path, removals in REMOVED.items():
        part = files.setdefault(path, [])
        for room_id, kind in removals:
            part.append(f'DELETE FROM room_items WHERE owner_id IS NULL AND room_id = {sql_string(room_id)} AND furni_type = {sql_string(kind)};')
        part.append('')
    for rm in ROOMS:
        if rm.num in REBUILT:
            part = files.setdefault(REBUILT[rm.num], [])
            part.append(f'-- {rm.name} rifatto: nuova pianta e nuovi arredi.')
            part.append(f'UPDATE rooms SET name = {sql_string(rm.name)}, description = {sql_string(rm.desc)},')
            part.append(f'    layout =\n     {layout_sql(rm)},')
            part.append(f'    door_x = {rm.door[0]}, door_y = {rm.door[1]}, door_dir = 2,')
            part.append(f'    floor_style = {sql_string(rm.floor)}, wall_style = {sql_string(rm.wall)}')
            part.append(f'WHERE id = {sql_string(rm.id)};')
            part.append(f'DELETE FROM room_items WHERE owner_id IS NULL AND room_id = {sql_string(rm.id)};')
            part.append('')
            part.extend(insert_items(rm, rm.items))
        elif rm.num in LATER_MIGRATIONS:
            part = files.setdefault(LATER_MIGRATIONS[rm.num], [])
            part.extend(insert_room(rm))
            part.append('')
            part.extend(insert_items(rm, rm.published_items()))
        if rm.split is not None:
            extra = files.setdefault(rm.split_migration, [])
            extra.extend(insert_items(rm, rm.items[rm.split:], start=rm.split))
    for path, lines in files.items():
        if path != CURRENT and os.path.exists(path):
            print(f'Pubblicata, non si tocca: {os.path.normpath(path)}.')
            continue
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join([f'-- {MIGRATION_TITLES[path]} Generata da BE/scripts/hotel_rooms.py.', ''] + lines))
        print(f'Scritta {os.path.normpath(path)}.')

    print('\n// ---- NpcRoster.java')
    for rm in ROOMS:
        print(f'            Map.entry({rm.key}, List.of(')
        lines = []
        for kind, key, name, role, look, x, y, extra, menu in rm.npcs:
            args = [java_string(key), java_string(name), f'Role.{role}', java_string(look), str(x), str(y), str(extra)]
            args += [java_string(m) for m in menu]
            lines.append(f'                    {kind}({", ".join(args)})')
        print(',\n'.join(lines) + ')),')


if __name__ == '__main__':
    main()
