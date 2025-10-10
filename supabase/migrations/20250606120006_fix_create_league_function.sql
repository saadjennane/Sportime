/*
# [Function Update]
This operation updates the 'create_league' function to use simplified parameter names.

## Query Description:
- This script modifies an existing database function.
- It changes the parameter names from 'p_name' and 'p_description' to 'name' and 'description'.
- This change is required to fix an inconsistency between the application code and the database, which was causing errors when creating a new league.
- This is a non-destructive operation and has no impact on existing data.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by reverting to the old function definition)

## Security Implications:
- RLS Status: Not applicable
- Policy Changes: No
- Auth Requirements: The function still requires an authenticated user.
*/

create or replace function public.create_league(name text, description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_league_id uuid;
  new_invite_code text;
  user_id uuid := auth.uid();
begin
  -- Generate a unique invite code
  new_invite_code := public.generate_random_string(8);
  while exists(select 1 from public.leagues where invite_code = new_invite_code) loop
    new_invite_code := public.generate_random_string(8);
  end loop;

  -- Insert the new league
  insert into public.leagues (name, description, created_by, invite_code)
  values (name, description, user_id, new_invite_code)
  returning id into new_league_id;

  -- Automatically add the creator as an admin
  insert into public.league_members (league_id, user_id, role)
  values (new_league_id, user_id, 'admin');

  return new_league_id;
end;
$$;
