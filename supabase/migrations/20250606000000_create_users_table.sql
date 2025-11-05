/*
# [Create Users Table and Auth Integration]
This script creates a `users` table to store public user profiles and integrates it with Supabase's built-in authentication system.

## Query Description:
This operation will:
1. Create a new `public.users` table for storing profile data like usernames and coin balances.
2. Link this table to `auth.users` using a foreign key, ensuring data integrity.
3. Set up a database trigger that automatically creates a new user profile row whenever a new user signs up via Supabase Auth. This is a safe and recommended pattern.
4. Enable Row Level Security (RLS) on the new table and create policies that allow users to only view and edit their own data.

This operation is safe and does not affect any existing data, as it only creates new database objects.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- **Tables Created:** `public.users`
- **Functions Created:** `public.handle_new_user()`
- **Triggers Created:** `on_auth_user_created` on `auth.users`
- **RLS Policies Added:** SELECT (self), UPDATE (self), DELETE (none) on `public.users`

## Security Implications:
- RLS Status: Enabled on `public.users`
- Policy Changes: Yes, new policies are created to secure user data.
- Auth Requirements: Policies are tied to the authenticated user's ID (`auth.uid()`).

## Performance Impact:
- Indexes: A primary key index is created on `users(id)`.
- Triggers: A trigger is added to `auth.users`, which will have a negligible performance impact on user sign-ups.
- Estimated Impact: Low.
*/

-- 1. Create the public.users table
CREATE TABLE public.users (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE,
    username text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coins_balance integer DEFAULT 1000 NOT NULL,
    referral_code text,
    referred_by text,
    is_premium boolean DEFAULT false NOT NULL
);

comment on table public.users is 'Public user profiles, linked to Supabase auth.';

-- 2. Create a function to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$;

-- 3. Create a trigger to execute the function after a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable Row Level Security (RLS) on the new table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY "Allow authenticated users to read their own user record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update their own user record"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Disallow users from deleting their records"
  ON public.users FOR DELETE
  USING (false);
