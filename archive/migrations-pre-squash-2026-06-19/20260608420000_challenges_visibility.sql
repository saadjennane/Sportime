-- Game Builder visibility toggle for challenges (Match Day Challenge, etc.).
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
