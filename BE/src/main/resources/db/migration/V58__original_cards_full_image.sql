-- Le immagini delle carte originali aggiunte con V55 sono carte complete (cornice, nome, statistiche),
-- come quelle delle prime carte VinylDex: vanno mostrate intere (full_image) e non dentro la cornice
-- generica delle carte senza disegno, in collezione, in battaglia, nei pacchetti e nell'hotel.

UPDATE cards SET full_image = true
WHERE source = 'original' AND img_url LIKE '/assets/img/%' AND full_image = false;
