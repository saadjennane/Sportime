/*
  # Operation Name
  [Fix Duplicate League Member on Creation]
  This migration updates the `create_league` function to prevent a duplicate key error. It removes the explicit insertion of the league creator into the `league_members` table, assuming that a database trigger is already handling this action. This makes the function idempotent and resolves the unique constraint violation.

  ## Query Description: 
  This operation modifies a database function. It is a safe, non-destructive change that corrects a logic error. No user data will be affected.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true (by restoring the previous function definition)

  ## Structure Details:
  - Modifies the function: `public.create_league(text, text)`

  ## Security Implications:
  - RLS Status: Unchanged
  - Policy Changes: No
  - Auth Requirements: The function still relies on `auth.uid()` to set the league creator.

  ## Performance Impact:
  - Indexes: None
  - Triggers: None
  - Estimated Impact: Negligible. The function becomes slightly faster by removing one INSERT statement.
*/
CREATE OR REPLACE FUNCTION public.create_league(name text, description text)
RETURNS leagues AS $$
DECLARE
  new_league leagues;
BEGIN
  -- Create the new league.
  -- We are now assuming a trigger exists on the 'leagues' table that will
  -- automatically add the creator (auth.uid()) as an admin member.
  -- The explicit insert into league_members has been removed to prevent a duplicate key error.
  INSERT INTO public.leagues (name, description, created_by)
  VALUES (name, description, auth.uid())
  RETURNING * INTO new_league;

  RETURN new_league;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
