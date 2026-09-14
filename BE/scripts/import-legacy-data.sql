-- ---------------------------------------------------------------------------
-- Travaso dei dati da Supabase al database locale FS0226IT-CAPSTONE.
--
-- Presupposto: il dump di Supabase e' gia' stato ripristinato nello schema "legacy"
-- di questo stesso database (vedi BE/scripts/migrate-from-supabase.sh) e Flyway ha
-- gia' creato lo schema nuovo.
--
-- Il dump conserva i nomi di Prisma: tabelle PascalCase fra virgolette e colonne
-- camelCase. Qui vengono tradotti nello schema snake_case definito in V1.
--
-- Lo script e' rieseguibile: ON CONFLICT DO NOTHING salta le righe gia' presenti.
-- L'ordine delle INSERT rispetta le chiavi esterne, quindi non va cambiato.
-- ---------------------------------------------------------------------------

BEGIN;

-- Gli id di Prisma sono testo che contiene UUID validi: il cast e' sicuro.
INSERT INTO users (id, username, email, password_hash, gold, xp, level, role, avatar,
                   banned, ban_reason, last_free_pack_at, last_login_date,
                   login_streak, battles_won, created_at, updated_at)
SELECT u.id::uuid,
       u."username",
       u."email",
       u."passwordHash",
       u."gold",
       u."xp",
       u."level",
       u."role"::text,
       u."avatar",
       u."banned",
       LEFT(u."banReason", 500),
       u."lastFreePackAt",
       u."lastLoginDate"::date,
       u."loginStreak",
       u."battlesWon",
       u."createdAt",
       u."updatedAt"
FROM legacy."User" u
ON CONFLICT (id) DO NOTHING;

INSERT INTO artist_classes (id, name, slug, description, icon_url, created_at)
SELECT a.id::uuid, a."name", a."slug", LEFT(a."description", 1000), a."iconUrl", a."createdAt"
FROM legacy."ArtistClass" a
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, code, name, description, starts_at, ends_at,
                    bonus_drop_rate_multiplier, is_active, created_at)
SELECT e.id::uuid, e."code", e."name", LEFT(e."description", 1000),
       e."startsAt", e."endsAt", e."bonusDropRateMultiplier", e."isActive", e."createdAt"
FROM legacy."Event" e
ON CONFLICT (id) DO NOTHING;

-- "group" diventa card_group: e' parola riservata in SQL.
INSERT INTO cards (id, code, name, artist_class_id, variant, card_group, rarity, img_url,
                   full_image, fans, style, influence, energy, description, is_active,
                   created_at, source, external_id, set_name, set_code, number, metadata)
SELECT c.id::uuid,
       c."code",
       LEFT(c."name", 255),
       c."artistClassId"::uuid,
       LEFT(c."variant", 100),
       LEFT(c."group", 255),
       c."rarity",
       LEFT(c."imgUrl", 1000),
       c."fullImage",
       c."fans",
       c."style",
       c."influence",
       c."energy",
       LEFT(c."description", 4000),
       c."isActive",
       c."createdAt",
       c."source",
       c."externalId",
       LEFT(c."setName", 255),
       LEFT(c."setCode", 100),
       LEFT(c."number", 50),
       c."metadata"
FROM legacy."Card" c
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_cards (id, user_id, card_id, obtained_at, is_favorite, quantity)
SELECT uc.id::uuid, uc."userId"::uuid, uc."cardId"::uuid,
       uc."obtainedAt", uc."isFavorite", GREATEST(uc."quantity", 0)
FROM legacy."UserCard" uc
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_pack_credits (id, user_id, pack_code, quantity)
SELECT pc.id::uuid, pc."userId"::uuid, pc."packCode", GREATEST(pc."quantity", 0)
FROM legacy."UserPackCredit" pc
ON CONFLICT (id) DO NOTHING;

INSERT INTO packs (id, code, name, description, price_gold, card_count, is_free,
                   free_cooldown_hours, img_url, is_active, event_id, created_at)
