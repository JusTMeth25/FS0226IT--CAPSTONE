-- Gara rock: classifica per canzone, difficolta' e strumento (chitarra o batteria).
CREATE TABLE rock_scores (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    song        varchar(20) NOT NULL,
    difficulty  varchar(10) NOT NULL,
    instrument  varchar(10) NOT NULL,
    score       integer     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rock_scores_song ON rock_scores (song, difficulty, instrument, score DESC);

-- Locale Rock (V48): la pedana della gara di batteria accanto al palco. La V48 e' pubblicata:
-- le aggiunte alla stanza si fanno qui, a mano.
INSERT INTO room_items (id, owner_id, room_id, furni_type, x, y, z, rot) VALUES
    ('00000000-0000-0000-0000-c01e00000100', NULL, '00000000-0000-0000-0000-00000000a01e', 'drum_duel', 12, 7, 0, 0);
