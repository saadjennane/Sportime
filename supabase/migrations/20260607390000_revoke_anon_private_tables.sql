-- ============================================================================
-- Security: stop exposing private/financial tables to the anon role (GraphQL/REST
-- discoverability — pg_graphql_anon_table_exposed). The app authenticates every
-- user (guests included, via createGuestAccount + signInWithPassword -> role
-- `authenticated`), so anon access is not needed for these. Public catalog tables
-- (challenges, fantasy_games, fb_*, configs, badges, leaderboards) are LEFT
-- readable by anon on purpose (initial load / public browse).
-- We GRANT to authenticated first so logged-in reads keep working, then REVOKE anon.
-- ============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'coin_transactions', 'challenge_bets', 'challenge_daily_entries',
    'challenge_entries', 'api_sync_config'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Storage: a public bucket doesn't need a broad SELECT policy (objects are served
-- via public URL). The listing policy let clients enumerate all avatar files.
DROP POLICY IF EXISTS "Users can view all avatars" ON storage.objects;
