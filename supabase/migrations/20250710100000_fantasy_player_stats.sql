-- ============================================================================
-- Fantasy Player Statistics Schema
-- Extends player data with season stats, match stats, and transfer history
-- ============================================================================

-- =============================================================================
-- TABLE: Player Season Statistics
-- Season-level aggregated stats for each player
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season INTEGER NOT NULL, -- e.g., 2024
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,

  -- API Football ID for reference
  api_id INTEGER,

  -- Appearance Stats
  appearances INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  starting_xi INTEGER DEFAULT 0,
  substitute_in INTEGER DEFAULT 0,
  substitute_out INTEGER DEFAULT 0,
  bench INTEGER DEFAULT 0,

  -- Performance Stats
  rating DECIMAL(3,2), -- e.g., 7.23
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,

  -- Detailed Stats (for impact/consistency calculation)
  shots_total INTEGER DEFAULT 0,
  shots_on_target INTEGER DEFAULT 0,
  passes_total INTEGER DEFAULT 0,
  passes_key INTEGER DEFAULT 0,
  passes_accuracy DECIMAL(5,2), -- percentage
  tackles_total INTEGER DEFAULT 0,
  tackles_interceptions INTEGER DEFAULT 0,
  duels_total INTEGER DEFAULT 0,
  duels_won INTEGER DEFAULT 0,
  dribbles_attempts INTEGER DEFAULT 0,
  dribbles_success INTEGER DEFAULT 0,
  fouls_drawn INTEGER DEFAULT 0,
  fouls_committed INTEGER DEFAULT 0,

  -- Discipline
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,

  -- Goalkeeper Stats (if applicable)
  saves INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,

  -- Calculated Fantasy Metrics
  impact_score DECIMAL(5,2), -- Calculated from goals, assists, key passes, etc.
  consistency_score DECIMAL(5,2), -- Calculated from rating variance
  pgs DECIMAL(5,2), -- Player Game Score: (rating×0.5)+(impact×0.3)+(consistency×0.2)
  pgs_category TEXT, -- 'star', 'key', 'wild'

  -- Market Value
  market_value BIGINT, -- in euros

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_id, season, team_id)
);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_player
  ON public.player_season_stats(player_id);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_season
  ON public.player_season_stats(season);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_team
  ON public.player_season_stats(team_id);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_pgs
  ON public.player_season_stats(pgs DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_category
  ON public.player_season_stats(pgs_category);

-- =============================================================================
-- TABLE: Player Match Statistics
-- Match-by-match performance for detailed analysis
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- API Football ID
  api_id INTEGER,

  -- Match participation
  minutes_played INTEGER DEFAULT 0,
  started BOOLEAN DEFAULT false,
  substitute_in BOOLEAN DEFAULT false,
  substitute_out BOOLEAN DEFAULT false,

  -- Performance
  rating DECIMAL(3,2),
  position TEXT, -- e.g., 'Forward', 'Midfielder'

  -- Stats
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  shots_total INTEGER DEFAULT 0,
  shots_on_target INTEGER DEFAULT 0,
  passes_total INTEGER DEFAULT 0,
  passes_key INTEGER DEFAULT 0,
  passes_accuracy DECIMAL(5,2),
  tackles_total INTEGER DEFAULT 0,
  tackles_interceptions INTEGER DEFAULT 0,
  duels_total INTEGER DEFAULT 0,
  duels_won INTEGER DEFAULT 0,
  dribbles_attempts INTEGER DEFAULT 0,
  dribbles_success INTEGER DEFAULT 0,
  fouls_drawn INTEGER DEFAULT 0,
  fouls_committed INTEGER DEFAULT 0,

  -- Discipline
  yellow_card BOOLEAN DEFAULT false,
  red_card BOOLEAN DEFAULT false,

  -- Goalkeeper Stats
  saves INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_id, fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_player
  ON public.player_match_stats(player_id);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_fixture
  ON public.player_match_stats(fixture_id);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_rating
  ON public.player_match_stats(rating DESC NULLS LAST);

-- =============================================================================
-- TABLE: Player Transfers
-- Transfer history for each player
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,

  -- Transfer Details
  transfer_date DATE NOT NULL,
  from_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  from_team_name TEXT, -- Store name in case team not in our DB
  to_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_name TEXT,

  -- Transfer Type
  transfer_type TEXT, -- 'Transfer', 'Loan', 'Free', 'N/A'

  -- Financial
  fee BIGINT, -- Transfer fee in euros (NULL if free/loan)

  -- API Football ID
  api_id INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_transfers_player
  ON public.player_transfers(player_id);

CREATE INDEX IF NOT EXISTS idx_player_transfers_date
  ON public.player_transfers(transfer_date DESC);

-- =============================================================================
-- FUNCTION: Calculate Impact Score
-- Based on goals, assists, key passes, dribbles, tackles
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_impact_score(
  p_goals INTEGER,
  p_assists INTEGER,
  p_passes_key INTEGER,
  p_dribbles_success INTEGER,
  p_tackles_total INTEGER,
  p_shots_on_target INTEGER,
  p_appearances INTEGER
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_impact DECIMAL(5,2);
  v_per_game DECIMAL(5,2);
BEGIN
  -- Avoid division by zero
  IF p_appearances = 0 THEN
    RETURN 0;
  END IF;

  -- Calculate weighted impact per game
  v_per_game := (
    (p_goals * 1.0) +
    (p_assists * 0.7) +
    (p_passes_key * 0.3) +
    (p_dribbles_success * 0.2) +
    (p_tackles_total * 0.15) +
    (p_shots_on_target * 0.1)
  ) / p_appearances::DECIMAL;

  -- Normalize to 0-10 scale (capped at 10)
  v_impact := LEAST(10, v_per_game);

  RETURN ROUND(v_impact, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Calculate Consistency Score
-- Based on rating variance across matches
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_consistency_score(
  p_player_id UUID,
  p_season INTEGER
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_avg_rating DECIMAL(5,2);
  v_stddev DECIMAL(5,2);
  v_consistency DECIMAL(5,2);
BEGIN
  -- Get average rating and standard deviation from match stats
  SELECT
    AVG(rating),
    STDDEV(rating)
  INTO v_avg_rating, v_stddev
  FROM public.player_match_stats pms
  JOIN public.fixtures f ON f.id = pms.fixture_id
  WHERE pms.player_id = p_player_id
    AND pms.rating IS NOT NULL
    AND EXTRACT(YEAR FROM f.date) = p_season;

  -- If no data, return 0
  IF v_avg_rating IS NULL OR v_stddev IS NULL THEN
    RETURN 0;
  END IF;

  -- Consistency = 10 - (stddev * 2), clamped to 0-10
  -- Lower variance = higher consistency
  v_consistency := GREATEST(0, LEAST(10, 10 - (v_stddev * 2)));

  RETURN ROUND(v_consistency, 2);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Calculate PGS (Player Game Score)
-- Formula: PGS = (rating×0.5) + (impact×0.3) + (consistency×0.2)
-- With playtime ratio adjustments:
--   +0.3 for ≥90% playtime
--   +0.15 for 50-89% playtime
--   +0.05 for <50% playtime
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_pgs(
  p_rating DECIMAL(3,2),
  p_impact DECIMAL(5,2),
  p_consistency DECIMAL(5,2),
  p_minutes_played INTEGER,
  p_appearances INTEGER
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_base_pgs DECIMAL(5,2);
  v_playtime_ratio DECIMAL(5,4);
  v_adjustment DECIMAL(3,2);
  v_final_pgs DECIMAL(5,2);
BEGIN
  -- Base PGS calculation
  v_base_pgs := (p_rating * 0.5) + (p_impact * 0.3) + (p_consistency * 0.2);

  -- Calculate playtime ratio (assuming 90 min per match)
  IF p_appearances = 0 THEN
    v_playtime_ratio := 0;
  ELSE
    v_playtime_ratio := p_minutes_played::DECIMAL / (p_appearances * 90.0);
  END IF;

  -- Apply playtime adjustments
  IF v_playtime_ratio >= 0.90 THEN
    v_adjustment := 0.3;
  ELSIF v_playtime_ratio >= 0.50 THEN
    v_adjustment := 0.15;
  ELSE
    v_adjustment := 0.05;
  END IF;

  v_final_pgs := v_base_pgs + v_adjustment;

  RETURN ROUND(v_final_pgs, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Get PGS Category
-- Star: PGS > 7.5, Key: PGS > 6.5, Wild: rest
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pgs_category(p_pgs DECIMAL(5,2))
RETURNS TEXT AS $$
BEGIN
  IF p_pgs > 7.5 THEN
    RETURN 'star';
  ELSIF p_pgs > 6.5 THEN
    RETURN 'key';
  ELSE
    RETURN 'wild';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Update Player Season Stats (Trigger Function)
-- Automatically recalculates impact, consistency, PGS when stats are updated
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_player_season_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate impact score
  NEW.impact_score := public.calculate_impact_score(
    NEW.goals,
    NEW.assists,
    NEW.passes_key,
    NEW.dribbles_success,
    NEW.tackles_total,
    NEW.shots_on_target,
    NEW.appearances
  );

  -- Calculate consistency score
  NEW.consistency_score := public.calculate_consistency_score(
    NEW.player_id,
    NEW.season
  );

  -- Calculate PGS
  IF NEW.rating IS NOT NULL THEN
    NEW.pgs := public.calculate_pgs(
      NEW.rating,
      NEW.impact_score,
      NEW.consistency_score,
      NEW.minutes_played,
      NEW.appearances
    );

    -- Set category
    NEW.pgs_category := public.get_pgs_category(NEW.pgs);
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_player_season_stats ON public.player_season_stats;
CREATE TRIGGER trigger_update_player_season_stats
  BEFORE INSERT OR UPDATE ON public.player_season_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_season_stats();

-- =============================================================================
-- RLS Policies
-- =============================================================================
ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_transfers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read access to player_season_stats"
  ON public.player_season_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read access to player_match_stats"
  ON public.player_match_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read access to player_transfers"
  ON public.player_transfers FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role can modify
CREATE POLICY "Allow service_role full access to player_season_stats"
  ON public.player_season_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access to player_match_stats"
  ON public.player_match_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access to player_transfers"
  ON public.player_transfers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.player_season_stats TO authenticated;
GRANT SELECT ON public.player_match_stats TO authenticated;
GRANT SELECT ON public.player_transfers TO authenticated;

GRANT ALL ON public.player_season_stats TO service_role;
GRANT ALL ON public.player_match_stats TO service_role;
GRANT ALL ON public.player_transfers TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.calculate_impact_score TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_consistency_score TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_pgs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pgs_category TO authenticated, service_role;

-- Verification
SELECT 'Fantasy player stats tables created successfully!' as status;
