-- Game Builder: tier/duration/source-league for filtering + auto cost.
ALTER TABLE public.tq_competitions ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'amateur';
ALTER TABLE public.tq_competitions ADD COLUMN IF NOT EXISTS duration_type TEXT DEFAULT 'flash';
ALTER TABLE public.tq_competitions ADD COLUMN IF NOT EXISTS source_league_id UUID;  -- already may exist
ALTER TABLE public.challenges      ADD COLUMN IF NOT EXISTS source_league_id UUID;
ALTER TABLE public.fantasy_games   ADD COLUMN IF NOT EXISTS source_league_id UUID;
