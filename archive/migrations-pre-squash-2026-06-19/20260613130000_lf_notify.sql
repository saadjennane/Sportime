-- "Notify me when lineups are published" for a fixture's Live Fantasy.
CREATE TABLE IF NOT EXISTS public.lf_notify (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, fixture_id UUID NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fixture_id)
);
ALTER TABLE public.lf_notify ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lf_notify_own ON public.lf_notify;
CREATE POLICY lf_notify_own ON public.lf_notify FOR ALL USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
GRANT ALL ON public.lf_notify TO authenticated;

CREATE OR REPLACE FUNCTION public.lf_notify_me(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  INSERT INTO public.lf_notify (user_id, fixture_id) VALUES (v_user, p_fixture_id) ON CONFLICT (user_id, fixture_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.lf_notify_me(UUID) TO authenticated;
