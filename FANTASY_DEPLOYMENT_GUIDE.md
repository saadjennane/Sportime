# Fantasy Data Seeding - Quick Deployment Guide

## ✅ Status

- ✅ Edge Function `seed-fantasy-data` deployed to Supabase
- ✅ Fantasy SQL migration ready
- ✅ Admin UI with Fantasy Data Seeding panel ready
- 📋 Next: Deploy SQL migration

## 🚀 Deployment Steps

### Step 1: Deploy SQL Migration (5 minutes)

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new

2. Copy the **entire content** from:
   `supabase/migrations/20250710100000_fantasy_player_stats.sql`

3. Paste into SQL Editor and click **RUN**

4. Verify success message:
   ```
   | status                                            |
   | ------------------------------------------------- |
   | Fantasy player stats tables created successfully! |
   ```

### Step 2: Verify Environment Variables (2 minutes)

Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/settings/functions

Check these secrets exist:
- ✅ `API_FOOTBALL_KEY` (your API-Football key)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Start Fantasy Data Seeding

1. Open Sportime Admin page
2. Scroll to **Fantasy Data Seeding** section
3. Review 20 priority leagues
4. Click **Start Fantasy Data Seeding**
5. Monitor progress (2-3 days with API quota)

## 📊 What Will Be Seeded

- **20 priority leagues** with full data
- **~400 teams** (20 × 20)
- **~12,000 players** (400 × 30)
- Season statistics
- Match-by-match stats
- Transfer history
- **PGS calculation** with correct formula
- **Player categorization** (Star/Key/Wild)

## 🔍 Verification Queries

After migration deployment, verify:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('player_season_stats', 'player_match_stats', 'player_transfers');

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'calculate_%' OR routine_name = 'get_pgs_category';
```

Expected: 3 tables, 4 functions

## ⚠️ Important Notes

- **API Quota**: 7,500 req/day → seeding takes 2-3 days
- **Formula**: PGS = (rating×0.5) + (impact×0.3) + (consistency×0.2) + playtime_adjustment
- **Playtime**: +0.3 (≥90%), +0.15 (50-89%), +0.05 (<50%)
- **Categories**: Star (>7.5), Key (>6.5), Wild (≤6.5)

## 📚 Resources

- Full documentation: See commit 9a478bb for complete implementation details
- Edge Function: `supabase/functions/seed-fantasy-data/index.ts`
- SQL Migration: `supabase/migrations/20250710100000_fantasy_player_stats.sql`
- Admin UI: `src/components/DataSyncAdmin.tsx` (Fantasy Data Seeding section)
