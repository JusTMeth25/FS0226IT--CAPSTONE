-- Pacchetto Premium: 5 carte invece di 10. Restano la Leggendaria e la Rara garantite, le
-- probabilita' e il prezzo.
UPDATE packs
SET card_count = 5,
    description = '5 carte con 1 Leggendaria garantita. Il massimo del lusso!'
WHERE code = 'pack-premium';
