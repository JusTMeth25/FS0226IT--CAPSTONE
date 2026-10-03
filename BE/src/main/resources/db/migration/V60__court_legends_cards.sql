-- Court Legends: le carte VinylDex di basket (21 carte, 12 classi nuove), originali come le altre.
-- Le carte con l'immagine pronta si mostrano intere (full_image); le altre restano con la cornice
-- generica finche' non arrivano i loro disegni, che si aggiungeranno con una migrazione nuova.

INSERT INTO artist_classes (id, name, slug) VALUES
    (gen_random_uuid(), 'The Closer', 'the-closer'),
    (gen_random_uuid(), 'The Enforcer', 'the-enforcer'),
    (gen_random_uuid(), 'The High Flyer', 'the-high-flyer'),
    (gen_random_uuid(), 'The Lockdown', 'the-lockdown'),
    (gen_random_uuid(), 'The MVP', 'the-mvp'),
    (gen_random_uuid(), 'The Playmaker', 'the-playmaker'),
    (gen_random_uuid(), 'The Rebounder', 'the-rebounder'),
    (gen_random_uuid(), 'The Rookie', 'the-rookie'),
    (gen_random_uuid(), 'The Sniper', 'the-sniper'),
    (gen_random_uuid(), 'The Speedster', 'the-speedster'),
    (gen_random_uuid(), 'The Street Baller', 'the-street-baller'),
    (gen_random_uuid(), 'The Titan', 'the-titan')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO cards (id, code, name, artist_class_id, variant, card_group, rarity, img_url, full_image,
                   fans, style, influence, energy, description, is_active, source)
