# Deploy Fantasy Migration - Quick Guide

## ✅ Edge Function Deployed

The `seed-fantasy-data` Edge Function has been successfully deployed to Supabase!

**Dashboard URL**: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions

## 📋 Next Step: Deploy SQL Migration

### Option 1: Via Supabase SQL Editor (Recommended)

1. Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql/new

2. Copy the **entire content** from:
   ```
   supabase/migrations/20250710100000_fantasy_player_stats.sql
   ```

3. Paste into the SQL Editor

4. Click **RUN** (or press Cmd+Enter)

5. Verify success - you should see:
   ```
   | status                                            |
   | ------------------------------------------------- |
   | Fantasy player stats tables created successfully! |
   ```

### Option 2: Via Supabase CLI (if db push works)

```bash
npx supabase db push
```

Note: This may fail if there are pending migrations. Use Option 1 if this happens.

## ✅ Verification Steps

After deploying the migration, verify the tables exist:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('player_season_stats', 'player_match_stats', 'player_transfers');

-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'calculate_impact_score',
  'calculate_consistency_score',
  'calculate_pgs',
  'get_pgs_category'
);

-- Check trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'trigger_update_player_season_stats';
```

Expected results:
- 3 tables
- 4 functions
- 1 trigger

## 🚀 Start Fantasy Data Seeding

Once migration is deployed:

1. Go to Admin page in your Sportime app
2. Scroll to **Fantasy Data Seeding** section
3. Review the 20 priority leagues
4. Click **Start Fantasy Data Seeding**
5. Monitor progress (will take 2-3 days due to API quota)

## 📊 Environment Variables to Check

Make sure these are set in Supabase Edge Functions:

- `API_FOOTBALL_KEY`: Your API-Football key
- `SUPABASE_URL`: Already set (https://crypuzduplbzbmvefvzr.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database writes

Check at: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/settings/functions

## 📖 Full Documentation

See `FANTASY_DATA_DEPLOYMENT.md` for complete documentation including:
- Detailed schema explanation
- PGS formula breakdown
- Troubleshooting guide
- Verification queries
- Maintenance procedures
