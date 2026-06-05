-- ============================================================================
-- FIX HANDLE_NEW_LEAGUE FUNCTION - Allow API imports without created_by
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Show current function
DO $$
BEGIN
  RAISE NOTICE '======================================== CURRENT FUNCTION ========================================';
  RAISE NOTICE 'Current handle_new_league function creates league_member even when created_by is NULL';
  RAISE NOTICE 'This causes errors for API imports that don''t have a user';
  RAISE NOTICE '';
END $$;

-- Update the function to skip league_member creation when created_by is NULL
CREATE OR REPLACE FUNCTION public.handle_new_league()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only create a league member if created_by is provided
  -- This allows API imports to create leagues without a user
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
  END IF;

  RETURN NEW;
END;
$function$;

-- Add comment explaining the behavior
COMMENT ON FUNCTION public.handle_new_league() IS
'Automatically adds the league creator as an admin member.
Skips member creation for API imports where created_by is NULL.';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================== UPDATED FUNCTION ========================================';
  RAISE NOTICE '✅ SUCCESS: handle_new_league function updated';
  RAISE NOTICE '';
  RAISE NOTICE 'Behavior:';
  RAISE NOTICE '  - If created_by IS NOT NULL: Creates league_member with role=admin';
  RAISE NOTICE '  - If created_by IS NULL: Skips league_member creation (for API imports)';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now import leagues from API-Football without authentication!';
  RAISE NOTICE '======================================== ========================================';
END $$;
