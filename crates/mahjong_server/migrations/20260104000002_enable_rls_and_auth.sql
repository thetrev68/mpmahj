-- Migration: Enable RLS and link players to Supabase Auth
-- Version: 2
-- Date: 2026-01-04

-- 1. Modify players table to link to auth.users
-- We add user_id which references auth.users.
-- We keep the existing PK (id) as an internal UUID for the game server, 
-- but we might want to enforce 1:1 mapping. 
-- For simplicity in this migration, we add user_id and make it unique.
ALTER TABLE players ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE UNIQUE INDEX idx_players_user_id ON players(user_id);

-- 2. Enable RLS on all tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_snapshots ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Players:
-- Everyone can read public player profiles (username, display_name, stats).
CREATE POLICY "Public profiles are viewable by everyone" 
ON players FOR SELECT 
USING (true);

-- Users can can update their own profile.
CREATE POLICY "Users can update their own profile" 
ON players FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can insert their own profile (handled by trigger usually, but good to have).
CREATE POLICY "Users can insert their own profile" 
ON players FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Games:
-- For now, we allow authenticated users to view all games (lobby style).
-- In a stricter system, we might restrict this to participants.
CREATE POLICY "Authenticated users can view games" 
ON games FOR SELECT 
TO authenticated 
USING (true);

-- Authenticated users can create games.
CREATE POLICY "Authenticated users can create games" 
ON games FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Game Events:
-- Public events are viewable by everyone (or just authenticated).
-- Private events are viewable only by the target player.
-- However, the table doesn't have a 'user_id' column to check against auth.uid().
-- It has 'target_player' which is a Seat ('East', etc).
-- The mapping between Auth User and Seat is in the Room/Game state, not strictly on the row.
-- This is complex for RLS without a join.
-- STRATEGY: For this iteration, we allow authenticated users to SELECT all events.
-- The application layer (websocket) filters private events before sending to client.
-- RLS here mainly protects against direct SQL access if we exposed it via PostgREST.
-- Since we are using a custom Rust server, this RLS is a second line of defense.
-- We will allow SELECT to authenticated for now.
CREATE POLICY "Authenticated users can view game events" 
ON game_events FOR SELECT 
TO authenticated 
USING (true);

-- Authenticated users can insert events (via the server, which uses the service role usually).
-- If the Rust server uses a service role key, it bypasses RLS.
-- If it uses the user's token, we need this policy.
-- Assuming the Rust server might impersonate or just use its own privilege.
-- If the Rust server connects as a superuser/admin (postgres), it bypasses RLS.
-- The 'Database' struct in db.rs uses the connection string.
-- If that connection string is for a role that is NOT 'postgres' (superuser), RLS applies.
-- Usually, app servers use a high-privilege role.
-- But if we want to support Supabase Client access directly, we need these.

-- Game Snapshots:
CREATE POLICY "Authenticated users can view snapshots" 
ON game_snapshots FOR SELECT 
TO authenticated 
USING (true);

-- 4. Auto-create player profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.players (user_id, username, display_name)
  VALUES (
    new.id, 
    new.email, -- Use email as default username
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on insert to auth.users
-- Note: We need to check if the trigger exists to be idempotent or just create it.
-- In standard SQL, CREATE TRIGGER IF NOT EXISTS is valid in Postgres 11+.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
