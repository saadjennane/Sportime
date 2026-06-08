-- Reusable reward packs (tiers of position brackets -> stacked reward items),
-- assignable to any game. Tiers schema (jsonb array):
--   { positionType: 'rank'|'range'|'percent'|'participation', start, end,
--     rewards: [{ type, quantity, value?, tier?, name?, logo? }] }
CREATE TABLE IF NOT EXISTS public.reward_packs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  tiers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reward_packs_admin ON public.reward_packs;
CREATE POLICY reward_packs_admin ON public.reward_packs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_packs TO authenticated;

-- Link + rewards storage on each game type.
ALTER TABLE public.challenges      ADD COLUMN IF NOT EXISTS reward_pack_id UUID;
ALTER TABLE public.tq_competitions ADD COLUMN IF NOT EXISTS reward_pack_id UUID;
ALTER TABLE public.fantasy_games   ADD COLUMN IF NOT EXISTS reward_pack_id UUID;
ALTER TABLE public.fantasy_games   ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]'::jsonb;
