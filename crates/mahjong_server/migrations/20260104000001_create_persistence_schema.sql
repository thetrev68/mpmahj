-- Migration: Create persistence schema for game events, replays, and player stats
-- Version: 1
-- Date: 2026-01-04

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Games table: stores metadata for each game
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    winner_seat TEXT,  -- "East", "South", "West", or "North"
    winning_pattern TEXT,  -- Pattern name from NMJL card
    final_state JSONB,  -- Serialized Table or GameStateSnapshot
    CONSTRAINT games_winner_seat_check CHECK (winner_seat IN ('East', 'South', 'West', 'North') OR winner_seat IS NULL)
);

-- Create index for querying recent games
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at DESC) WHERE finished_at IS NOT NULL;

-- Game events table: event sourcing log with visibility metadata
CREATE TABLE IF NOT EXISTS game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,  -- Monotonically increasing sequence per game
    event JSONB NOT NULL,  -- Serialized GameEvent
    visibility TEXT NOT NULL,  -- "public" or "private"
    target_player TEXT,  -- Seat for private events (e.g., "East")
    schema_version INTEGER NOT NULL DEFAULT 1,  -- For future event schema migrations
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT game_events_seq_positive CHECK (seq >= 0),
    CONSTRAINT game_events_visibility_check CHECK (visibility IN ('public', 'private')),
    CONSTRAINT game_events_target_player_check CHECK (
        (visibility = 'private' AND target_player IN ('East', 'South', 'West', 'North')) OR
        (visibility = 'public' AND target_player IS NULL)
    ),
    -- Ensure unique sequence per game
    CONSTRAINT game_events_game_seq_unique UNIQUE (game_id, seq)
);

-- Create indexes for efficient event replay queries
CREATE INDEX IF NOT EXISTS idx_game_events_game_id_seq ON game_events(game_id, seq);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at DESC);

-- Players table: stores player profiles and statistics
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    stats JSONB,  -- Flexible JSON for wins, losses, patterns, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ
);

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen DESC) WHERE last_seen IS NOT NULL;

-- Optional: Game snapshots table for periodic state checkpoints
-- This can be used to speed up replay reconstruction for long games
CREATE TABLE IF NOT EXISTS game_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,  -- Sequence number this snapshot represents
    state JSONB NOT NULL,  -- Serialized GameStateSnapshot
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT game_snapshots_seq_positive CHECK (seq >= 0),
    CONSTRAINT game_snapshots_game_seq_unique UNIQUE (game_id, seq)
);

-- Create index for snapshot retrieval
CREATE INDEX IF NOT EXISTS idx_game_snapshots_game_id_seq ON game_snapshots(game_id, seq DESC);

-- Function to get event count for a game
CREATE OR REPLACE FUNCTION get_game_event_count(p_game_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM game_events WHERE game_id = p_game_id;
$$ LANGUAGE SQL STABLE;

-- Function to get filtered events for a player (replay with privacy)
CREATE OR REPLACE FUNCTION get_player_replay_events(
    p_game_id UUID,
    p_viewer_seat TEXT
)
RETURNS TABLE (
    id UUID,
    seq INTEGER,
    event JSONB,
    visibility TEXT,
    target_player TEXT,
    created_at TIMESTAMPTZ
) AS $$
    SELECT id, seq, event, visibility, target_player, created_at
    FROM game_events
    WHERE game_id = p_game_id
      AND (visibility = 'public' OR target_player = p_viewer_seat)
    ORDER BY seq ASC;
$$ LANGUAGE SQL STABLE;

-- Function to get all events (admin replay)
CREATE OR REPLACE FUNCTION get_admin_replay_events(p_game_id UUID)
RETURNS TABLE (
    id UUID,
    seq INTEGER,
    event JSONB,
    visibility TEXT,
    target_player TEXT,
    created_at TIMESTAMPTZ
) AS $$
    SELECT id, seq, event, visibility, target_player, created_at
    FROM game_events
    WHERE game_id = p_game_id
    ORDER BY seq ASC;
$$ LANGUAGE SQL STABLE;
