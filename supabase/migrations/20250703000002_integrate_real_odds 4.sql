/*
  Integrate Real Odds from Fixtures

  This migration updates the recalculate_challenge_points function to fetch
  real odds from the odds table (linked to fixtures) instead of using hardcoded values.

  Changes:
  - Modify recalculate_challenge_points to join with fixtures and odds tables
  - Fetch actual odds (home_win, draw, away_win) from database
  - Fallback to default odds (2.0, 3.2, 2.4) if no odds available
  - Use challenge_bets.odds_snapshot if available (already captured at bet placement)

  Data Flow:
  - challenge_matches → matches → fixtures (via api_id mapping)
  - fixtures → odds (latest odds for that fixture)
  - Build JSONB: { teamA: home_win, draw: draw, teamB: away_win }
*/

-- Create recalculate_challenge_points with real odds (single parameter version)
-- Note: This coexists with the 2-parameter version (p_challenge_id, p_user_id)
CREATE OR REPLACE FUNCTION public.recalculate_challenge_points(p_challenge_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_daily_entry RECORD;
  v_bet RECORD;
  v_match RECORD;
  v_has_booster BOOLEAN;
  v_bet_points INTEGER;
  v_total_points INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop through each daily entry for this challenge
  FOR v_daily_entry IN
    SELECT * FROM public.challenge_daily_entries
    WHERE challenge_entry_id IN (
      SELECT id FROM public.challenge_entries WHERE challenge_id = p_challenge_id
    )
  LOOP
    v_total_points := 0;
    v_has_booster := v_daily_entry.booster_type IS NOT NULL;

    -- Loop through all bets for this day
    FOR v_bet IN
      SELECT * FROM public.challenge_bets
      WHERE daily_entry_id = v_daily_entry.id
    LOOP
      -- Get match details including result and real odds
      SELECT
        cm.id,
        m.status,
        m.score,
        -- PRIORITY 1: Use odds_snapshot from bet if available (captured at bet placement)
        COALESCE(
          v_bet.odds_snapshot,
          -- PRIORITY 2: Fetch latest odds from odds table
          (
            SELECT JSONB_BUILD_OBJECT(
              'teamA', o.home_win,
              'draw', o.draw,
              'teamB', o.away_win
            )
            FROM public.fixtures f
            LEFT JOIN public.odds o ON o.fixture_id = f.id
            WHERE f.id = m.fixture_id
              AND o.home_win IS NOT NULL
            ORDER BY o.updated_at DESC
            LIMIT 1
          ),
          -- PRIORITY 3: Fallback to default odds
          JSONB_BUILD_OBJECT(
            'teamA', 2.0,
            'draw', 3.2,
            'teamB', 2.4
          )
        ) as odds
      INTO v_match
      FROM public.challenge_matches cm
      JOIN public.matches m ON m.id = cm.match_id
      WHERE cm.id = v_bet.challenge_match_id;

      -- Only count if match is finished
      IF v_match.status IN ('finished', 'FT', 'AET', 'PEN') AND v_match.score IS NOT NULL THEN
        -- Determine match result
        DECLARE
          v_home_goals INTEGER;
          v_away_goals INTEGER;
          v_result TEXT;
        BEGIN
          v_home_goals := COALESCE((v_match.score->>'home')::INTEGER, (v_match.score->>'goals_home')::INTEGER, 0);
          v_away_goals := COALESCE((v_match.score->>'away')::INTEGER, (v_match.score->>'goals_away')::INTEGER, 0);

          v_result := CASE
            WHEN v_home_goals > v_away_goals THEN 'teamA'
            WHEN v_home_goals < v_away_goals THEN 'teamB'
            ELSE 'draw'
          END;

          -- Check if booster applies to this match
          DECLARE
            v_apply_booster BOOLEAN;
          BEGIN
            v_apply_booster := v_has_booster AND (v_daily_entry.booster_match_id = v_bet.challenge_match_id);

            -- Calculate points for this bet using REAL odds
            v_bet_points := public.calculate_bet_points(
              v_bet.prediction,
              v_result,
              v_match.odds,  -- Now contains real odds from database!
              v_bet.amount,
              v_apply_booster,
              v_daily_entry.booster_type
            );

            v_total_points := v_total_points + v_bet_points;
          END;
        END;
      END IF;
    END LOOP;

    -- Update daily entry points
    UPDATE public.challenge_daily_entries
    SET points = v_total_points
    WHERE id = v_daily_entry.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment documenting the real odds integration
COMMENT ON FUNCTION public.recalculate_challenge_points(UUID) IS
  'Recalculates points for all challenge entries using REAL odds from the odds table. Priority: 1) odds_snapshot from bet, 2) latest odds from odds table, 3) default fallback (2.0, 3.2, 2.4). Applies gross gain model with x3 penalty.';
