# Fantasy Data Seeding - Deployment Guide

This guide explains how to deploy and use the Fantasy football data seeding system.

## Overview

The Fantasy Data Seeding system populates Supabase with comprehensive player data from API-Football for 20 priority leagues. It includes:

- **Player Season Statistics**: Season-level aggregated stats (appearances, goals, assists, rating, etc.)
- **Player Match Statistics**: Match-by-match performance data
- **Player Transfers**: Complete transfer history
- **PGS Calculation**: Player Game Score with the correct formula
- **Player Categorization**: Automatic classification into Star/Key/Wild categories

## Prerequisites

- Supabase project with API-Football integration already set up
- API-Football key configured in Supabase secrets
- 7,500 API requests/day quota available
- Profile Stats migration already deployed (`20250709100000_profile_stats_views.sql`)

## Deployment Steps

### Step 1: Deploy Database Migration

1. Open Supabase SQL Editor at `https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new`

2. Copy and paste the content from:
   ```
   supabase/migrations/20250710100000_fantasy_player_stats.sql
   ```

3. Click **Run** to execute the migration

4. Verify the migration succeeded:
   ```sql
   SELECT 'Fantasy player stats tables created successfully!' as status;
   ```

### Step 2: Deploy Edge Function

Deploy the `seed-fantasy-data` edge function:

```bash
cd /Users/sj/Desktop/Sportime
supabase functions deploy seed-fantasy-data
```

### Step 3: Verify Configuration

Ensure the following environment variables are set in Supabase:

- `API_FOOTBALL_KEY`: Your API-Football API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for database writes)

Check in Supabase Dashboard → Project Settings → Edge Functions → Secrets

## Database Schema

### Tables Created

#### 1. `player_season_stats`
Season-level statistics for each player:
- Appearances, minutes played, starting XI
- Performance: rating, goals, assists
- Detailed stats: shots, passes, tackles, duels, dribbles
- Discipline: yellow/red cards
- Goalkeeper stats (saves, goals conceded, clean sheets)
- **Calculated metrics**: `impact_score`, `consistency_score`, `pgs`, `pgs_category`
- Market value

**Key Indexes**:
- `player_id`, `season`, `team_id`
- `pgs DESC` (for leaderboards)
- `pgs_category` (for player filtering)

#### 2. `player_match_stats`
Match-by-match performance:
- Minutes played, starting status, substitute info
- Rating, position
- Goals, assists, shots, passes, tackles, duels, dribbles
- Fouls, cards
- Goalkeeper stats

**Key Indexes**:
- `player_id`, `fixture_id`
- `rating DESC` (for best performances)

#### 3. `player_transfers`
Complete transfer history:
- Transfer date
- From/to teams (with UUIDs if in database)
- Transfer type (Transfer, Loan, Free)
- Transfer fee

**Key Indexes**:
- `player_id`
- `transfer_date DESC`

### PGS Calculation Formula

The Player Game Score (PGS) is calculated using the following formula:

```
PGS = (rating × 0.5) + (impact × 0.3) + (consistency × 0.2) + playtime_adjustment
```

**Where**:
- **Rating**: Player's average match rating (from API-Football)
- **Impact**: Weighted score based on goals, assists, key passes, dribbles, tackles, shots on target
- **Consistency**: Score based on rating variance (10 - stddev × 2), clamped to 0-10
- **Playtime Adjustment**:
  - +0.3 for ≥90% playtime ratio
  - +0.15 for 50-89% playtime ratio
  - +0.05 for <50% playtime ratio

**Player Categories**:
- **Star**: PGS > 7.5 (elite players)
- **Key**: PGS > 6.5 (reliable starters)
- **Wild**: PGS ≤ 6.5 (rotation/bench players)

### SQL Functions

#### `calculate_impact_score()`
Calculates impact score based on:
- Goals (weight: 1.0)
- Assists (weight: 0.7)
- Key passes (weight: 0.3)
- Successful dribbles (weight: 0.2)
- Tackles (weight: 0.15)
- Shots on target (weight: 0.1)

Normalized to 0-10 scale per game.

#### `calculate_consistency_score()`
Calculates consistency based on rating standard deviation across matches.
Lower variance = higher consistency score.

