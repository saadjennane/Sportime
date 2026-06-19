-- =====================================================
-- Fix Supabase linter "Security Definer View" (lint 0010).
--
-- In Postgres 15+, a view runs with its CREATOR's privileges by default, bypassing
-- the querying user's RLS. `security_invoker = on` makes the view run with the
-- QUERYING user's privileges instead.
--
-- Safe here: none of these views are read directly by the client. They are consumed
-- by SECURITY DEFINER RPCs (e.g. get_user_profile_stats) — which supply the elevated
-- context themselves — or are unused (tm_player_clubs). So flipping to invoker does
-- not change behaviour for the app, and clears the linter error.
-- =====================================================

ALTER VIEW public.tm_player_clubs              SET (security_invoker = on);
ALTER VIEW public.user_profile_stats           SET (security_invoker = on);
ALTER VIEW public.player_season_stats_combined SET (security_invoker = on);
ALTER VIEW public.fixture_sync_summary         SET (security_invoker = on);