SELECT p.id::uuid, p."code", p."name", LEFT(p."description", 1000), p."priceGold",
       p."cardCount", p."isFree", p."freeCooldownHours", LEFT(p."imgUrl", 1000),
       p."isActive", p."eventId"::uuid, p."createdAt"
FROM legacy."Pack" p
ON CONFLICT (id) DO NOTHING;

INSERT INTO pack_drop_rates (id, pack_id, rarity, weight)
SELECT d.id::uuid, d."packId"::uuid, d."rarity", d."weight"
FROM legacy."PackDropRate" d
ON CONFLICT (id) DO NOTHING;

INSERT INTO pack_guarantees (id, pack_id, rarity, count)
SELECT g.id::uuid, g."packId"::uuid, g."rarity", g."count"
FROM legacy."PackGuarantee" g
ON CONFLICT (id) DO NOTHING;

INSERT INTO pack_openings (id, user_id, pack_id, mode, gold_spent, created_at)
SELECT o.id::uuid, o."userId"::uuid, o."packId"::uuid, o."mode"::text, o."goldSpent", o."createdAt"
FROM legacy."PackOpening" o
ON CONFLICT (id) DO NOTHING;

INSERT INTO pack_opening_cards (id, pack_opening_id, card_id, rarity, created_at)
SELECT oc.id::uuid, oc."packOpeningId"::uuid, oc."cardId"::uuid, oc."rarity", oc."createdAt"
FROM legacy."PackOpeningCard" oc
ON CONFLICT (id) DO NOTHING;

INSERT INTO market_listings (id, seller_id, card_id, quantity, price_per_unit, status,
                             created_at, updated_at)
SELECT l.id::uuid, l."sellerId"::uuid, l."cardId"::uuid, GREATEST(l."quantity", 0),
       l."pricePerUnit", l."status"::text, l."createdAt", l."updatedAt"
FROM legacy."MarketListing" l
ON CONFLICT (id) DO NOTHING;

-- Il vincolo ck_trades_distinct_users rifiuta gli scambi con se stessi: nel backend Node
-- erano gia' vietati, quindi nel dump non dovrebbero esistercene. Se la INSERT si ferma qui,
-- controllare i dati invece di allentare il vincolo.
INSERT INTO trades (id, from_user_id, to_user_id, status, offered_gold, requested_gold,
                    created_at, updated_at)
SELECT t.id::uuid, t."fromUserId"::uuid, t."toUserId"::uuid, t."status"::text,
       t."offeredGold", t."requestedGold", t."createdAt", t."updatedAt"
FROM legacy."Trade" t
WHERE t."fromUserId" <> t."toUserId"
ON CONFLICT (id) DO NOTHING;

