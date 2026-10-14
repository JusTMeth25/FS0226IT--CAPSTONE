-- Immagini di Eternal Empress rifatte nel formato delle altre carte VinylDex (800x1120, 5:7): le
-- originali erano 2:3 e il riquadro tagliava la scritta LEGENDARY. Nome nuovo, cosi' browser e
-- service worker non mostrano la versione vecchia che hanno in cache. Vale anche per le olografiche.

UPDATE cards SET img_url = '/assets/img/EternalEmpress57.webp'
WHERE code IN ('legendary-ultimate-001', 'legendary-ultimate-001-holo');
UPDATE cards SET img_url = '/assets/img/EternalEmpressRealistic57.webp'
WHERE code IN ('legendary-ultimate-002', 'legendary-ultimate-002-holo');