SELECT gen_random_uuid(), 'court-legendary-001', 'Sky Breaker', (SELECT id FROM artist_classes WHERE slug = 'the-mvp'),
       'Sky Breaker', 'Court Legends', 'legendary', '/assets/img/SkyBreaker.webp', true,
       94, 91, 88, 96, 'Regina del parquet. Ogni salto sfida il cielo, ogni schiacciata accende l''arena.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-legendary-002', 'Iron Dunk', (SELECT id FROM artist_classes WHERE slug = 'the-titan'),
       'Iron Dunk', 'Court Legends', 'legendary', '/assets/img/IronDunk.webp', true,
       93, 87, 89, 97, 'Dominatore del ferro. Ogni schiacciata scuote l''arena e lascia il pubblico senza fiato.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-legendary-003', 'Phantom Handles', (SELECT id FROM artist_classes WHERE slug = 'the-playmaker'),
       'Phantom Handles', 'Court Legends', 'legendary', NULL, false,
       91, 99, 90, 91, 'Il pallone scompare tra le sue mani. Ogni palleggio inganna gli occhi e riscrive il gioco.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-legendary-004', 'Zero Gravity', (SELECT id FROM artist_classes WHERE slug = 'the-high-flyer'),
       'Zero Gravity', 'Court Legends', 'legendary', NULL, false,
       97, 95, 86, 94, 'La gravità è soltanto una regola da infrangere. In aria, il campo appartiene a lui.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-legendary-005', 'Final Shot', (SELECT id FROM artist_classes WHERE slug = 'the-closer'),
       'Final Shot', 'Court Legends', 'legendary', NULL, false,
       96, 89, 95, 90, 'Quando il tempo sta per scadere, tutti sanno chi prenderà l''ultimo tiro.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-epic-001', 'Neon Crossover', (SELECT id FROM artist_classes WHERE slug = 'the-playmaker'),
       'Neon Crossover', 'Court Legends', 'epic', NULL, false,
       86, 94, 82, 88, 'Un cambio di direzione e il difensore resta indietro. Eleganza e velocità in un solo movimento.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-epic-002', 'Rim Crusher', (SELECT id FROM artist_classes WHERE slug = 'the-titan'),
       'Rim Crusher', 'Court Legends', 'epic', NULL, false,
       88, 80, 82, 95, 'Attacca il ferro senza esitazione. Ogni schiacciata sembra voler distruggere il canestro.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-epic-003', 'Arc Assassin', (SELECT id FROM artist_classes WHERE slug = 'the-sniper'),
       'Arc Assassin', 'Court Legends', 'epic', NULL, false,
       84, 88, 90, 82, 'Oltre la linea dei tre punti non esiste distanza. Solo bersagli.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-epic-004', 'Court Emperor', (SELECT id FROM artist_classes WHERE slug = 'the-mvp'),
       'Court Emperor', 'Court Legends', 'epic', NULL, false,
       90, 86, 91, 84, 'Comanda il parquet con presenza assoluta. Il ritmo della partita segue i suoi ordini.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-rare-001', 'Blue Lightning', (SELECT id FROM artist_classes WHERE slug = 'the-speedster'),
       'Blue Lightning', 'Court Legends', 'rare', NULL, false,
       78, 84, 74, 90, 'Un lampo attraversa il campo prima che la difesa possa reagire.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-rare-002', 'Glass Breaker', (SELECT id FROM artist_classes WHERE slug = 'the-rebounder'),
       'Glass Breaker', 'Court Legends', 'rare', NULL, false,
       76, 70, 80, 88, 'Ogni rimbalzo è suo. Sotto canestro trasforma centimetri e forza in dominio.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-rare-003', 'Shadow Guard', (SELECT id FROM artist_classes WHERE slug = 'the-lockdown'),
       'Shadow Guard', 'Court Legends', 'rare', NULL, false,
       72, 78, 86, 82, 'Segue ogni movimento come un''ombra. Superarlo significa trovare una strada che non esiste.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-rare-004', 'Fast Break', (SELECT id FROM artist_classes WHERE slug = 'the-speedster'),
       'Fast Break', 'Court Legends', 'rare', NULL, false,
       80, 82, 72, 86, 'Da una palla recuperata al canestro passano soltanto pochi secondi.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-uncommon-001', 'Street Vision', (SELECT id FROM artist_classes WHERE slug = 'the-playmaker'),
       'Street Vision', 'Court Legends', 'uncommon', NULL, false,
       72, 80, 74, 72, 'Cresciuto sui playground, vede passaggi che gli altri scoprono soltanto quando è troppo tardi.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-uncommon-002', 'Paint Warrior', (SELECT id FROM artist_classes WHERE slug = 'the-titan'),
       'Paint Warrior', 'Court Legends', 'uncommon', NULL, false,
       70, 64, 72, 82, 'Nel pitturato non arretra di un centimetro. Ogni possesso diventa una battaglia.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-uncommon-003', 'Corner Flame', (SELECT id FROM artist_classes WHERE slug = 'the-sniper'),
       'Corner Flame', 'Court Legends', 'uncommon', NULL, false,
       68, 76, 70, 74, 'Aspetta nell''angolo e colpisce appena arriva il pallone. Rapido, preciso, letale.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-uncommon-004', 'Vertical Rush', (SELECT id FROM artist_classes WHERE slug = 'the-high-flyer'),
       'Vertical Rush', 'Court Legends', 'uncommon', NULL, false,
       74, 78, 66, 80, 'Un passo, uno stacco, poi soltanto aria. Vive sopra il ferro.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-common-001', 'Baseline Kid', (SELECT id FROM artist_classes WHERE slug = 'the-rookie'),
       'Baseline Kid', 'Court Legends', 'common', NULL, false,
       62, 66, 58, 70, 'Corre lungo la linea di fondo aspettando il momento giusto per sorprendere la difesa.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-common-002', 'City Hooper', (SELECT id FROM artist_classes WHERE slug = 'the-street-baller'),
       'City Hooper', 'Court Legends', 'common', NULL, false,
       66, 72, 60, 68, 'Asfalto, rete consumata e luci della città. È qui che ha imparato a giocare.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-common-003', 'Quick Release', (SELECT id FROM artist_classes WHERE slug = 'the-sniper'),
       'Quick Release', 'Court Legends', 'common', NULL, false,
       60, 68, 64, 66, 'Riceve, tira, segna. Nessun movimento sprecato.', true, 'original'
UNION ALL
SELECT gen_random_uuid(), 'court-common-004', 'Hard Screen', (SELECT id FROM artist_classes WHERE slug = 'the-enforcer'),
       'Hard Screen', 'Court Legends', 'common', NULL, false,
       58, 56, 68, 74, 'Fa il lavoro che non finisce negli highlights. Un blocco alla volta apre la strada alla squadra.', true, 'original'
ON CONFLICT (code) DO NOTHING;
