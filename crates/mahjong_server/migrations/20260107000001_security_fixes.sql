-- Fix Supabase security warnings
-- Version: 3
-- Date: 2026-01-07

-- 1. Enable RLS on _sqlx_migrations table (internal tool)
-- Prevents "Table public._sqlx_migrations is public, but RLS has not been enabled"
ALTER TABLE IF EXISTS _sqlx_migrations ENABLE ROW LEVEL SECURITY;

-- 2. Drop overly permissive insert policy for games
-- Fixes "Table public.games has an RLS policy Authenticated users can create games for INSERT that allows unrestricted access"
-- Clients should create games via the game server (WebSocket), not direct DB access.
-- The game server (connecting as postgres/admin) will still be able to insert.
DROP POLICY IF EXISTS "Authenticated users can create games" ON games;

-- 3. Fix mutable search_path in SECURITY DEFINER functions
-- Fixes "Function ... has a role mutable search_path"
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.get_admin_replay_events(UUID) SET search_path = public;
ALTER FUNCTION public.get_player_replay_events(UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.get_game_event_count(UUID) SET search_path = public;
