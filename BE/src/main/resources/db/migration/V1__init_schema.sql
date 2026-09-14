-- ---------------------------------------------------------------------------
-- VinylDex - schema iniziale
--
-- Porta su Postgres lo schema che prima viveva in backend/prisma/schema.prisma.
-- Differenze volute rispetto a Prisma:
--   * tabelle e colonne in snake_case (convenzione Postgres/Spring), non PascalCase
--   * gli enum Prisma diventano varchar + CHECK: JPA li mappa con @Enumerated(STRING)
--     e aggiungere un valore resta una migrazione banale
--   * "group" e "number" sono parole scomode in SQL: la prima diventa card_group
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id                  uuid         PRIMARY KEY,
    username            varchar(50)  NOT NULL UNIQUE,
    email               varchar(255) NOT NULL UNIQUE,
    password_hash       varchar(255) NOT NULL,
    gold                integer      NOT NULL DEFAULT 150,
    xp                  integer      NOT NULL DEFAULT 0,
    level               integer      NOT NULL DEFAULT 1,
    role                varchar(20)  NOT NULL DEFAULT 'USER',
    avatar              varchar(50),
    banned              boolean      NOT NULL DEFAULT false,
    ban_reason          varchar(500),
    last_free_pack_at   timestamptz,
    last_login_date     date,
    login_streak        integer      NOT NULL DEFAULT 0,
    battles_won         integer      NOT NULL DEFAULT 0,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_role  CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT ck_users_gold  CHECK (gold >= 0),
    CONSTRAINT ck_users_xp    CHECK (xp >= 0),
    CONSTRAINT ck_users_level CHECK (level >= 1)
);
CREATE INDEX idx_users_email       ON users (email);
CREATE INDEX idx_users_username    ON users (username);
CREATE INDEX idx_users_battles_won ON users (battles_won);

