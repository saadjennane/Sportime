/*
  Create Squads System - Social Groups for Challenges (FIXED)

  This migration creates the complete "Squads" system, which replaces the mock
  "Leagues" feature. Squads are user-created social groups where members can:
  - Share and compete in challenges together
  - Track rankings within the squad
  - Celebrate winners with snapshots
  - Create private tournaments
  - Maintain a social feed

  Tables created:
  1. squads - Main squad entity
  2. squad_members - Squad membership with roles
  3. squad_games - Games linked to squads
  4. squad_leaderboard_snapshots - Point-in-time leaderboard captures
  5. squad_feed - Social feed posts
  6. squad_feed_likes - Likes on feed posts
  7. squad_private_games - Private tournament configurations

  Note: This is separate from the "leagues" table which represents football
  competitions (La Liga, Premier League, etc.)
*/

-- ============================================================================
-- HELPER FUNCTION: Generate Invite Code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars: I, O, 0, 1
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1: CREATE ALL TABLES (without RLS policies that reference other tables)
-- ============================================================================

-- TABLE 1: squads
CREATE TABLE IF NOT EXISTS public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 50),
  description TEXT CHECK (char_length(description) <= 500),
  image_url TEXT,
  invite_code TEXT NOT NULL UNIQUE DEFAULT generate_invite_code(),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  season_start_date TIMESTAMPTZ,
  season_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_season_dates CHECK (
    season_start_date IS NULL OR
    season_end_date IS NULL OR
    season_end_date > season_start_date
  )
);

CREATE INDEX idx_squads_created_by ON public.squads(created_by);
CREATE INDEX idx_squads_invite_code ON public.squads(invite_code);
CREATE INDEX idx_squads_created_at ON public.squads(created_at DESC);

COMMENT ON TABLE public.squads IS
  'User-created social groups for competing in challenges together. Not to be confused with leagues table (football competitions).';

-- TABLE 2: squad_members
CREATE TABLE IF NOT EXISTS public.squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

CREATE INDEX idx_squad_members_squad_id ON public.squad_members(squad_id);
CREATE INDEX idx_squad_members_user_id ON public.squad_members(user_id);
CREATE INDEX idx_squad_members_role ON public.squad_members(squad_id, role);

COMMENT ON TABLE public.squad_members IS
  'Squad membership with role-based permissions (admin or member).';

-- TABLE 3: squad_games
CREATE TABLE IF NOT EXISTS public.squad_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  linked_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, game_id)
);

CREATE INDEX idx_squad_games_squad_id ON public.squad_games(squad_id);
CREATE INDEX idx_squad_games_game_id ON public.squad_games(game_id);
CREATE INDEX idx_squad_games_linked_at ON public.squad_games(squad_id, linked_at DESC);

COMMENT ON TABLE public.squad_games IS
  'Games/challenges linked to squads.';

-- TABLE 4: squad_leaderboard_snapshots
CREATE TABLE IF NOT EXISTS public.squad_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  leaderboard_data JSONB NOT NULL,
  celebration_message TEXT CHECK (char_length(celebration_message) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_squad_snapshots_squad_id ON public.squad_leaderboard_snapshots(squad_id);
CREATE INDEX idx_squad_snapshots_created_at ON public.squad_leaderboard_snapshots(squad_id, created_at DESC);
CREATE INDEX idx_squad_snapshots_game_id ON public.squad_leaderboard_snapshots(game_id);

COMMENT ON TABLE public.squad_leaderboard_snapshots IS
  'Point-in-time captures of leaderboards for winner celebrations.';

-- TABLE 5: squad_feed
CREATE TABLE IF NOT EXISTS public.squad_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('celebration', 'announcement', 'game_linked')),
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  related_game_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_squad_feed_squad_id ON public.squad_feed(squad_id);
CREATE INDEX idx_squad_feed_created_at ON public.squad_feed(squad_id, created_at DESC);
CREATE INDEX idx_squad_feed_user_id ON public.squad_feed(user_id);

COMMENT ON TABLE public.squad_feed IS
  'Social feed for squad activities (celebrations, announcements, game links).';

