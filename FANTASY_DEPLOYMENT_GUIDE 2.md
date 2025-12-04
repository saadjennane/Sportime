# Fantasy Data Seeding - Quick Deployment Guide

## ✅ Status

- ✅ Edge Function `seed-fantasy-data` deployed to Supabase
- ✅ Fantasy SQL migrations ready
- ✅ Admin UI with Fantasy Data Seeding panel ready
- ✅ League selection UI implemented (3 default leagues)
- 📋 Next: Deploy SQL migrations

## 🚀 Deployment Steps

### Step 1: Deploy API-Football Staging Tables (3 minutes)

**IMPORTANT**: This step must be done FIRST before the Fantasy migration!

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

### Step 2: Deploy Fantasy Player Stats Migration (5 minutes)

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

### Step 3: Verify Environment Variables (2 minutes)

Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/settings/functions

Check these secrets exist:
- ✅ `API_FOOTBALL_KEY` (your API-Football key)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Start Fantasy Data Seeding

1. Open Sportime Admin page
2. Scroll to **Fantasy Data Seeding** section
3. Review selected leagues (default: 3 leagues - UCL, Premier League, La Liga)
4. Optionally modify league IDs (comma-separated, e.g., "2, 39, 140, 135")
5. Click **Start Fantasy Data Seeding**
6. Monitor progress (<1 day for 3 leagues)

## 📊 What Will Be Seeded (Default: 3 Leagues)

- **3 priority leagues** with full data (UCL, Premier League, La Liga)
- **~60 teams** (3 × 20)
- **~1,800 players** (60 × 30)
- Season statistics
- Match-by-match stats
- Transfer history
- **PGS calculation** with correct formula
- **Player categorization** (Star/Key/Wild)

**Note**: You can add more leagues by editing the league IDs input field in the Admin UI.

## 🔍 Verification Queries

After migration deployment, verify:

```sql
-- Check staging tables (Step 1)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'fb_%';
```
Expected: 5 tables (fb_leagues, fb_teams, fb_players, fb_fixtures, fb_odds)

```sql
-- Check Fantasy tables (Step 2)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('player_season_stats', 'player_match_stats', 'player_transfers');
```
Expected: 3 tables

```sql
-- Check Fantasy functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'calculate_%' OR routine_name = 'get_pgs_category';
```
Expected: 4 functions

## ⚠️ Important Notes

- **API Quota**: 7,500 req/day
  - 3 leagues: ~1,800-2,400 calls → <1 day
  - 20 leagues: ~12,000-15,000 calls → 2-3 days
- **Formula**: PGS = (rating×0.5) + (impact×0.3) + (consistency×0.2) + playtime_adjustment
- **Playtime**: +0.3 (≥90%), +0.15 (50-89%), +0.05 (<50%)
- **Categories**: Star (>7.5), Key (>6.5), Wild (≤6.5)

## 📚 Resources

- Staging Tables Migration: `supabase/migrations/20250710000000_api_football_staging_tables.sql`
- Fantasy Stats Migration: `supabase/migrations/20250710100000_fantasy_player_stats.sql`
- Edge Function: `supabase/functions/seed-fantasy-data/index.ts`
- Admin UI: `src/components/DataSyncAdmin.tsx` (Fantasy Data Seeding section)
- League Config: `src/data/priorityLeagues.ts`
