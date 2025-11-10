# Fantasy Data Seeding - Current Status and Next Steps

## 🚨 LATEST ISSUE (Nov 10, 2025) - Edge Function Timeout

**Previous Errors RESOLVED**:
- ✅ Schema cache error for 'code' column in fb_teams - FIXED
- ✅ Schema cache error for 'number' column in fb_players - FIXED

**Current Issue**: Edge Function shutdown due to execution time limit

**What worked**:
- ✅ Champions League: 20 teams, ~670 players seeded
- ✅ Premier League: 20 teams, ~670 players seeded
- ⏳ La Liga: Started processing but hit timeout

**Total progress**: ~1,340 players successfully seeded before shutdown

**Root Cause**: Supabase Edge Functions have max execution time (2-5 minutes). Processing 3 full leagues requires ~15-20 minutes.

**Problem**: Need to redesign Edge Function to work in resumable chunks within timeout limits.

### IMMEDIATE ACTION: Quick Workaround (Manual Batching)

**Since 2 leagues already succeeded**, just finish La Liga manually:

1. **In Admin UI**, change League IDs field from `2, 39, 140` to just `140`
2. Click "Start Fantasy Data Seeding"
3. Should complete La Liga within timeout (~2-3 minutes)
4. Then move to Phase 2.5 (Sync to production)
5. Then Phases 3 & 4 (Stats & Transfers) - these will also need separate runs

**Note**: For long-term solution, see `TIMEOUT_SOLUTION.md` for architecture redesign.

---

### ~~IMMEDIATE ACTION: Fix All Schema Columns~~ ✅ RESOLVED

**Status**: Schema fixes successfully applied

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new

2. Copy the **entire content** from:
   `fix_all_schema_columns.sql`

3. Paste into SQL Editor and click **RUN**

4. This script will:
   - Add 'code' column to fb_teams (if missing)
   - Add 'number' column to fb_players (if missing)
   - Add ALL other columns needed by Edge Function (firstname, lastname, age, birth_date, birth_place, birth_country, nationality, height, weight, photo, position, payload)
   - Show complete schema for both tables
   - Safe to run multiple times (idempotent)

5. After successful fix, retry Fantasy Data Seeding from Admin UI

---

### ~~IMMEDIATE ACTION: Check Edge Function Logs~~ ✅ DONE

1. **Go to Edge Function Logs**:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data/logs

2. **Find Latest Invocation**: Look for the most recent execution (timestamp matching when you clicked "Start Fantasy Data Seeding")

3. **Check for**:
   - What phase did it reach? (Phase 1, 2, 2.5, 3, or 4)
   - Last log message before stopping
   - Any error messages
   - How long did it run? (look at start/end timestamps)

4. **Share the logs** so we can determine next steps

### Potential Solutions (based on timeout hypothesis)

If logs confirm timeout issue, we have 3 options:

#### Option A: Test with Single League (Quick Test)
- Change league IDs to just `"2"` (Champions League only)
- See if it completes for 1 league
- If yes → timeout confirmed, need redesign

#### Option B: Client-Side Orchestration (Recommended)
- Break seeding into multiple smaller Edge Function calls
- Admin UI manages the sequence
- Each call completes within timeout
- Better progress tracking and error handling

#### Option C: Database Queue System
- Edge Function adds tasks to queue table
- Separate process picks up and executes tasks
- Runs in background over hours/days

---

## ✅ RESOLVED: Schema Cache Error (fb_teams 'code' column)

**Previous Error**: `"Could not find the 'code' column of 'fb_teams' in the schema cache"`

**Fix Applied**: ✅ Ran `fix_fb_teams_schema.sql` successfully

**Problem**: Edge Function was trying to insert 'code' column but PostgREST schema cache didn't recognize it.

**Edge Function columns being inserted** (lines 154-163 of index.ts):
- id, name, **code**, country, founded, national, logo, venue_name, venue_city, venue_capacity

**Solution**: Try Option 1 first (safe, adds column if missing). If that doesn't work, use Option 2 (recreates table, deletes data).

---

#### **Option 1: Add Missing Column (SAFE - Try This First)**

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new

2. Copy the **entire content** from:
   `fix_fb_teams_schema.sql`

3. Paste into SQL Editor and click **RUN**

4. Expected output:
   ```
   NOTICE: Code column already exists in fb_teams
   (or)
   NOTICE: Added code column to fb_teams

   | column_name | data_type | is_nullable |
   | ----------- | --------- | ----------- |
   | code        | text      | YES         |

   | status                         |
   | ------------------------------ |
   | fb_teams schema fix complete!  |
   ```

5. After successful fix, retry Fantasy Data Seeding from Admin UI

---

