# fb_teams Schema Cache Error - Fix Summary

## 🚨 Current Issue

**Error**: `"Could not find the 'code' column of 'fb_teams' in the schema cache"`

**Location**: Edge Function `seed-fantasy-data` at Phase 2 (Teams & Players seeding)

**When it occurs**: When trying to save team data from API-Football to fb_teams staging table

## 🔍 Root Cause Analysis

1. **Migration defines the column**: The migration file `20250710000000_api_football_staging_tables.sql` (line 33) clearly defines:
   ```sql
   CREATE TABLE IF NOT EXISTS public.fb_teams (
     id BIGINT PRIMARY KEY,
     name TEXT NOT NULL,
     code TEXT, -- 3-letter code (e.g., 'MCI')
     ...
   );
   ```

2. **Edge Function expects the column**: The Edge Function (lines 154-163) tries to insert:
   ```typescript
   await supabase.from('fb_teams').upsert({
     id: teamData.team.id,
     name: teamData.team.name,
     code: teamData.team.code,  // ← This causes PGRST204 error
     country: teamData.team.country,
     // ... more fields
   }, {
     onConflict: 'id',
   });
   ```

3. **PostgREST schema cache is stale**: Even though the migration was successfully run, PostgREST's internal schema cache hasn't picked up the `code` column. This is a known issue with PostgREST where DDL changes don't immediately reflect.

## ✅ Solution: Two Options

### Option 1: Add Missing Column (SAFE - Recommended)

**File**: `fix_fb_teams_schema.sql`

**What it does**:
- Checks if 'code' column exists
- Adds it if missing (using ALTER TABLE)
- Safe to run multiple times (idempotent)
- Preserves existing data

**How to use**:
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new)
2. Copy entire content from `fix_fb_teams_schema.sql`
3. Paste and click **RUN**
4. Verify output shows column was added or already exists
5. Retry Fantasy Data Seeding from Admin UI

### Option 2: Recreate Table (DESTRUCTIVE - Last Resort)

**File**: `fix_fb_teams_recreate.sql`

**What it does**:
- Drops fb_teams table completely
- Recreates with correct schema (all 13 columns)
- Recreates indexes and RLS policies
- **DELETES ALL DATA IN fb_teams**

**When to use**:
- Only if Option 1 doesn't work
- If table structure is completely corrupted
- When you're okay with losing existing data (it will be re-seeded anyway)

**How to use**:
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new)
2. Copy entire content from `fix_fb_teams_recreate.sql`
3. Paste and click **RUN**
4. Verify output shows all 13 columns with correct types
5. Retry Fantasy Data Seeding from Admin UI

## 📋 Diagnostic Script

**File**: `verify_schema.sql`

**What it does**:
- Lists all columns in fb_teams with their types
- Checks if table exists
- Shows column count

**How to use**:
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new)
2. Copy entire content from `verify_schema.sql`
3. Paste and click **RUN**
4. Review output to see current schema

## 🎯 Expected Results After Fix

After running either Option 1 or Option 2, the fb_teams table should have these columns:

| Column Name       | Data Type    | Nullable |
|-------------------|--------------|----------|
| id                | bigint       | NO       |
| name              | text         | NO       |
| **code**          | **text**     | **YES**  | ← This is the missing column
| country           | text         | YES      |
| founded           | integer      | YES      |
| national          | boolean      | YES      |
| logo              | text         | YES      |
| venue_name        | text         | YES      |
| venue_city        | text         | YES      |
| venue_capacity    | integer      | YES      |
| payload           | jsonb        | YES      |
| created_at        | timestamptz  | YES      |
| updated_at        | timestamptz  | YES      |

## 🔄 Next Steps After Fix

1. **Refresh Admin UI**: Reload the Sportime Admin page
2. **Retry Seeding**: Click "Start Fantasy Data Seeding" button
3. **Monitor Logs**: Watch Edge Function logs at:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data/logs
4. **Verify Progress**: Should see:
   - Phase 1: ✓ 3 leagues seeded
   - Phase 2: ✓ ~60 teams saved (no more 'code' column errors)
   - Phase 2: ✓ ~1,800 players saved
   - Phase 2.5: ✓ Teams and players synced to production
   - Phase 3: Player stats calculation begins
   - Phase 4: Transfer history begins

## 📚 Related Files

- **Migrations**:
  - `supabase/migrations/20250710000000_api_football_staging_tables.sql` - Original migration with correct schema
  - `supabase/migrations/20250710100000_fantasy_player_stats.sql` - Fantasy stats tables

- **Edge Function**:
  - `supabase/functions/seed-fantasy-data/index.ts` - Main seeding logic

- **Fix Scripts**:
  - `fix_fb_teams_schema.sql` - Safe column addition
  - `fix_fb_teams_recreate.sql` - Table recreation (destructive)
  - `verify_schema.sql` - Schema diagnostic

- **Documentation**:
  - `DEPLOYMENT_STATUS.md` - Full deployment status and troubleshooting
  - `FANTASY_DEPLOYMENT_GUIDE.md` - Quick deployment reference
  - `SCHEMA_FIX_SUMMARY.md` - This file

## ❓ Why Did This Happen?

Two possible scenarios:

1. **Table existed before migration**: If fb_teams was created in an earlier attempt without the 'code' column, the `CREATE TABLE IF NOT EXISTS` statement would skip creating it, leaving the old schema in place.

2. **PostgREST cache issue**: Even if the migration created the column correctly, PostgREST's schema cache may not have refreshed, causing PGRST204 errors even though the column physically exists in the database.

**The fix scripts handle both scenarios**:
- Option 1 adds the column if missing (handles scenario 1)
- Option 2 forces a clean recreation (handles both scenarios)
- Both should refresh the PostgREST schema cache

## ✅ Success Criteria

You'll know the fix worked when:
1. ✅ No more PGRST204 errors in Edge Function logs
2. ✅ Teams are successfully saved to fb_teams
3. ✅ Log shows: `[seedLeagueTeams] ✓ 20 teams saved` (per league)
4. ✅ Edge Function progresses to Phase 2.5 (Syncing to Production)
5. ✅ Eventually completes all 5 phases without schema errors
