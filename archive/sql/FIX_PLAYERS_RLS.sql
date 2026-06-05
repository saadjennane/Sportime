-- ============================================================================
-- ADD RLS POLICIES FOR PLAYERS TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public insert access to players" ON players;
DROP POLICY IF EXISTS "Allow public update access to players" ON players;
DROP POLICY IF EXISTS "Allow public select access to players" ON players;

-- Create policy to allow public INSERT
CREATE POLICY "Allow public insert access to players"
ON players
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow public UPDATE
CREATE POLICY "Allow public update access to players"
ON players
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Create policy to allow public SELECT
CREATE POLICY "Allow public select access to players"
ON players
FOR SELECT
TO public
USING (true);
