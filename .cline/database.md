# VinylDex — Database Schema

> **Ultimo aggiornamento:** 06/06/2026
> **Stato corrente:** MVP usa LocalStorage (client-side). Schema PostgreSQL pianificato per il backend.

## Stato Attuale (MVP — LocalStorage)

### Struttura dati salvata in LocalStorage

Tutti i dati usano il prefisso `vinylDex_` per isolamento.

#### `vinylDex_collection`
```json
[
  {
    "id": "showman-001",
    "name": "Royal Echo",
    "artistClass": "The Showman",
    "variant": "Royal Echo",
    "rarity": "legendary",
    "img": "showman-royal-echo.png",
    "stats": { "fans": 95, "style": 92, "influence": 88, "energy": 78 },
    "description": "Il re dei palchi...",
    "obtainedAt": 1717600000000
  }
]
```

#### `vinylDex_gold`
```json
150
```

#### `vinylDex_xp`
```json
320
```

#### `vinylDex_level`
```json
3
```

#### `vinylDex_lastFreePack`
```json
1717600000000
```

#### `vinylDex_stats`
```json
{
  "totalPacksOpened": 12,
  "totalCardsObtained": 58,
  "legendaryCount": 2,
  "epicCount": 5,
  "rareCount": 12,
  "uncommonCount": 18,
  "commonCount": 21
}
```

---

## Schema PostgreSQL (Pianificato per Backend)

### `users`
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  gold          INTEGER DEFAULT 0,
  xp            INTEGER DEFAULT 0,
  level         INTEGER DEFAULT 1,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  last_free_pack_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

### `artist_classes`
```sql
CREATE TABLE artist_classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,       -- "The Showman", "The Rebel", ecc.
  slug        VARCHAR(100) UNIQUE NOT NULL,  -- "the-showman"
  description TEXT,
  icon_url    VARCHAR(500),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### `cards`
```sql
CREATE TABLE cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) UNIQUE NOT NULL,  -- "showman-001"
  name            VARCHAR(100) NOT NULL,        -- "Royal Echo"
  artist_class_id UUID REFERENCES artist_classes(id),
  variant         VARCHAR(100),                 -- "Royal Echo"
  rarity          VARCHAR(20) NOT NULL,          -- "common", "uncommon", "rare", "epic", "legendary"
  img_url         VARCHAR(500),
  fans            INTEGER DEFAULT 0,
  style           INTEGER DEFAULT 0,
  influence       INTEGER DEFAULT 0,
  energy          INTEGER DEFAULT 0,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_class ON cards(artist_class_id);
CREATE INDEX idx_cards_code ON cards(code);
```

### `user_cards` (collezione)
```sql
CREATE TABLE user_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id     UUID REFERENCES cards(id) ON DELETE CASCADE,
  obtained_at TIMESTAMP DEFAULT NOW(),
  is_favorite BOOLEAN DEFAULT false,
  quantity    INTEGER DEFAULT 1,

  UNIQUE(user_id, card_id)
);

CREATE INDEX idx_user_cards_user ON user_cards(user_id);
CREATE INDEX idx_user_cards_card ON user_cards(card_id);
```

### `packs`
```sql
CREATE TABLE packs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50) UNIQUE NOT NULL,   -- "pack-base", "pack-deluxe", "pack-premium"
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  price_gold    INTEGER NOT NULL,
  card_count    INTEGER NOT NULL,
  is_free       BOOLEAN DEFAULT false,
  free_cooldown_hours INTEGER DEFAULT 0,       -- 4 per il pacchetto base
  img_url       VARCHAR(500),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### `pack_drop_rates`
```sql
CREATE TABLE pack_drop_rates (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id   UUID REFERENCES packs(id) ON DELETE CASCADE,
  rarity    VARCHAR(20) NOT NULL,
  weight    DECIMAL(5,4) NOT NULL,              -- 0.5000, 0.3000, ecc.

  UNIQUE(pack_id, rarity)
);
```

### `pack_guarantees`
```sql
CREATE TABLE pack_guarantees (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id   UUID REFERENCES packs(id) ON DELETE CASCADE,
  rarity    VARCHAR(20) NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,

  UNIQUE(pack_id, rarity)
);
```

### `battles` (PvP)
```sql
CREATE TABLE battles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id      UUID REFERENCES users(id),
  player2_id      UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'waiting',  -- "waiting", "in_progress", "finished"
  winner_id       UUID REFERENCES users(id),
  current_round   INTEGER DEFAULT 1,
  max_rounds      INTEGER DEFAULT 3,
  player1_score   INTEGER DEFAULT 0,
  player2_score   INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  finished_at     TIMESTAMP
);

CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_player1 ON battles(player1_id);
CREATE INDEX idx_battles_player2 ON battles(player2_id);
```

### `battle_rounds`
```sql
CREATE TABLE battle_rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id     UUID REFERENCES battles(id) ON DELETE CASCADE,
  round_number  INTEGER NOT NULL,
  category      VARCHAR(50) NOT NULL,            -- "fans", "style", "influence", "energy"
  card1_id      UUID REFERENCES cards(id),
  card2_id      UUID REFERENCES cards(id),
  score1        INTEGER,
  score2        INTEGER,
  winner_id     UUID REFERENCES users(id),
  special_used  BOOLEAN DEFAULT false,

  UNIQUE(battle_id, round_number)
);
```

### `missions`
```sql
CREATE TABLE missions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50) UNIQUE NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  type          VARCHAR(50) NOT NULL,             -- "open_packs", "collect_cards", "win_battles", ecc.
  target_value  INTEGER NOT NULL,                 -- Quante volte
  reward_gold   INTEGER DEFAULT 0,
  reward_xp     INTEGER DEFAULT 0,
  reward_pack   VARCHAR(50),                      -- pack code opzionale
  is_daily      BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### `user_missions`
```sql
CREATE TABLE user_missions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  mission_id  UUID REFERENCES missions(id) ON DELETE CASCADE,
  progress    INTEGER DEFAULT 0,
  completed   BOOLEAN DEFAULT false,
  claimed     BOOLEAN DEFAULT false,
  started_at  TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  UNIQUE(user_id, mission_id)
);
```

## Relazioni (ER Summary)

```
users 1──N user_cards N──1 cards
users 1──N battles (as player1)
users 1──N battles (as player2)
users 1──N user_missions N──1 missions
packs 1──N pack_drop_rates
packs 1──N pack_guarantees
cards N──1 artist_classes
battles 1──N battle_rounds
```

## Note Migrazione

- Quando verrà implementato il backend, i dati in LocalStorage dovranno essere migrati al DB remoto
- Prevedere un endpoint `POST /api/migrate` per importare la collezione esistente
- Mantenere un flag `is_migrated` sul profilo utente per evitare duplicati
- I placeholder SVG nelle carte (`img_url`) verranno sostituiti con URL reali (S3/Cloudinary)