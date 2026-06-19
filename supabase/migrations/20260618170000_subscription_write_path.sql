-- =====================================================
-- Single authoritative subscription writer — resolves the is_subscribed/is_subscriber
-- naming split.
--
-- Reality (pre-baseline schema, probed live):
--   • public.users    has column  is_subscribed   (base)
--   • public.profiles has column  is_subscriber   (what the whole app reads)
-- We don't rename (the profiles relation is defined outside migrations and may be a
-- view). Instead, ALL subscription writes go through set_subscription(), which updates
-- whichever of the two actually exists/updatable — so the app's read (profiles.is_subscriber)
-- always reflects the change. The RevenueCat webhook (and any admin tool) calls this.
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_subscription(
  p_user_id   UUID,
  p_active    BOOLEAN,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Base flag on users (read by the app via profiles.is_subscriber when profiles is a view).
  BEGIN
    UPDATE public.users SET is_subscribed = p_active WHERE id = p_user_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  -- If profiles is its own table (not an updatable view), mirror the flag there too.
  BEGIN
    UPDATE public.profiles SET is_subscriber = p_active WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;  -- non-updatable view / missing column → ignore

  -- Best-effort expiry on users.
  IF p_expires_at IS NOT NULL THEN
    BEGIN
      UPDATE public.users SET subscription_expires_at = p_expires_at WHERE id = p_user_id;
    EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
END $$;

-- Only the server (webhook / admin) may flip subscription — never the client itself.
REVOKE EXECUTE ON FUNCTION public.set_subscription(UUID, BOOLEAN, TIMESTAMPTZ) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_subscription(UUID, BOOLEAN, TIMESTAMPTZ) TO service_role;
