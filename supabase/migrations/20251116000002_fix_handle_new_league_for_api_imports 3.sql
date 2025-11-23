-- Fix handle_new_league function to support API imports without created_by
-- Only create league_member if created_by is not NULL

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

COMMENT ON FUNCTION public.handle_new_league() IS
'Automatically adds the league creator as an admin member.
Skips member creation for API imports where created_by is NULL.';
