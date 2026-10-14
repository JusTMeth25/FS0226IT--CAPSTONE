-- Eternal Empress senza il bordo nero: l'immagine e' ritagliata sulla cornice dorata e arriva fino
-- al bordo della carta come le altre VinylDex. Nome nuovo per non mostrare la versione in cache.

UPDATE cards SET img_url = '/assets/img/EternalEmpressFull.webp'
WHERE code IN ('legendary-ultimate-001', 'legendary-ultimate-001-holo');
UPDATE cards SET img_url = '/assets/img/EternalEmpressRealisticFull.webp'
WHERE code IN ('legendary-ultimate-002', 'legendary-ultimate-002-holo');
