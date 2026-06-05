-- ============================================================================
-- Deploy Notifications Schema Manually
-- Run this in Supabase SQL Editor
-- ============================================================================

-- TABLE 1: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('gameplay', 'league', 'squad', 'premium', 'reminder', 'system')),
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 100),
  message TEXT NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 500),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  action_label TEXT CHECK (action_label IS NULL OR char_length(action_label) <= 50),
  action_link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  onesignal_notification_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_notifications_update ON public.notifications;
CREATE TRIGGER on_notifications_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- TABLE 2: user_onesignal_players
CREATE TABLE IF NOT EXISTS public.user_onesignal_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('web', 'ios', 'android')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_user_onesignal_players_user_id ON public.user_onesignal_players(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onesignal_players_player_id ON public.user_onesignal_players(player_id);
CREATE INDEX IF NOT EXISTS idx_user_onesignal_players_active ON public.user_onesignal_players(user_id, is_active) WHERE is_active = TRUE;

ALTER TABLE public.user_onesignal_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own OneSignal players" ON public.user_onesignal_players;
CREATE POLICY "Users can view their own OneSignal players"
  ON public.user_onesignal_players FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own OneSignal players" ON public.user_onesignal_players;
CREATE POLICY "Users can insert their own OneSignal players"
  ON public.user_onesignal_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own OneSignal players" ON public.user_onesignal_players;
CREATE POLICY "Users can update their own OneSignal players"
  ON public.user_onesignal_players FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage OneSignal players" ON public.user_onesignal_players;
CREATE POLICY "System can manage OneSignal players"
  ON public.user_onesignal_players FOR ALL
  USING (true);

DROP TRIGGER IF EXISTS on_user_onesignal_players_update ON public.user_onesignal_players;
CREATE TRIGGER on_user_onesignal_players_update
  BEFORE UPDATE ON public.user_onesignal_players
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- TABLE 3: notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  gameplay_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  league_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  squad_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  premium_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  system_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_notification_preferences_update ON public.notification_preferences;
CREATE TRIGGER on_notification_preferences_update
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- HELPER FUNCTION: Create default notification preferences
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_create_notification_prefs ON public.users;
CREATE TRIGGER on_user_created_create_notification_prefs
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();

-- HELPER FUNCTION: Get user notification preferences
CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS TABLE (
  gameplay_enabled BOOLEAN,
  league_enabled BOOLEAN,
  squad_enabled BOOLEAN,
  premium_enabled BOOLEAN,
  reminder_enabled BOOLEAN,
  system_enabled BOOLEAN,
  push_enabled BOOLEAN,
  in_app_enabled BOOLEAN,
  email_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.gameplay_enabled,
    np.league_enabled,
    np.squad_enabled,
    np.premium_enabled,
    np.reminder_enabled,
    np.system_enabled,
    np.push_enabled,
    np.in_app_enabled,
    np.email_enabled
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- HELPER FUNCTION: Create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_label TEXT DEFAULT NULL,
  p_action_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_onesignal_notification_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_label,
    action_link,
    metadata,
    onesignal_notification_id
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_action_label,
    p_action_link,
    p_metadata,
    p_onesignal_notification_id
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify deployment
SELECT 'Notifications schema deployed successfully!' as status;
