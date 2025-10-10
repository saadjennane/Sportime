/*
          # [Operation Name]
          Create League System

          [Description of what this operation does]
          This migration sets up the full database structure for a private league system. It includes tables for leagues and their members, along with the necessary security policies and functions to manage creation, joining, leaving, and administration.

          ## Query Description: [This operation creates new tables and functions for the league feature. It does not affect existing data but adds significant new functionality to the database schema. No backup is strictly required as it only adds new objects, but it's always good practice.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tables Created: `leagues`, `league_members`
          - Types Created: `league_role` (enum)
          - Functions Created: `generate_random_string`, `create_league`, `join_league_with_code`, `leave_league`, `reset_league_invite_code`, `remove_league_member`, `delete_league`
          
          ## Security Implications:
          - RLS Status: Enabled on new tables.
          - Policy Changes: Yes, new policies are created for `leagues` and `league_members`.
          - Auth Requirements: All operations are authenticated and checked against user roles within a league.
          
          ## Performance Impact:
          - Indexes: Primary keys and foreign keys are indexed by default. A unique index is added to `leagues(invite_code)`.
          - Triggers: None.
          - Estimated Impact: Low impact on existing operations.
          */

-- 1. CREATE ENUM TYPE FOR ROLES
CREATE TYPE public.league_role AS ENUM ('admin', 'member');

-- 2. CREATE LEAGUES TABLE
CREATE TABLE public.leagues (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    description text NULL,
    image_url text NULL,
    invite_code text NOT NULL,
    created_by uuid NOT NULL,
    CONSTRAINT leagues_pkey PRIMARY KEY (id),
    CONSTRAINT leagues_invite_code_key UNIQUE (invite_code),
    CONSTRAINT leagues_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL
);
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- 3. CREATE LEAGUE_MEMBERS TABLE
CREATE TABLE public.league_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    league_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.league_role NOT NULL DEFAULT 'member',
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT league_members_pkey PRIMARY KEY (id),
    CONSTRAINT league_members_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues (id) ON DELETE CASCADE,
    CONSTRAINT league_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT league_members_league_id_user_id_key UNIQUE (league_id, user_id)
);
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;


-- 4. RLS POLICIES
-- Leagues Table
CREATE POLICY "Allow authenticated users to create leagues" ON public.leagues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow members to view their leagues" ON public.leagues FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.league_members
        WHERE league_members.league_id = leagues.id AND league_members.user_id = auth.uid()
    )
);
CREATE POLICY "Allow admin to update their league" ON public.leagues FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.league_members
        WHERE league_members.league_id = leagues.id AND league_members.user_id = auth.uid() AND league_members.role = 'admin'
    )
);
CREATE POLICY "Allow admin to delete their league" ON public.leagues FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.league_members
        WHERE league_members.league_id = leagues.id AND league_members.user_id = auth.uid() AND league_members.role = 'admin'
    )
);

-- League Members Table
CREATE POLICY "Allow users to see members of their own leagues" ON public.league_members FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.league_members AS self_membership
        WHERE self_membership.league_id = league_members.league_id AND self_membership.user_id = auth.uid()
    )
);
CREATE POLICY "Allow users to join a league" ON public.league_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow users to leave a league" ON public.league_members FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Allow admin to remove other members" ON public.league_members FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.league_members AS admin_membership
        WHERE admin_membership.league_id = league_members.league_id AND admin_membership.user_id = auth.uid() AND admin_membership.role = 'admin'
    ) AND user_id <> auth.uid()
);


-- 5. HELPER AND RPC FUNCTIONS
-- Function to generate a random string for invite codes
CREATE OR REPLACE FUNCTION public.generate_random_string(length integer)
RETURNS text
LANGUAGE sql
AS $$
    SELECT string_agg(
        (
            SELECT '0123456789abcdefghijklmnopqrstuvwxyz'::text
            ORDER BY random()
            LIMIT 1
        ), ''
    )
    FROM generate_series(1, length);
$$;

-- Function to create a league and add creator as admin
CREATE OR REPLACE FUNCTION public.create_league(
    league_name text,
    league_description text DEFAULT NULL,
    league_image_url text DEFAULT NULL
)
RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_league public.leagues;
    new_invite_code text;
