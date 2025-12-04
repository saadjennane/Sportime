-- Make created_by nullable in leagues table to allow imports without authentication
-- This allows the admin dashboard to import leagues via API without requiring user session

-- Step 1: Make created_by nullable
ALTER TABLE public.leagues
ALTER COLUMN created_by DROP NOT NULL;

-- Step 2: Add comment explaining the change
COMMENT ON COLUMN public.leagues.created_by IS 'User who created this league. Nullable to allow API imports.';