#### `calculate_pgs()`
Main PGS calculation function applying the correct formula with playtime adjustments.

#### `get_pgs_category()`
Returns player category ('star', 'key', 'wild') based on PGS value.

### Triggers

**`trigger_update_player_season_stats`**:
Automatically recalculates `impact_score`, `consistency_score`, `pgs`, and `pgs_category` whenever player season stats are inserted or updated.

## Using the Admin UI

### Access the Fantasy Data Sync Panel

1. Navigate to the Admin page in your Sportime app
2. Scroll to the **Fantasy Data Seeding** section
3. Review the priority leagues (20 leagues listed)

### Start the Seeding Process

1. Verify the season (default: 2024) in the "Initial Data Import" section above
2. Click **Start Fantasy Data Seeding**
3. Monitor the progress bar and messages

### What Gets Seeded

**Phase 1 - Leagues** (~20 API calls):
- Basic league data (name, logo, country) for all 20 priority leagues

**Phase 2 - Teams & Players** (~6,000-8,000 API calls):
- All teams for priority leagues (~400 teams)
- Full squads (30 players per team = ~12,000 players)

**Phase 3 - Player Statistics** (~6,000-8,000 API calls):
- Season stats for all players
- Calculates PGS, impact, consistency automatically

**Phase 4 - Transfers** (~2,000-4,000 API calls):
- Transfer history for all players

**Total Estimated API Calls**: 12,000-15,000

### API Quota Management

With a 7,500 requests/day quota:
- **Day 1**: Leagues + Teams + ~6,000 players
- **Day 2**: Remaining players + player stats
- **Day 3**: Transfers and final stats

The process can be safely interrupted and resumed. Already-seeded data won't be re-fetched (upsert logic).

### Progress Tracking

The UI shows:
- Current stage (Leagues, Teams & Players, Player Statistics, Transfers)
- Progress bar (current/total)
- Detailed messages for each operation
- Error messages if any API calls fail

## Priority Leagues

The system seeds 20 priority leagues with full data:

### Top 5 European Leagues
- Premier League (England) - API ID: 39
- La Liga (Spain) - API ID: 140
- Serie A (Italy) - API ID: 135
- Bundesliga (Germany) - API ID: 78
- Ligue 1 (France) - API ID: 61

### European Competitions
- UEFA Champions League - API ID: 2
- UEFA Europa League - API ID: 3

### Major European Leagues
- Primeira Liga (Portugal) - API ID: 94
- Eredivisie (Netherlands) - API ID: 88
- Jupiler Pro League (Belgium) - API ID: 144
- Süper Lig (Turkey) - API ID: 203

### South American Leagues
- Série A (Brazil) - API ID: 71
- Liga Profesional (Argentina) - API ID: 128

### Other Major Leagues
- Major League Soccer (USA) - API ID: 253
- Saudi Pro League - API ID: 307

### Second Divisions
- Championship (England) - API ID: 40
- La Liga 2 (Spain) - API ID: 141

### Asian/Other Leagues
- Ligue 1 (Algeria) - API ID: 188
- Premier League (Russia) - API ID: 235
- Liga MX (Mexico) - API ID: 106

## Data Architecture

### Staging Pattern

The system uses the existing API-Football staging pattern:

1. **Staging Tables** (`fb_*`): Store raw API data with INTEGER IDs
   - `fb_leagues`
   - `fb_teams`
   - `fb_players`

2. **Database Triggers**: Automatically sync to production tables with UUIDs
   - `leagues`
   - `teams`
   - `players`

3. **Fantasy Stats Tables**: Store player statistics
   - `player_season_stats`
   - `player_match_stats`
   - `player_transfers`

### Data Flow

```
API-Football
    ↓
Edge Function (seed-fantasy-data)
    ↓
Staging Tables (fb_*)
    ↓ (automatic triggers)
Production Tables (leagues, teams, players)
    ↓
Fantasy Stats Tables (player_season_stats, etc.)
    ↓ (automatic triggers)
Calculate PGS & Categorization
```

## Verification

### Check Seeded Data