CREATE TABLE artist_classes (
    id          uuid          PRIMARY KEY,
    name        varchar(100)  NOT NULL,
    slug        varchar(100)  NOT NULL UNIQUE,
    description varchar(1000),
    icon_url    varchar(500),
    created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE events (
    id                        uuid          PRIMARY KEY,
    code                      varchar(100)  NOT NULL UNIQUE,
    name                      varchar(255)  NOT NULL,
    description               varchar(1000),
    starts_at                 timestamptz,
    ends_at                   timestamptz,
    bonus_drop_rate_multiplier double precision NOT NULL DEFAULT 1,
    is_active                 boolean       NOT NULL DEFAULT true,
    created_at                timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_is_active ON events (is_active);

CREATE TABLE cards (
    id              uuid          PRIMARY KEY,
    code            varchar(255)  NOT NULL UNIQUE,
    name            varchar(255)  NOT NULL,
    artist_class_id uuid,
    variant         varchar(100),
    card_group      varchar(255),
    rarity          varchar(50)   NOT NULL,
    img_url         varchar(1000),
    full_image      boolean       NOT NULL DEFAULT false,
    fans            integer       NOT NULL DEFAULT 0,
    style           integer       NOT NULL DEFAULT 0,
    influence       integer       NOT NULL DEFAULT 0,
    energy          integer       NOT NULL DEFAULT 0,
    description     varchar(4000),
    is_active       boolean       NOT NULL DEFAULT true,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    source          varchar(50)   NOT NULL DEFAULT 'original',
    external_id     varchar(255),
    set_name        varchar(255),
    set_code        varchar(100),
    number          varchar(50),
    metadata        jsonb,
    CONSTRAINT fk_cards_artist_class FOREIGN KEY (artist_class_id) REFERENCES artist_classes (id),
    CONSTRAINT uk_cards_source_external_id UNIQUE (source, external_id)
);
CREATE INDEX idx_cards_code      ON cards (code);
CREATE INDEX idx_cards_rarity    ON cards (rarity);
CREATE INDEX idx_cards_source    ON cards (source);
CREATE INDEX idx_cards_is_active ON cards (is_active);

CREATE TABLE user_cards (
    id          uuid        PRIMARY KEY,
    user_id     uuid        NOT NULL,
    card_id     uuid        NOT NULL,
    obtained_at timestamptz NOT NULL DEFAULT now(),
    is_favorite boolean     NOT NULL DEFAULT false,
    quantity    integer     NOT NULL DEFAULT 1,
    CONSTRAINT fk_user_cards_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_cards_card FOREIGN KEY (card_id) REFERENCES cards (id),
    CONSTRAINT uk_user_cards_user_card UNIQUE (user_id, card_id),
    CONSTRAINT ck_user_cards_quantity CHECK (quantity >= 0)
);
CREATE INDEX idx_user_cards_user ON user_cards (user_id);

CREATE TABLE user_pack_credits (
    id        uuid         PRIMARY KEY,
    user_id   uuid         NOT NULL,
    pack_code varchar(100) NOT NULL,
    quantity  integer      NOT NULL DEFAULT 0,
    CONSTRAINT fk_user_pack_credits_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uk_user_pack_credits UNIQUE (user_id, pack_code),
    CONSTRAINT ck_user_pack_credits_quantity CHECK (quantity >= 0)
);

CREATE TABLE packs (
    id                  uuid          PRIMARY KEY,
    code                varchar(100)  NOT NULL UNIQUE,
    name                varchar(255)  NOT NULL,
    description         varchar(1000),
    price_gold          integer       NOT NULL,
    card_count          integer       NOT NULL,
    is_free             boolean       NOT NULL DEFAULT false,
    free_cooldown_hours integer       NOT NULL DEFAULT 0,
    img_url             varchar(1000),
    is_active           boolean       NOT NULL DEFAULT true,
    event_id            uuid,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT fk_packs_event FOREIGN KEY (event_id) REFERENCES events (id),
    CONSTRAINT ck_packs_price      CHECK (price_gold >= 0),
    CONSTRAINT ck_packs_card_count CHECK (card_count > 0)
);

CREATE TABLE pack_drop_rates (
    id      uuid             PRIMARY KEY,
    pack_id uuid             NOT NULL,
    rarity  varchar(50)      NOT NULL,
    weight  double precision NOT NULL,
    CONSTRAINT fk_pack_drop_rates_pack FOREIGN KEY (pack_id) REFERENCES packs (id),
    CONSTRAINT uk_pack_drop_rates UNIQUE (pack_id, rarity),
    CONSTRAINT ck_pack_drop_rates_weight CHECK (weight >= 0)
);

CREATE TABLE pack_guarantees (
    id      uuid        PRIMARY KEY,
    pack_id uuid        NOT NULL,
    rarity  varchar(50) NOT NULL,
    count   integer     NOT NULL,
    CONSTRAINT fk_pack_guarantees_pack FOREIGN KEY (pack_id) REFERENCES packs (id),
    CONSTRAINT uk_pack_guarantees UNIQUE (pack_id, rarity),
    CONSTRAINT ck_pack_guarantees_count CHECK (count >= 0)
);

CREATE TABLE pack_openings (
    id         uuid        PRIMARY KEY,
    user_id    uuid        NOT NULL,
    pack_id    uuid        NOT NULL,
    mode       varchar(20) NOT NULL DEFAULT 'PAID',
    gold_spent integer     NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_pack_openings_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_pack_openings_pack FOREIGN KEY (pack_id) REFERENCES packs (id),
    CONSTRAINT ck_pack_openings_mode CHECK (mode IN ('PAID', 'FREE', 'GIFT'))
);
CREATE INDEX idx_pack_openings_user ON pack_openings (user_id);

CREATE TABLE pack_opening_cards (
    id              uuid        PRIMARY KEY,
    pack_opening_id uuid        NOT NULL,
    card_id         uuid        NOT NULL,
    rarity          varchar(50) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_pack_opening_cards_opening FOREIGN KEY (pack_opening_id) REFERENCES pack_openings (id),
    CONSTRAINT fk_pack_opening_cards_card    FOREIGN KEY (card_id) REFERENCES cards (id)
);
CREATE INDEX idx_pack_opening_cards_opening ON pack_opening_cards (pack_opening_id);

CREATE TABLE market_listings (
    id             uuid        PRIMARY KEY,
    seller_id      uuid        NOT NULL,
    card_id        uuid        NOT NULL,
    quantity       integer     NOT NULL,
    price_per_unit integer     NOT NULL,
    status         varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_market_listings_seller FOREIGN KEY (seller_id) REFERENCES users (id),
    CONSTRAINT fk_market_listings_card   FOREIGN KEY (card_id) REFERENCES cards (id),
    CONSTRAINT ck_market_listings_status   CHECK (status IN ('ACTIVE', 'SOLD', 'CANCELLED')),
    CONSTRAINT ck_market_listings_quantity CHECK (quantity >= 0),
    CONSTRAINT ck_market_listings_price    CHECK (price_per_unit > 0)
);
CREATE INDEX idx_market_listings_status ON market_listings (status);
CREATE INDEX idx_market_listings_seller ON market_listings (seller_id);
CREATE INDEX idx_market_listings_card   ON market_listings (card_id);

CREATE TABLE trades (
    id             uuid        PRIMARY KEY,
    from_user_id   uuid        NOT NULL,
    to_user_id     uuid        NOT NULL,
    status         varchar(20) NOT NULL DEFAULT 'PENDING',
    offered_gold   integer     NOT NULL DEFAULT 0,
    requested_gold integer     NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_trades_from_user FOREIGN KEY (from_user_id) REFERENCES users (id),
    CONSTRAINT fk_trades_to_user   FOREIGN KEY (to_user_id) REFERENCES users (id),
    CONSTRAINT ck_trades_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_trades_gold   CHECK (offered_gold >= 0 AND requested_gold >= 0),
    CONSTRAINT ck_trades_distinct_users CHECK (from_user_id <> to_user_id)
);
CREATE INDEX idx_trades_from_user ON trades (from_user_id);
CREATE INDEX idx_trades_to_user   ON trades (to_user_id);
CREATE INDEX idx_trades_status    ON trades (status);

CREATE TABLE trade_items (
    id        uuid        PRIMARY KEY,
    trade_id  uuid        NOT NULL,
    card_id   uuid        NOT NULL,
    quantity  integer     NOT NULL,
    direction varchar(20) NOT NULL,
    CONSTRAINT fk_trade_items_trade FOREIGN KEY (trade_id) REFERENCES trades (id),
    CONSTRAINT fk_trade_items_card  FOREIGN KEY (card_id) REFERENCES cards (id),
    CONSTRAINT ck_trade_items_direction CHECK (direction IN ('OFFERED', 'REQUESTED')),
    CONSTRAINT ck_trade_items_quantity  CHECK (quantity > 0)
);
CREATE INDEX idx_trade_items_trade ON trade_items (trade_id);

CREATE TABLE user_wallet_transactions (
    id            uuid         PRIMARY KEY,
    user_id       uuid         NOT NULL,
    amount        integer      NOT NULL,
    type          varchar(40)  NOT NULL,
    balance_after integer      NOT NULL,
    related_id    varchar(100),
    note          varchar(500),
    created_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT ck_wallet_tx_type CHECK (type IN (
        'PACK_OPEN_PAID', 'PACK_OPEN_FREE', 'MARKET_SALE', 'MARKET_PURCHASE', 'TRADE',
        'MISSION_REWARD', 'LEVEL_REWARD', 'ALBUM_REWARD', 'DAILY_LOGIN', 'BATTLE_REWARD', 'ADMIN_ADJUST'))
);
CREATE INDEX idx_wallet_tx_user    ON user_wallet_transactions (user_id);
CREATE INDEX idx_wallet_tx_created ON user_wallet_transactions (created_at);

CREATE TABLE external_card_sources (
    id               uuid         PRIMARY KEY,
    source           varchar(50)  NOT NULL UNIQUE,
    last_imported_at timestamptz,
    total_imported   integer      NOT NULL DEFAULT 0,
    last_error       varchar(2000),
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE missions (
    id           uuid          PRIMARY KEY,
    code         varchar(100)  NOT NULL UNIQUE,
    title        varchar(255)  NOT NULL,
    description  varchar(1000),
    type         varchar(50)   NOT NULL,
    target_value integer       NOT NULL,
    reward_gold  integer       NOT NULL DEFAULT 0,
    reward_xp    integer       NOT NULL DEFAULT 0,
    reward_pack  varchar(100),
    is_daily     boolean       NOT NULL DEFAULT false,
    is_active    boolean       NOT NULL DEFAULT true,
    event_id     uuid,
    metadata     jsonb,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT fk_missions_event FOREIGN KEY (event_id) REFERENCES events (id),
    CONSTRAINT ck_missions_target CHECK (target_value > 0)
);
CREATE INDEX idx_missions_is_active ON missions (is_active);

CREATE TABLE user_missions (
    id           uuid        PRIMARY KEY,
    user_id      uuid        NOT NULL,
    mission_id   uuid        NOT NULL,
    progress     integer     NOT NULL DEFAULT 0,
    completed    boolean     NOT NULL DEFAULT false,
    claimed      boolean     NOT NULL DEFAULT false,
    started_at   timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT fk_user_missions_user    FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_missions_mission FOREIGN KEY (mission_id) REFERENCES missions (id),
    CONSTRAINT uk_user_missions UNIQUE (user_id, mission_id),
    CONSTRAINT ck_user_missions_progress CHECK (progress >= 0)
);
CREATE INDEX idx_user_missions_user ON user_missions (user_id);

CREATE TABLE albums (
    id            uuid          PRIMARY KEY,
    code          varchar(100)  NOT NULL UNIQUE,
    name          varchar(255)  NOT NULL,
    description   varchar(1000),
    cover_img_url varchar(1000),
    is_active     boolean       NOT NULL DEFAULT true,
    created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE album_cards (
    id       uuid PRIMARY KEY,
    album_id uuid NOT NULL,
    card_id  uuid NOT NULL,
    CONSTRAINT fk_album_cards_album FOREIGN KEY (album_id) REFERENCES albums (id),
    CONSTRAINT fk_album_cards_card  FOREIGN KEY (card_id) REFERENCES cards (id),
    CONSTRAINT uk_album_cards UNIQUE (album_id, card_id)
);