BEGIN
    -- Generate a unique invite code
    LOOP
        new_invite_code := public.generate_random_string(8);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.leagues WHERE invite_code = new_invite_code);
    END LOOP;

    -- Insert the new league
    INSERT INTO public.leagues (name, description, image_url, invite_code, created_by)
    VALUES (league_name, league_description, league_image_url, new_invite_code, auth.uid())
    RETURNING * INTO new_league;

    -- Add the creator as an admin member
    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (new_league.id, auth.uid(), 'admin');

    RETURN new_league;
END;
$$;

-- Function to join a league using an invite code
CREATE OR REPLACE FUNCTION public.join_league_with_code(code text)
RETURNS public.league_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_league_id uuid;
    new_member public.league_members;
BEGIN
    SELECT id INTO target_league_id FROM public.leagues WHERE invite_code = code;

    IF target_league_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    -- Insert the new member, ON CONFLICT DO NOTHING handles if user is already a member
    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (target_league_id, auth.uid(), 'member')
    ON CONFLICT (league_id, user_id) DO NOTHING
    RETURNING * INTO new_member;

    RETURN new_member;
END;
$$;

-- Function to reset a league's invite code (admin only)
CREATE OR REPLACE FUNCTION public.reset_league_invite_code(league_id_to_reset uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_invite_code text;
    is_admin boolean;
BEGIN
    -- Check if the current user is an admin of the league
    SELECT EXISTS (
        SELECT 1 FROM public.league_members
        WHERE league_id = league_id_to_reset AND user_id = auth.uid() AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Only admins can reset the invite code.';
    END IF;

    -- Generate a new unique invite code
    LOOP
        new_invite_code := public.generate_random_string(8);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.leagues WHERE invite_code = new_invite_code);
    END LOOP;

    -- Update the league with the new code
    UPDATE public.leagues
    SET invite_code = new_invite_code
    WHERE id = league_id_to_reset;

    RETURN new_invite_code;
END;
$$;

-- Function for an admin to remove another member
CREATE OR REPLACE FUNCTION public.remove_league_member(p_league_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- Ensure the calling user is an admin
    SELECT EXISTS (
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = auth.uid() AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Permission denied. Only admins can remove members.';
    END IF;

    -- Prevent admin from removing themselves with this function
    IF auth.uid() = p_user_id THEN
        RAISE EXCEPTION 'Admins cannot remove themselves. Use leave_league() instead.';
    END IF;
    
    DELETE FROM public.league_members WHERE league_id = p_league_id AND user_id = p_user_id;
END;
$$;

-- Function for a user to leave a league, with ownership transfer logic
CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_role public.league_role;
    member_count integer;
    next_admin_id uuid;
BEGIN
    -- Get the role of the current user in the specified league
    SELECT role INTO current_user_role FROM public.league_members
    WHERE league_id = p_league_id AND user_id = auth.uid();

    IF current_user_role IS NULL THEN
        RAISE EXCEPTION 'You are not a member of this league.';
    END IF;

    -- Delete the user's membership
    DELETE FROM public.league_members WHERE league_id = p_league_id AND user_id = auth.uid();

    -- If the user was an admin, handle ownership transfer or deletion
    IF current_user_role = 'admin' THEN
        SELECT count(*) INTO member_count FROM public.league_members WHERE league_id = p_league_id;

        IF member_count > 0 THEN
            -- Transfer ownership to the longest-standing member
            SELECT user_id INTO next_admin_id FROM public.league_members
            WHERE league_id = p_league_id
            ORDER BY joined_at ASC
            LIMIT 1;

            UPDATE public.league_members
            SET role = 'admin'
            WHERE league_id = p_league_id AND user_id = next_admin_id;

            UPDATE public.leagues
            SET created_by = next_admin_id
            WHERE id = p_league_id;
        ELSE
            -- No members left, delete the league
            DELETE FROM public.leagues WHERE id = p_league_id;
        END IF;
    END IF;
END;
$$;

-- Function for an admin to delete a league
CREATE OR REPLACE FUNCTION public.delete_league(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- Ensure the calling user is an admin
    SELECT EXISTS (
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = auth.uid() AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Permission denied. Only admins can delete a league.';
    END IF;

    DELETE FROM public.leagues WHERE id = p_league_id;
END;
$$;
