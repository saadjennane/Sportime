/*
# [Fix] Make League Creation Idempotent
This migration corrects a persistent "duplicate key" error that occurs during league creation.

## Query Description:
The `create_league` function is being modified to handle cases where a user might be added as a member multiple times, which can happen if a database trigger and the function logic both attempt the same action. By adding an `ON CONFLICT DO NOTHING` clause to the member insertion step, we make the function robust and prevent it from failing. This ensures that even if a duplicate insertion is attempted, it is safely ignored instead of causing an error.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by restoring the previous function definition)

## Structure Details:
- Modifies the `public.create_league(text, text)` function.

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: Authenticated users

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible.
*/

-- Drop the old function to ensure a clean replacement, avoiding "cannot change return type" errors.
DROP FUNCTION IF EXISTS public.create_league(text,text);

-- Recreate the function with the idempotent insert logic.
CREATE OR REPLACE FUNCTION public.create_league(
    p_name text,
    p_description text
)
-- The function now returns the new league's ID.
RETURNS uuid AS $$
DECLARE
    new_league_id uuid;
    new_invite_code text;
BEGIN
    -- Generate a unique invite code
    new_invite_code := public.generate_random_string(8);
    WHILE EXISTS (SELECT 1 FROM public.leagues WHERE leagues.invite_code = new_invite_code) LOOP
        new_invite_code := public.generate_random_string(8);
    END LOOP;

    -- Insert the new league
    INSERT INTO public.leagues (name, description, invite_code, created_by)
    VALUES (p_name, p_description, new_invite_code, auth.uid())
    RETURNING leagues.id INTO new_league_id;

    -- Insert the creator as an admin member.
    -- ON CONFLICT ensures that if the user is already a member (e.g., due to a race condition or a stray trigger),
    -- the query will not fail. This is the key fix.
    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (new_league_id, auth.uid(), 'admin')
    ON CONFLICT (league_id, user_id) DO NOTHING;

    -- Return just the ID of the new league.
    RETURN new_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_league(text,text) TO authenticated;