```sql
-- Check leagues
SELECT COUNT(*) as league_count FROM leagues WHERE api_id IN (
  39, 140, 135, 78, 61, 2, 3, 94, 88, 144, 203, 71, 128, 253, 307, 40, 141, 188, 235, 106
);

-- Check teams
SELECT COUNT(*) as team_count FROM teams WHERE id IN (
  SELECT DISTINCT team_id FROM player_season_stats
);

-- Check players
SELECT COUNT(*) as player_count FROM players WHERE api_id IS NOT NULL;

-- Check player season stats
SELECT COUNT(*) as stats_count FROM player_season_stats;

-- Check PGS distribution
SELECT
  pgs_category,
  COUNT(*) as count,
  AVG(pgs) as avg_pgs,
  MIN(pgs) as min_pgs,
  MAX(pgs) as max_pgs
FROM player_season_stats
WHERE pgs IS NOT NULL
GROUP BY pgs_category
ORDER BY pgs_category;

-- Top 20 players by PGS
SELECT
  p.name,
  t.name as team,
  l.name as league,
  pss.pgs,
  pss.pgs_category,
  pss.appearances,
  pss.goals,
  pss.assists,
  pss.rating
FROM player_season_stats pss
JOIN players p ON p.id = pss.player_id
JOIN teams t ON t.id = pss.team_id
JOIN leagues l ON l.id = pss.league_id
WHERE pss.pgs IS NOT NULL
ORDER BY pss.pgs DESC
LIMIT 20;
```

### Expected Results

- **Leagues**: 20 priority leagues
- **Teams**: ~400 teams (20 leagues × ~20 teams each)
- **Players**: ~12,000 players (400 teams × 30 players each)
- **Season Stats**: ~12,000 player season stat records
- **PGS Categories**:
  - Star: ~5-10% of players (PGS > 7.5)
  - Key: ~15-25% of players (PGS > 6.5)
  - Wild: ~65-80% of players (PGS ≤ 6.5)

## Troubleshooting

### Edge Function Errors

**Error: API_FOOTBALL_KEY not configured**
- Solution: Add API key to Supabase Edge Function secrets

**Error: Rate limit exceeded**
- Solution: Wait 24 hours for API quota to reset, then resume seeding

**Error: Player not found in DB**
- Solution: Ensure the base import (leagues, teams, players) completed successfully first

### Data Quality Issues

**PGS is NULL for many players**
- Cause: Players haven't played enough matches (need rating data)
- Solution: This is expected for bench/youth players

**Consistency score is 0**
- Cause: No match-level data available yet
- Solution: Consistency requires match stats; it will be calculated after match data is seeded

### Performance Issues

**Seeding is slow**
- Cause: API rate limiting (500ms delay between calls)
- Solution: This is by design to stay within quota. Be patient.

**Edge Function timeout**
- Cause: Processing too much data in one invocation
- Solution: The function should handle this gracefully. If not, reduce the number of leagues.

## Maintenance

### Updating Player Stats

Run the seeding process again periodically (e.g., once per week during season) to:
- Update player statistics
- Add new transfers
- Recalculate PGS based on latest performance

The upsert logic ensures existing data is updated, not duplicated.

### Manual Refresh

To manually refresh a specific player's stats:

```sql
-- Trigger recalculation for a player
UPDATE player_season_stats
SET updated_at = NOW()
WHERE player_id = 'YOUR_PLAYER_UUID';
```

The trigger will automatically recalculate impact, consistency, PGS, and category.

## Next Steps

After deployment:

1. ✅ Deploy the SQL migration
2. ✅ Deploy the Edge Function
3. ✅ Verify environment variables
4. Run the Fantasy Data Seeding from Admin UI
5. Monitor progress over 2-3 days
6. Verify data quality with SQL queries
7. Integrate Fantasy Mode UI with player data
8. Implement player search and filtering
9. Build Fantasy team creation interface
10. Add PGS leaderboards

## Related Documentation

- [Profile Stats Deployment](./deploy_profile_stats.sql)
- [API-Football Integration](./supabase/functions/api-football-proxy/index.ts)
- [Data Sync Admin](./src/components/DataSyncAdmin.tsx)

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Verify API quota hasn't been exceeded
3. Check database table permissions (RLS policies)
4. Review this guide's troubleshooting section
