-- TEMPORARY FIX: Allow anonymous users to write to fb_odds
-- WARNING: This is NOT secure for production, but will unblock you immediately

-- Add policy for anon role
DROP POLICY IF EXISTS "Allow anon full access for fb_odds" ON public.fb_odds;

CREATE POLICY "Allow anon full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Grant permissions to anon
GRANT ALL ON public.fb_odds TO anon;

-- Do the same for fb_fixtures (needed for reading)
DROP POLICY IF EXISTS "Allow anon read access for fb_fixtures" ON public.fb_fixtures;

CREATE POLICY "Allow anon read access for fb_fixtures"
  ON public.fb_fixtures FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON public.fb_fixtures TO anon;

-- Verify
SELECT
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename IN ('fb_odds', 'fb_fixtures')
  AND 'anon' = ANY(roles)
ORDER BY tablename, policyname;
