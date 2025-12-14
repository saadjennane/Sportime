-- Create market_categories table to store market categorization
-- Moves categorization from frontend to database for easier management

CREATE TABLE IF NOT EXISTS market_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id INT NOT NULL UNIQUE, -- API-Football market ID
  category TEXT NOT NULL CHECK (category IN (
    'result', 'goals', 'scorers', 'cards', 'corners',
    'quick', 'clean_sheet', 'extra_time', 'penalties', 'other'
  )),
  market_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active categories
CREATE INDEX idx_market_categories_active ON market_categories(is_active) WHERE is_active = true;
CREATE INDEX idx_market_categories_category ON market_categories(category);

-- RLS policies
ALTER TABLE market_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "market_categories_select_all" ON market_categories
  FOR SELECT USING (true);

-- Only admins can modify (we'll check in edge function)
CREATE POLICY "market_categories_modify_all" ON market_categories
  FOR ALL USING (true);

-- Seed with existing mappings from liveGameService.ts
INSERT INTO market_categories (market_id, category, market_name) VALUES
  -- RESULT markets
  (1, 'result', 'Match Winner'),
  (19, 'result', '1X2 1st Half'),
  (35, 'result', 'To Win 2nd Half'),
  (41, 'result', '1X2 50min'),
  (64, 'result', 'HT/FT Double'),
  (21, 'result', '3-Way Handicap'),
  (33, 'result', 'Asian Handicap'),
  (17, 'result', 'Asian Handicap 1st Half'),
  (26, 'result', '1X2 2nd Half'),
  (29, 'result', 'Double Chance'),

  -- GOALS markets
  (36, 'goals', 'Over/Under'),
  (25, 'goals', 'Match Goals'),
  (49, 'goals', 'Over/Under 1st Half'),
  (24, 'goals', 'Next Goal'),
  (73, 'goals', 'Team Goals'),
  (58, 'goals', 'Score in Both Halves'),
  (39, 'goals', 'Both Teams Score'),
  (27, 'goals', 'BTTS 1st Half'),
  (38, 'goals', 'Exact Score'),
  (30, 'goals', 'Home Team Goals'),
  (16, 'goals', 'Away Team Goals'),
  (23, 'goals', 'Exact Goals'),
  (60, 'goals', 'To Score 3+ Goals'),

  -- SCORERS markets
  (46, 'scorers', 'Anytime Goalscorer'),
  (148, 'scorers', 'Player Shots'),
  (92, 'scorers', 'First Goalscorer'),
  (93, 'scorers', 'Last Goalscorer'),
  (94, 'scorers', 'Player to Score 2+'),

  -- CARDS markets
  (119, 'cards', 'Total Cards'),
  (115, 'cards', 'Player to be Booked'),
  (120, 'cards', 'Home Team Cards'),
  (121, 'cards', 'Away Team Cards'),
  (122, 'cards', 'Cards Over/Under'),

  -- CORNERS markets
  (20, 'corners', 'Match Corners'),
  (37, 'corners', 'Total Corners'),
  (32, 'corners', 'Asian Corners'),
  (78, 'corners', 'Corners 1X2'),
  (76, 'corners', 'Race to Corners'),
  (61, 'corners', 'Team Corners'),
  (45, 'corners', 'Corners Over/Under'),
  (31, 'corners', 'Corners Range'),

  -- QUICK markets
  (18, 'quick', 'Goal in Time Interval'),
  (47, 'quick', 'First Half Goals'),
  (48, 'quick', 'Second Half Goals'),

  -- CLEAN SHEET markets
  (57, 'clean_sheet', 'Away Clean Sheet'),
  (66, 'clean_sheet', 'Home Clean Sheet'),
  (67, 'clean_sheet', 'Both Teams Clean Sheet'),

  -- EXTRA TIME markets (knockout only)
  (2, 'extra_time', 'Home/Away (ET)'),
  (6, 'extra_time', 'Goals Over/Under (ET)'),
  (9, 'extra_time', 'Both Teams Score (ET)'),
  (11, 'extra_time', 'Exact Score (ET)'),

  -- PENALTIES markets (knockout only)
  (8, 'penalties', 'Penalty Shootout Winner'),
  (10, 'penalties', 'To Qualify'),
  (101, 'penalties', 'Total Penalties'),
  (107, 'penalties', 'Penalties Over/Under')

ON CONFLICT (market_id) DO UPDATE SET
  category = EXCLUDED.category,
  market_name = EXCLUDED.market_name,
  updated_at = now();

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_market_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER market_categories_updated_at
  BEFORE UPDATE ON market_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_market_categories_updated_at();

COMMENT ON TABLE market_categories IS 'Market ID to category mappings for live betting (managed via admin)';
