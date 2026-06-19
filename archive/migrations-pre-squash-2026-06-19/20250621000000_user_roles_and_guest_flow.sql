/*
  # User Roles & Guest Flow Infrastructure

  This migration extends the existing `public.users` table to support the new
  user lifecycle (guest → authenticated → admin → super_admin) and introduces
  helper routines for generating guest usernames.

  ## Summary
  - Adds a dedicated enum `user_role_enum` with the required roles.
  - Extends `public.users` with profile fields (display name, level/xp, favourites).
  - Normalises admin flags (`is_admin`, `is_super_admin`) via a trigger.
  - Adds helper functions (`is_super_admin`, `generate_guest_username`).

  The changes are backwards compatible with existing data. Existing rows will be
  migrated to the new structure during this migration.
*/

-- 1) Create role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role_enum'
  ) THEN
    CREATE TYPE public.user_role_enum AS ENUM ('guest', 'user', 'admin', 'super_admin');
  END IF;
END
$$;

-- 2) Extend users table with the required columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_type public.user_role_enum NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS xp_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level TEXT NOT NULL DEFAULT 'Rookie',
  ADD COLUMN IF NOT EXISTS favorite_club TEXT,
  ADD COLUMN IF NOT EXISTS favorite_national_team TEXT,
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Keep legacy boolean for compatibility (already added in older migrations)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS badges_cache JSONB DEFAULT '[]'::JSONB;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_users_updated_at'
  ) THEN
    CREATE TRIGGER on_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_updated_at();
  END IF;
END $$;

-- 3) Normalise existing rows (user_type drives boolean flags)
UPDATE public.users
SET
  user_type = COALESCE(
    CASE
      WHEN user_type IS NOT NULL THEN user_type
      WHEN is_super_admin THEN 'super_admin'::public.user_role_enum
      WHEN is_admin THEN 'admin'::public.user_role_enum
      ELSE 'guest'::public.user_role_enum
    END,
    'guest'::public.user_role_enum
  ),
  is_admin = CASE
    WHEN COALESCE(user_type, 'guest'::public.user_role_enum) IN ('admin', 'super_admin') THEN true
    ELSE false
  END,
  is_super_admin = COALESCE(user_type, 'guest'::public.user_role_enum) = 'super_admin';

-- 4) Helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND is_super_admin = true
  );
END;
$$;

-- Update is_admin helper to rely on user_type
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND (
        is_admin = true
        OR is_super_admin = true
        OR user_type IN ('admin', 'super_admin')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 5) Trigger to keep role flags in sync
CREATE OR REPLACE FUNCTION public.sync_user_role_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_super_admin := NEW.user_type = 'super_admin';
  NEW.is_admin := NEW.user_type IN ('admin', 'super_admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_role_flags ON public.users;
CREATE TRIGGER trg_sync_user_role_flags
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_flags();

-- 6) Guest username generator
CREATE OR REPLACE FUNCTION public.generate_guest_username()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  adjectives TEXT[] := ARRAY['Amateur', 'Hobbyist', 'Recruit', 'FreeAgent', 'DraftPick'];
  candidate TEXT;
  tries INTEGER := 0;
BEGIN
  LOOP
    candidate :=
      adjectives[1 + floor(random() * array_length(adjectives, 1))::INT]
      || lpad((floor(random() * 9000) + 1000)::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users WHERE username = candidate
    ) OR tries > 10;

    tries := tries + 1;
  END LOOP;

  IF candidate IS NULL THEN
    candidate := 'Recruit' || floor(extract(epoch FROM now()));
  END IF;

  RETURN candidate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_guest_username() TO authenticated;

-- 7) Administrative RLS policy for super admins
DROP POLICY IF EXISTS "Super admins can manage users" ON public.users;
CREATE POLICY "Super admins can manage users"
  ON public.users FOR ALL
  USING (public.is_super_admin());

-- 8) Self-service profile completion (guest -> user)
CREATE OR REPLACE FUNCTION public.complete_guest_registration(
  p_username TEXT,
  p_display_name TEXT,
  p_email TEXT
) RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated public.users;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.users
  SET
    username = COALESCE(NULLIF(trim(p_username), ''), username, public.generate_guest_username()),
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name, username),
    email = COALESCE(NULLIF(trim(p_email), ''), email),
    user_type = 'user',
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_guest_registration(TEXT, TEXT, TEXT) TO authenticated;

-- 9) Admin role assignment helper
CREATE OR REPLACE FUNCTION public.set_user_role(
  p_user_id UUID,
  p_role public.user_role_enum
) RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.users;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  UPDATE public.users
  SET
    user_type = p_role,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.user_role_enum) TO authenticated;
