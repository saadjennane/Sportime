# Fix Odds Permissions - Execution Guide

## Current Situation
The odds synchronization is failing with a **401 Unauthorized** error because the RLS policies on `fb_odds` table don't allow authenticated users to write data.

## Immediate Solution
Execute the `fix_fb_odds_rls.sql` script in your Supabase SQL Editor to open write access to authenticated users.

## Steps to Execute

### 1. Access Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `crypuzduplbzbmvefvzr`
3. Click on "SQL Editor" in the left menu
4. Click "New Query"

### 2. Copy and Execute the Script
Copy the entire content of `fix_fb_odds_rls.sql` and paste it into the SQL Editor, then click "Run".

```sql
-- Fix RLS policies for fb_odds to allow admin writes
-- This allows authenticated users (admin interface) to write odds data

-- Enable RLS if not already enabled
ALTER TABLE public.fb_odds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service_role full access for fb_odds" ON public.fb_odds;
DROP POLICY IF EXISTS "Allow authenticated read access for fb_odds" ON public.fb_odds;
DROP POLICY IF EXISTS "Allow authenticated write access for fb_odds" ON public.fb_odds;

-- Allow ALL authenticated users to read and write
-- (In production, you might want to restrict this to admin role only)
CREATE POLICY "Allow authenticated full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service_role full access
CREATE POLICY "Allow service_role full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.fb_odds TO authenticated;
GRANT ALL ON public.fb_odds TO service_role;

-- Verify the setup
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'fb_odds'
ORDER BY policyname;
```

### 3. Verify the Policies
The last query in the script will show you the policies. You should see:
- `Allow authenticated full access for fb_odds` (FOR ALL)
- `Allow service_role full access for fb_odds` (FOR ALL)

### 4. Test the Odds Synchronization
1. Go to your admin interface on Vercel: https://your-admin-url.vercel.app
2. Navigate to "Data Sync" page
3. Click "Sync Odds" button
4. You should see progress messages and successful synchronization

### 5. Verify Odds Display
1. Go back to the main app
2. Check the Espanyol vs Sevilla match (or any other match today)
3. Odds should now be displayed correctly

## What This Script Does

✅ **Enables RLS** on `fb_odds` table if not already enabled
✅ **Removes restrictive policies** that blocked authenticated user writes
✅ **Creates open policy** allowing all authenticated users to read/write
✅ **Maintains service_role access** for backend operations
✅ **Grants necessary permissions** to authenticated role
✅ **Verifies the setup** with a diagnostic query

## Future Security Enhancement

Once the immediate issue is resolved, you can implement the admin role system using the DRAFT migration:
- `supabase/migrations/20251124120000_admin_roles_security.sql`

This will:
- Add a `role` column to profiles (user, admin, super_admin)
- Create `is_admin()` helper function
- Restrict write operations to admin/super_admin only
- Provide `promote_user_to_admin()` function for role management

Apply this later when you're ready to implement proper admin security.

## Troubleshooting

### If the script fails with "relation does not exist"
The `fb_odds` table might not exist. Check:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'fb_odds';
```

### If you still get 401 after execution
1. Clear browser cache/cookies
2. Log out and log back into the admin interface
3. Check that you're using the correct Supabase project URL in your .env

### If odds still don't sync
1. Check that fixtures are synced first (they must exist in `fb_fixtures`)
2. Verify your API Football key is valid and has quota remaining
3. Check browser console for specific error messages

## Summary

**Before:** 401 Unauthorized when writing to `fb_odds`
**After:** Authenticated users can write odds data
**Impact:** Odds synchronization will work, matches will display betting odds

Execute the script now and test immediately!