INSERT INTO trade_items (id, trade_id, card_id, quantity, direction)
SELECT ti.id::uuid, ti."tradeId"::uuid, ti."cardId"::uuid, ti."quantity", ti."direction"::text
FROM legacy."TradeItem" ti
WHERE ti."quantity" > 0
  AND EXISTS (SELECT 1 FROM trades tr WHERE tr.id = ti."tradeId"::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_wallet_transactions (id, user_id, amount, type, balance_after,
                                      related_id, note, created_at)
SELECT w.id::uuid, w."userId"::uuid, w."amount", w."type"::text, w."balanceAfter",
       LEFT(w."relatedId", 100), LEFT(w."note", 500), w."createdAt"
FROM legacy."UserWalletTransaction" w
ON CONFLICT (id) DO NOTHING;

INSERT INTO external_card_sources (id, source, last_imported_at, total_imported,
                                   last_error, created_at, updated_at)
SELECT s.id::uuid, s."source", s."lastImportedAt", s."totalImported",
       LEFT(s."lastError", 2000), s."createdAt", s."updatedAt"
FROM legacy."ExternalCardSource" s
ON CONFLICT (id) DO NOTHING;

INSERT INTO missions (id, code, title, description, type, target_value, reward_gold,
                      reward_xp, reward_pack, is_daily, is_active, event_id, metadata, created_at)
SELECT m.id::uuid, m."code", m."title", LEFT(m."description", 1000), m."type",
       m."targetValue", m."rewardGold", m."rewardXp", m."rewardPack", m."isDaily",
       m."isActive", m."eventId"::uuid, m."metadata", m."createdAt"
FROM legacy."Mission" m
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_missions (id, user_id, mission_id, progress, completed, claimed,
                           started_at, completed_at)
SELECT um.id::uuid, um."userId"::uuid, um."missionId"::uuid, GREATEST(um."progress", 0),
       um."completed", um."claimed", um."startedAt", um."completedAt"
FROM legacy."UserMission" um
ON CONFLICT (id) DO NOTHING;

INSERT INTO albums (id, code, name, description, cover_img_url, is_active, created_at)
SELECT a.id::uuid, a."code", a."name", LEFT(a."description", 1000),
       LEFT(a."coverImgUrl", 1000), a."isActive", a."createdAt"
FROM legacy."Album" a
ON CONFLICT (id) DO NOTHING;

INSERT INTO album_cards (id, album_id, card_id)
SELECT ac.id::uuid, ac."albumId"::uuid, ac."cardId"::uuid
FROM legacy."AlbumCard" ac
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Confronto riga per riga fra origine e destinazione: i due conteggi devono coincidere.
SELECT 'users' AS tabella,
       (SELECT count(*) FROM legacy."User") AS legacy,
       (SELECT count(*) FROM users) AS nuovo
UNION ALL SELECT 'artist_classes', (SELECT count(*) FROM legacy."ArtistClass"), (SELECT count(*) FROM artist_classes)
UNION ALL SELECT 'events', (SELECT count(*) FROM legacy."Event"), (SELECT count(*) FROM events)
UNION ALL SELECT 'cards', (SELECT count(*) FROM legacy."Card"), (SELECT count(*) FROM cards)
UNION ALL SELECT 'user_cards', (SELECT count(*) FROM legacy."UserCard"), (SELECT count(*) FROM user_cards)
UNION ALL SELECT 'user_pack_credits', (SELECT count(*) FROM legacy."UserPackCredit"), (SELECT count(*) FROM user_pack_credits)
UNION ALL SELECT 'packs', (SELECT count(*) FROM legacy."Pack"), (SELECT count(*) FROM packs)
UNION ALL SELECT 'pack_drop_rates', (SELECT count(*) FROM legacy."PackDropRate"), (SELECT count(*) FROM pack_drop_rates)
UNION ALL SELECT 'pack_guarantees', (SELECT count(*) FROM legacy."PackGuarantee"), (SELECT count(*) FROM pack_guarantees)
UNION ALL SELECT 'pack_openings', (SELECT count(*) FROM legacy."PackOpening"), (SELECT count(*) FROM pack_openings)
UNION ALL SELECT 'pack_opening_cards', (SELECT count(*) FROM legacy."PackOpeningCard"), (SELECT count(*) FROM pack_opening_cards)
UNION ALL SELECT 'market_listings', (SELECT count(*) FROM legacy."MarketListing"), (SELECT count(*) FROM market_listings)
UNION ALL SELECT 'trades', (SELECT count(*) FROM legacy."Trade"), (SELECT count(*) FROM trades)
UNION ALL SELECT 'trade_items', (SELECT count(*) FROM legacy."TradeItem"), (SELECT count(*) FROM trade_items)
UNION ALL SELECT 'user_wallet_transactions', (SELECT count(*) FROM legacy."UserWalletTransaction"), (SELECT count(*) FROM user_wallet_transactions)
UNION ALL SELECT 'external_card_sources', (SELECT count(*) FROM legacy."ExternalCardSource"), (SELECT count(*) FROM external_card_sources)
UNION ALL SELECT 'missions', (SELECT count(*) FROM legacy."Mission"), (SELECT count(*) FROM missions)
UNION ALL SELECT 'user_missions', (SELECT count(*) FROM legacy."UserMission"), (SELECT count(*) FROM user_missions)
UNION ALL SELECT 'albums', (SELECT count(*) FROM legacy."Album"), (SELECT count(*) FROM albums)
UNION ALL SELECT 'album_cards', (SELECT count(*) FROM legacy."AlbumCard"), (SELECT count(*) FROM album_cards);
