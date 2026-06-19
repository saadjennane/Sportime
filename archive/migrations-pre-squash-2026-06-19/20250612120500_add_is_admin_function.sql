/*
# [Function] Create is_admin helper function
This function checks if the currently authenticated user has administrative privileges.

## Query Description:
- This script creates a reusable SQL function `public.is_admin()`.
- It checks the `is_admin` boolean column in the `public.users` table for the current user.
- This function is required by several Row Level Security (RLS) policies to grant administrators full access to tables.
- There is no risk to existing data. This is a safe, additive change.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Function: `public.is_admin()`

## Security Implications:
- RLS Status: This function is intended for use in RLS policies.
- Policy Changes: No
- Auth Requirements: Requires an authenticated user context (`auth.uid()`).

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. The function performs a fast primary key lookup on the `users` table.
*/
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (
    SELECT COALESCE(is_admin, FALSE)
    FROM public.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users so RLS policies can use it
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
