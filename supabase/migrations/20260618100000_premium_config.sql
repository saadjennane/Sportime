-- =====================================================
-- Premium config — admin-editable values for the Premium subscription perks.
-- Stored in the existing game_config table (category = 'premium'), so amounts can
-- be tuned from the admin without a redeploy. The premium_daily_claim RPC reads these.
-- =====================================================

INSERT INTO public.game_config (id, category, key, value, description, version) VALUES
  ('premium_welcome_bonus_coins', 'premium', 'welcome_bonus_coins', to_jsonb(5000), 'One-time coin bonus on first subscription', 1),
  ('premium_daily_stipend_coins', 'premium', 'daily_stipend_coins', to_jsonb(200),  'Coins granted to subscribers each day', 1),
  ('premium_daily_tickets',       'premium', 'daily_tickets',       to_jsonb(1),     'Premium tournament tickets granted each day', 1),
  ('premium_ticket_expiry_days',  'premium', 'ticket_expiry_days',  to_jsonb(14),    'Expiry (days) of premium daily tickets', 1),
  ('premium_daily_spins',         'premium', 'daily_spins',         to_jsonb(1),     'Premium spinwheel spins granted each day', 1),
  ('premium_freeze_max',          'premium', 'freeze_max',          to_jsonb(6),     'Streak-freeze cap for subscribers (free users: 3)', 1),
  ('premium_freeze_every_days',   'premium', 'freeze_every_days',   to_jsonb(3),     'Earn one streak-freeze every N streak days (free users: 7)', 1)
ON CONFLICT (id) DO NOTHING;

-- Helper: read a premium config integer (falls back to a default if missing/disabled).
CREATE OR REPLACE FUNCTION public.premium_cfg_int(p_key TEXT, p_default INT)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::int FROM public.game_config
     WHERE category = 'premium' AND key = p_key AND is_active),
    p_default);
$$;
GRANT EXECUTE ON FUNCTION public.premium_cfg_int(TEXT, INT) TO authenticated, anon, service_role;