#### **Option 2: Recreate Table (DESTRUCTIVE - Only if Option 1 Fails)**

**WARNING**: This will delete all existing data in fb_teams table!

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new

2. Copy the **entire content** from:
   `fix_fb_teams_recreate.sql`

3. Paste into SQL Editor and click **RUN**

4. Expected output:
   ```
   | current_rows |
   | ------------ |
   | X            |  (shows how many rows will be deleted)

   [DROP and CREATE statements execute...]

   | column_name     | data_type | is_nullable |
   | --------------- | --------- | ----------- |
   | id              | bigint    | NO          |
   | name            | text      | NO          |
   | code            | text      | YES         |
   | country         | text      | YES         |
   | founded         | integer   | YES         |
   | national        | boolean   | YES         |
   | logo            | text      | YES         |
   | venue_name      | text      | YES         |
   | venue_city      | text      | YES         |
   | venue_capacity  | integer   | YES         |
   | payload         | jsonb     | YES         |
   | created_at      | timestamptz | YES       |
   | updated_at      | timestamptz | YES       |

   | status                                 |
   | -------------------------------------- |
   | fb_teams table recreated successfully! |
   ```

5. After successful fix, retry Fantasy Data Seeding from Admin UI

---

## ✅ PREVIOUS FIXES (Nov 10, 2025)

**Edge Function Fixed!** Resolved critical issues:
1. ✅ Fixed table references: `fb_players` → staging, `players` → production
2. ✅ Added Phase 2.5: Auto-sync staging → production before calculating stats
3. ✅ Edge Function redeployed successfully
4. ✅ Fixed fb_leagues schema mapping (api_league_id, country field)
5. ✅ Added comprehensive logging for debugging

**Previous Issue (RESOLVED)**: 500 error caused by:
- Edge Function trying to query non-existent `players` table before syncing from staging
- Missing synchronization step between staging tables and production tables
- Schema field naming mismatches

## 🔍 WHAT WAS FIXED

The Edge Function had a critical flaw: it populated `fb_players` (staging) but then tried to calculate Fantasy stats by querying `players` (production) which didn't exist yet.

**Solution**: Added Phase 2.5 that automatically syncs:
- `fb_teams` → `teams`
- `fb_players` → `players`

This ensures production tables are populated before Fantasy stats calculation begins.

## ✅ WHAT'S READY

1. ✅ **Edge Function deployed**: `seed-fantasy-data` is deployed to Supabase
2. ✅ **Admin UI implemented**: League selection with input field working
3. ✅ **League configuration**: Reduced to 3 leagues (UCL, Premier League, La Liga)
4. ✅ **SQL migrations created and fixed**:
   - `20250710000000_api_football_staging_tables.sql` (with api_id fixes)
   - `20250710100000_fantasy_player_stats.sql` (with DROP POLICY fixes)
5. ✅ **Deployment guide updated**: `FANTASY_DEPLOYMENT_GUIDE.md`

## 🚨 CRITICAL NEXT STEP: Deploy SQL Migrations

**YOU MUST deploy both SQL migrations BEFORE testing the Edge Function!**

### Step 1: Deploy Staging Tables Migration (REQUIRED FIRST)

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new

2. Copy the **entire content** from:
   `supabase/migrations/20250710000000_api_football_staging_tables.sql`

3. Paste into SQL Editor and click **RUN**

4. Verify success message:
   ```
   | status                                              |
   | --------------------------------------------------- |
   | API-Football staging tables created successfully!   |
   ```

5. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name LIKE 'fb_%'
   ORDER BY table_name;
   ```
   **Expected result**: 5 tables
   - fb_fixtures
   - fb_leagues
   - fb_odds
   - fb_players
   - fb_teams

### Step 2: Deploy Fantasy Stats Migration

1. Open Supabase SQL Editor (same link as above)

2. Copy the **entire content** from:
   `supabase/migrations/20250710100000_fantasy_player_stats.sql`

3. Paste into SQL Editor and click **RUN**

4. Verify success message:
   ```
   | status                                            |
   | ------------------------------------------------- |
   | Fantasy player stats tables created successfully! |
   ```

5. Verify tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('player_season_stats', 'player_match_stats', 'player_transfers')
   ORDER BY table_name;
   ```
   **Expected result**: 3 tables
   - player_match_stats
   - player_season_stats
   - player_transfers

6. Verify functions were created:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public'
   AND (routine_name LIKE 'calculate_%' OR routine_name = 'get_pgs_category')
   ORDER BY routine_name;
   ```
   **Expected result**: 4 functions
   - calculate_consistency_score
   - calculate_impact_score
   - calculate_pgs
   - get_pgs_category

### Step 3: Verify Environment Variables

Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/settings/functions

Check these secrets exist:
- ✅ `API_FOOTBALL_KEY` (your API-Football key)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

If any are missing, add them using:
```bash
npx supabase secrets set API_FOOTBALL_KEY=your_key_here
npx supabase secrets set SUPABASE_URL=your_url_here
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

