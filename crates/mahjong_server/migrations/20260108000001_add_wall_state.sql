-- Add wall state columns for deterministic replay

ALTER TABLE games ADD COLUMN IF NOT EXISTS wall_seed BIGINT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS wall_break_point SMALLINT;

-- Index for replay queries
CREATE INDEX IF NOT EXISTS idx_games_wall_state ON games(game_id, wall_seed);