-- TABLE 6: squad_feed_likes
CREATE TABLE IF NOT EXISTS public.squad_feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.squad_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_squad_feed_likes_post_id ON public.squad_feed_likes(post_id);
CREATE INDEX idx_squad_feed_likes_user_id ON public.squad_feed_likes(user_id);

COMMENT ON TABLE public.squad_feed_likes IS
  'Likes on squad feed posts.';

-- TABLE 7: squad_private_games
CREATE TABLE IF NOT EXISTS public.squad_private_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 100),
  description TEXT CHECK (char_length(description) <= 500),
  tournament_type TEXT NOT NULL CHECK (tournament_type IN ('amateur', 'master', 'apex')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  entry_fee INTEGER CHECK (entry_fee >= 0),
  prize_pool INTEGER CHECK (prize_pool >= 0),
  max_participants INTEGER CHECK (max_participants > 0),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_tournament_dates CHECK (ends_at > starts_at)
);

CREATE INDEX idx_squad_private_games_squad_id ON public.squad_private_games(squad_id);
CREATE INDEX idx_squad_private_games_created_at ON public.squad_private_games(created_at DESC);
CREATE INDEX idx_squad_private_games_status ON public.squad_private_games(status);

COMMENT ON TABLE public.squad_private_games IS
  'Private tournaments/games created within squads with custom configurations.';

-- ============================================================================
-- STEP 2: ADD TRIGGERS
-- ============================================================================

CREATE TRIGGER on_squads_update
  BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_squad_private_games_update
  BEFORE UPDATE ON public.squad_private_games
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STEP 3: ENABLE RLS AND ADD POLICIES
-- ============================================================================

-- RLS for squads
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view squads they are members of"
  ON public.squads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squads.id
        AND squad_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to create squads"
  ON public.squads FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow admins to update their squads"
  ON public.squads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squads.id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to delete their squads"
  ON public.squads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squads.id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

-- RLS for squad_members
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view squad members of their squads"
  ON public.squad_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.squad_id = squad_members.squad_id
        AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to join squads"
  ON public.squad_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow admins to remove members"
  ON public.squad_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.squad_id = squad_members.squad_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'admin'
    )
  );

CREATE POLICY "Allow users to leave squads"
  ON public.squad_members FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for squad_games
ALTER TABLE public.squad_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow squad members to view linked games"
  ON public.squad_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_games.squad_id
        AND squad_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to link games"
  ON public.squad_games FOR INSERT
  WITH CHECK (
    auth.uid() = linked_by
    AND EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_games.squad_id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to unlink games"
  ON public.squad_games FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_games.squad_id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

-- RLS for squad_leaderboard_snapshots
ALTER TABLE public.squad_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow squad members to view snapshots"
  ON public.squad_leaderboard_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_leaderboard_snapshots.squad_id
        AND squad_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to create snapshots"
  ON public.squad_leaderboard_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_leaderboard_snapshots.squad_id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

-- RLS for squad_feed
ALTER TABLE public.squad_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow squad members to view feed"
  ON public.squad_feed FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_feed.squad_id
        AND squad_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow squad members to create posts"
  ON public.squad_feed FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_feed.squad_id
        AND squad_members.user_id = auth.uid()
    )
  );

-- RLS for squad_feed_likes
ALTER TABLE public.squad_feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to view likes"
  ON public.squad_feed_likes FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to like posts"
  ON public.squad_feed_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to unlike their own likes"
  ON public.squad_feed_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for squad_private_games
ALTER TABLE public.squad_private_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow squad members to view private games"
  ON public.squad_private_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_private_games.squad_id
        AND squad_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow admins to create private games"
  ON public.squad_private_games FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_private_games.squad_id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to update private games"
  ON public.squad_private_games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_private_games.squad_id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to delete private games"
  ON public.squad_private_games FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squad_private_games.squad_id
        AND squad_members.user_id = auth.uid()
        AND squad_members.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 4: HELPER FUNCTION - Auto-add creator as admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_add_squad_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_squad_created_add_admin
  AFTER INSERT ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_squad_creator_as_admin();

COMMENT ON FUNCTION public.auto_add_squad_creator_as_admin() IS
  'Automatically adds the squad creator as an admin member when a squad is created.';
