-- Admin-controlled visibility of a league in the app.
ALTER TABLE public.fb_leagues ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
