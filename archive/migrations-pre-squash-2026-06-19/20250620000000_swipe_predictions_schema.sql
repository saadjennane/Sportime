-- ============================================================================
-- SWIPE PREDICTIONS GAME SCHEMA
-- ============================================================================
-- This migration creates the schema for the swipe predictions game.
-- The game runs over multiple days with daily matchdays and a cumulative leaderboard.
--
-- Architecture:
-- - One challenge = One swipe game (start_date -> end_date)
-- - Each day with matches = One matchday
-- - Users make predictions for each matchday
-- - Points accumulate across all matchdays
-- - Leaderboard updates daily as results come in
-- ============================================================================

-- ============================================================================
-- 1. MATCHDAYS TABLE
-- ============================================================================
-- Represents a single day of matches within a challenge
-- Example: Champions League game from Dec 1-20 might have 5 matchdays
CREATE TABLE IF NOT EXISTS public.challenge_matchdays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'finished')),
    deadline TIMESTAMPTZ, -- When predictions lock (usually first kickoff time)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenge_id, date)
);

CREATE INDEX idx_challenge_matchdays_challenge ON public.challenge_matchdays(challenge_id);
CREATE INDEX idx_challenge_matchdays_date ON public.challenge_matchdays(date);
CREATE INDEX idx_challenge_matchdays_status ON public.challenge_matchdays(status);

ALTER TABLE public.challenge_matchdays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to challenge_matchdays"
    ON public.challenge_matchdays FOR SELECT
    USING (true);

-- Trigger to update updated_at
CREATE TRIGGER on_challenge_matchdays_update
    BEFORE UPDATE ON public.challenge_matchdays
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 2. MATCHDAY FIXTURES TABLE
-- ============================================================================
-- Links fixtures to specific matchdays within a challenge
CREATE TABLE IF NOT EXISTS public.matchday_fixtures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchday_id UUID NOT NULL REFERENCES public.challenge_matchdays(id) ON DELETE CASCADE,
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(matchday_id, fixture_id)
);

CREATE INDEX idx_matchday_fixtures_matchday ON public.matchday_fixtures(matchday_id);
CREATE INDEX idx_matchday_fixtures_fixture ON public.matchday_fixtures(fixture_id);

ALTER TABLE public.matchday_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to matchday_fixtures"
    ON public.matchday_fixtures FOR SELECT
    USING (true);

-- ============================================================================
-- 3. SWIPE PREDICTIONS TABLE
-- ============================================================================
-- Stores individual predictions for each match
-- One row per user per fixture per challenge
CREATE TABLE IF NOT EXISTS public.swipe_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    matchday_id UUID NOT NULL REFERENCES public.challenge_matchdays(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,

    -- Prediction: 'home', 'draw', or 'away'
    prediction TEXT NOT NULL CHECK (prediction IN ('home', 'draw', 'away')),

    -- Snapshot of odds at the time of prediction
    odds_at_prediction JSONB NOT NULL,
    -- Example: {"home": 2.50, "draw": 3.20, "away": 2.80}

    -- Calculated after match finishes
    points_earned INTEGER DEFAULT 0,
    is_correct BOOLEAN DEFAULT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(challenge_id, user_id, fixture_id)
);

CREATE INDEX idx_swipe_predictions_challenge_user ON public.swipe_predictions(challenge_id, user_id);
CREATE INDEX idx_swipe_predictions_matchday ON public.swipe_predictions(matchday_id);
CREATE INDEX idx_swipe_predictions_fixture ON public.swipe_predictions(fixture_id);
CREATE INDEX idx_swipe_predictions_user ON public.swipe_predictions(user_id);

-- RLS Policies
ALTER TABLE public.swipe_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own predictions"
    ON public.swipe_predictions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
    ON public.swipe_predictions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions before deadline"
    ON public.swipe_predictions FOR UPDATE
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.challenge_matchdays
            WHERE id = matchday_id
            AND (deadline IS NULL OR deadline > NOW())
        )
    );

CREATE POLICY "Allow public read for leaderboard calculation"
    ON public.swipe_predictions FOR SELECT
    USING (true);

-- Trigger to update updated_at
CREATE TRIGGER on_swipe_predictions_update
    BEFORE UPDATE ON public.swipe_predictions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. MATCHDAY PARTICIPATION TABLE
-- ============================================================================
-- Tracks user participation and points for each matchday
-- This allows daily leaderboard views
CREATE TABLE IF NOT EXISTS public.matchday_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matchday_id UUID NOT NULL REFERENCES public.challenge_matchdays(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Stats for this matchday
    predictions_made INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,

    -- Whether user completed all predictions for this matchday
    is_complete BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(matchday_id, user_id)
);

CREATE INDEX idx_matchday_participants_matchday ON public.matchday_participants(matchday_id);
CREATE INDEX idx_matchday_participants_user ON public.matchday_participants(user_id);