### Step 4: Test Fantasy Data Seeding

1. Refresh the Sportime Admin page to ensure latest code is loaded
2. Scroll to **Fantasy Data Seeding** section
3. Review selected leagues (default: "2, 39, 140" - UCL, Premier League, La Liga)
4. Click **Start Fantasy Data Seeding**
5. The button should show "Seeding..." while processing
6. Monitor progress in Supabase Edge Function logs:
   - Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data/logs
   - Watch for any errors or progress messages

## 🐛 TROUBLESHOOTING (If Issues Occur)

If you encounter errors during seeding, check the Edge Function logs:

1. Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data
2. Click on **Logs** tab
3. Look for the most recent invocation (timestamp matching when you clicked the button)
4. Check the error message and stack trace

Common issues:
- **Missing environment variables**: Check Step 3 above
- **API key invalid**: Verify your API-Football key is active
- **Rate limit exceeded**: Check API-Football dashboard for quota (7,500/day)
- **Network/timeout**: API-Football might be down or slow
- **Migration not deployed**: Ensure both SQL migrations are deployed (Step 1 & 2)

## 📊 WHAT WILL HAPPEN DURING SEEDING (3 Leagues)

The Edge Function will process in 5 phases:

**Phase 1: Seed Leagues** (~3 API calls)
- Fetches league data for UCL, Premier League, La Liga
- Inserts into `fb_leagues` table

**Phase 2: Seed Teams & Players** (~1,800-2,100 API calls)
- For each league: ~20 teams → 60 teams total
- For each team: ~30 players → 1,800 players total
- Inserts into `fb_teams` and `fb_players` staging tables

**Phase 2.5: Sync to Production** (0 API calls - NEW!)
- Syncs `fb_teams` → `teams` production table
- Syncs `fb_players` → `players` production table
- Ensures production tables are ready for Fantasy stats

**Phase 3: Seed Season Stats** (~1,800 API calls)
- For each player: season statistics for 2024
- Inserts into `player_season_stats` table
- Automatically calculates PGS, impact, and consistency scores via trigger

**Phase 4: Seed Transfer History** (~1,800 API calls)
- For each player: transfer history
- Inserts into `player_transfers` table

**Total API calls**: ~3,600-5,400 (well within 7,500/day quota)
**Estimated time**: 4-8 hours (depends on API rate limiting)

## 📚 FILES REFERENCE

- **Migrations**:
  - `supabase/migrations/20250710000000_api_football_staging_tables.sql`
  - `supabase/migrations/20250710100000_fantasy_player_stats.sql`

- **Edge Function**:
  - `supabase/functions/seed-fantasy-data/index.ts`

- **Admin UI**:
  - `src/components/DataSyncAdmin.tsx` (Fantasy Data Seeding section)

- **League Config**:
  - `src/data/priorityLeagues.ts`

- **Deployment Guide**:
  - `FANTASY_DEPLOYMENT_GUIDE.md`

## 🎯 SUCCESS CRITERIA

After successful seeding, you should see:
- **fb_leagues**: 3 rows (UCL, Premier League, La Liga)
- **fb_teams**: ~60 rows
- **fb_players**: ~1,800 rows
- **player_season_stats**: ~1,800 rows with PGS scores
- **player_match_stats**: Varies (match-by-match data)
- **player_transfers**: Varies (transfer history)

You can verify with these queries:
```sql
-- Check staging tables
SELECT COUNT(*) as leagues FROM fb_leagues;
SELECT COUNT(*) as teams FROM fb_teams;
SELECT COUNT(*) as players FROM fb_players;

-- Check Fantasy tables
SELECT COUNT(*) as season_stats FROM player_season_stats;
SELECT COUNT(*) as match_stats FROM player_match_stats;
SELECT COUNT(*) as transfers FROM player_transfers;

-- Check PGS distribution
SELECT
  pgs_category,
  COUNT(*) as count,
  ROUND(AVG(pgs), 2) as avg_pgs,
  ROUND(MIN(pgs), 2) as min_pgs,
  ROUND(MAX(pgs), 2) as max_pgs
FROM player_season_stats
WHERE pgs IS NOT NULL
GROUP BY pgs_category
ORDER BY avg_pgs DESC;
```

## ⏭️ IMMEDIATE ACTION REQUIRED

**👉 Deploy the SQL migrations following Steps 1 and 2 above!**

The Edge Function cannot work without the database tables. Once the migrations are deployed, the 500 error should be resolved.
