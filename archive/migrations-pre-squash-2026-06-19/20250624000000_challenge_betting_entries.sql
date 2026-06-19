/*
  # Challenge Betting Entries

  Introduces normalized tables to store per-user betting challenge data:
  - challenge_entries: one per user/challenge with entry metadata
  - challenge_daily_entries: per-day booster state
  - challenge_bets: individual match bets per day
  Also adds a day_number column to challenge_matches to support daily grouping.

  RLS ensures users can manage their own data while keeping challenges readable.
*/

-- 1) Ensure challenge_matches has a day indicator
ALTER TABLE public.challenge_matches
  ADD COLUMN IF NOT EXISTS day_number INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_challenge_matches_challenge_day
  ON public.challenge_matches (challenge_id, day_number);

-- 2) Challenge entries (one per user/challenge)
CREATE TABLE IF NOT EXISTS public.challenge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_method TEXT NOT NULL CHECK (entry_method IN ('coins', 'ticket')),
  ticket_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own challenge entries"
  ON public.challenge_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin read challenge entries"
  ON public.challenge_entries
  FOR SELECT
  USING (public.is_admin());

CREATE TRIGGER on_challenge_entries_updated
  BEFORE UPDATE ON public.challenge_entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 3) Daily entries (per day booster data)
CREATE TABLE IF NOT EXISTS public.challenge_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_entry_id UUID NOT NULL REFERENCES public.challenge_entries(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  booster_type TEXT CHECK (booster_type IN ('x2', 'x3')),
  booster_match_id UUID REFERENCES public.challenge_matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_entry_id, day_number)
);

ALTER TABLE public.challenge_daily_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily challenge entries"
  ON public.challenge_daily_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_entries ce
      WHERE ce.id = challenge_entry_id
      AND ce.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.challenge_entries ce
      WHERE ce.id = challenge_entry_id
      AND ce.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin read challenge daily entries"
  ON public.challenge_daily_entries
  FOR SELECT
  USING (public.is_admin());

CREATE TRIGGER on_challenge_daily_entries_updated
  BEFORE UPDATE ON public.challenge_daily_entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 4) Individual bets
CREATE TABLE IF NOT EXISTS public.challenge_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_entry_id UUID NOT NULL REFERENCES public.challenge_daily_entries(id) ON DELETE CASCADE,
  challenge_match_id UUID NOT NULL REFERENCES public.challenge_matches(id) ON DELETE CASCADE,
  prediction TEXT NOT NULL CHECK (prediction IN ('teamA', 'draw', 'teamB')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (daily_entry_id, challenge_match_id)
);

ALTER TABLE public.challenge_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own challenge bets"
  ON public.challenge_bets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_daily_entries cde
      JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
      WHERE cde.id = daily_entry_id
      AND ce.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.challenge_daily_entries cde
      JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
      WHERE cde.id = daily_entry_id
      AND ce.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin read challenge bets"
  ON public.challenge_bets
  FOR SELECT
  USING (public.is_admin());

CREATE TRIGGER on_challenge_bets_updated
  BEFORE UPDATE ON public.challenge_bets
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_challenge_entries_user ON public.challenge_entries(user_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_daily_entries_entry ON public.challenge_daily_entries(challenge_entry_id);
CREATE INDEX IF NOT EXISTS idx_challenge_bets_daily_entry ON public.challenge_bets(daily_entry_id);

-- 6) Helper function to join betting challenge with balance handling
CREATE OR REPLACE FUNCTION public.join_betting_challenge(
  p_challenge_id UUID,
  p_user_id UUID,
  p_method TEXT,
  p_ticket_id UUID DEFAULT NULL
) RETURNS TABLE(already_joined BOOLEAN, coins_balance INTEGER) AS $$
DECLARE
  v_entry_cost INTEGER;
  v_rows BIGINT;
  v_balance INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_method NOT IN ('coins', 'ticket') THEN
    RAISE EXCEPTION 'Invalid entry method %', p_method;
  END IF;

  SELECT entry_cost INTO v_entry_cost
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF p_method = 'coins' AND NOT already_joined THEN
    SELECT coins_balance INTO v_balance
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_balance < v_entry_cost THEN
      RAISE EXCEPTION 'INSUFFICIENT_COINS';
    END IF;

    UPDATE public.users
    SET coins_balance = coins_balance - v_entry_cost
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;
  ELSE
    SELECT coins_balance INTO v_balance
    FROM public.users
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method, ticket_id)
  VALUES (p_challenge_id, p_user_id, p_method, p_ticket_id)
  ON CONFLICT (challenge_id, user_id) DO UPDATE
  SET entry_method = EXCLUDED.entry_method,
      ticket_id = EXCLUDED.ticket_id,
      updated_at = now();

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_betting_challenge(UUID, UUID, TEXT, UUID) TO authenticated;