ALTER TABLE public.matchday_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matchday participation"
    ON public.matchday_participants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Allow public read for leaderboard"
    ON public.matchday_participants FOR SELECT
    USING (true);

-- Trigger to update updated_at
CREATE TRIGGER on_matchday_participants_update
    BEFORE UPDATE ON public.matchday_participants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create matchday participant
CREATE OR REPLACE FUNCTION get_or_create_matchday_participant(
    p_matchday_id UUID,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_participant_id UUID;
BEGIN
    -- Try to get existing participant
    SELECT id INTO v_participant_id
    FROM public.matchday_participants
    WHERE matchday_id = p_matchday_id AND user_id = p_user_id;

    -- If not found, create it
    IF v_participant_id IS NULL THEN
        INSERT INTO public.matchday_participants (matchday_id, user_id)
        VALUES (p_matchday_id, p_user_id)
        RETURNING id INTO v_participant_id;
    END IF;

    RETURN v_participant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update matchday participant stats
CREATE OR REPLACE FUNCTION update_matchday_participant_stats(p_matchday_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_predictions_count INTEGER;
    v_total_points INTEGER;
    v_correct_count INTEGER;
    v_total_matches INTEGER;
BEGIN
    -- Count predictions and calculate stats
    SELECT
        COUNT(*),
        COALESCE(SUM(points_earned), 0),
        COUNT(*) FILTER (WHERE is_correct = true)
    INTO v_predictions_count, v_total_points, v_correct_count
    FROM public.swipe_predictions
    WHERE matchday_id = p_matchday_id AND user_id = p_user_id;

    -- Count total matches in this matchday
    SELECT COUNT(*) INTO v_total_matches
    FROM public.matchday_fixtures
    WHERE matchday_id = p_matchday_id;

    -- Update or insert participant stats
    INSERT INTO public.matchday_participants (
        matchday_id,
        user_id,
        predictions_made,
        points_earned,
        correct_predictions,
        is_complete
    ) VALUES (
        p_matchday_id,
        p_user_id,
        v_predictions_count,
        v_total_points,
        v_correct_count,
        v_predictions_count >= v_total_matches
    )
    ON CONFLICT (matchday_id, user_id)
    DO UPDATE SET
        predictions_made = v_predictions_count,
        points_earned = v_total_points,
        correct_predictions = v_correct_count,
        is_complete = v_predictions_count >= v_total_matches,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update challenge participant total points
CREATE OR REPLACE FUNCTION update_challenge_participant_points(p_challenge_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_total_points INTEGER;
    v_total_correct INTEGER;
BEGIN
    -- Sum points across all matchdays
    SELECT
        COALESCE(SUM(mp.points_earned), 0),
        COALESCE(SUM(mp.correct_predictions), 0)
    INTO v_total_points, v_total_correct
    FROM public.matchday_participants mp
    INNER JOIN public.challenge_matchdays cm ON mp.matchday_id = cm.id
    WHERE cm.challenge_id = p_challenge_id AND mp.user_id = p_user_id;

    -- Update challenge_participants
    UPDATE public.challenge_participants
    SET
        points = v_total_points,
        updated_at = NOW()
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to update matchday and challenge stats when prediction is created/updated
CREATE OR REPLACE FUNCTION on_swipe_prediction_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update matchday participant stats
    PERFORM update_matchday_participant_stats(NEW.matchday_id, NEW.user_id);

    -- Update challenge participant total points
    PERFORM update_challenge_participant_points(NEW.challenge_id, NEW.user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_stats_on_prediction
    AFTER INSERT OR UPDATE ON public.swipe_predictions
    FOR EACH ROW
    EXECUTE FUNCTION on_swipe_prediction_change();

-- ============================================================================
-- 7. INDEXES FOR LEADERBOARD QUERIES
-- ============================================================================

-- Index for global challenge leaderboard (ordered by points)
CREATE INDEX idx_challenge_participants_leaderboard
    ON public.challenge_participants(challenge_id, points DESC, created_at ASC);

-- Index for daily matchday leaderboard
CREATE INDEX idx_matchday_participants_leaderboard
    ON public.matchday_participants(matchday_id, points_earned DESC, created_at ASC);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
-- ✓ challenge_matchdays - Daily matchdays within a challenge
-- ✓ matchday_fixtures - Links fixtures to matchdays
-- ✓ swipe_predictions - User predictions for each match
-- ✓ matchday_participants - Daily participation stats
--
-- Functions created:
-- ✓ get_or_create_matchday_participant() - Helper for participation
-- ✓ update_matchday_participant_stats() - Updates daily stats
-- ✓ update_challenge_participant_points() - Updates cumulative points
-- ✓ on_swipe_prediction_change() - Trigger function for auto-updates
--
-- Features:
-- ✓ Multi-day challenges with daily matchdays
-- ✓ Cumulative leaderboard across all matchdays
-- ✓ Daily leaderboard per matchday
-- ✓ Automatic points calculation
-- ✓ Deadline enforcement for predictions
-- ✓ RLS policies for security
-- ============================================================================
