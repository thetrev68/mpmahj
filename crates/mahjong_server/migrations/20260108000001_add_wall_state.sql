-- Add wall state columns for deterministic replay

ALTER TABLE games ADD COLUMN IF NOT EXISTS wall_seed BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS wall_break_point SMALLINT;

-- Index for replay queries (note: column is 'id' not 'game_id')
CREATE INDEX IF NOT EXISTS idx_games_wall_state ON games(id, wall_seed);
