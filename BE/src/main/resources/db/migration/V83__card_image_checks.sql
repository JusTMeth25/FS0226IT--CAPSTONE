-- Controllo delle immagini delle carte importate: alcune fonti pubblicano carte la cui immagine non
-- esiste (TCGplayer risponde 403, soprattutto per promo ed eventi di Dragon Ball). Una carta con
-- l'immagine rotta si disattiva (niente pacchetti, mercato, set) e resta disattivata anche dopo un
-- nuovo import: l'esito si tiene per URL, non per carta (CardImageAudit).

CREATE TABLE card_image_checks
(
    img_url    varchar(1000) PRIMARY KEY,
    broken     boolean     NOT NULL,
    status     integer,
    checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_image_checks_broken ON card_image_checks (checked_at) WHERE broken;
