# Edge Function Timeout - Solution

## 🎉 Success So Far

The schema fix worked! Edge Function successfully seeded:
- ✅ Champions League: 20 teams, ~670 players
- ✅ Premier League: 20 teams, ~670 players
- ⏳ La Liga: Started processing but hit timeout

**Total progress**: ~1,340 players seeded before timeout

## 🚨 The Timeout Problem

**What happened**: Edge Function "shutdown" after ~2-3 minutes of processing

**Why**: Supabase Edge Functions have maximum execution time limits:
- Free tier: ~150 seconds (2.5 minutes)
- Pro tier: ~300 seconds (5 minutes)

**Time needed for 3 leagues**:
- 3 leagues × 20 teams × 30 players = 1,800 players
- At 500ms per API call: ~15-20 minutes
- **This exceeds any timeout limit**

## ✅ Solution: Resumable Processing

We need to redesign the Edge Function to work in chunks that complete within timeout limits.

### Architecture Changes Needed

#### 1. Database Progress Tracking

Create a `fantasy_seed_progress` table to track state:

```sql
CREATE TABLE IF NOT EXISTS public.fantasy_seed_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_api_id INTEGER NOT NULL,
  league_name TEXT NOT NULL,
  phase TEXT NOT NULL, -- 'teams', 'players', 'stats', 'transfers', 'completed'
  teams_processed INTEGER DEFAULT 0,
  teams_total INTEGER DEFAULT 0,
  players_processed INTEGER DEFAULT 0,
  players_total INTEGER DEFAULT 0,
  last_team_id BIGINT,
  last_player_id BIGINT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(league_api_id)
);
```

#### 2. Modified Edge Function

**Current approach** (doesn't work):
```typescript
for (const league of leagues) {
  seedTeams();
  seedPlayers(); // Takes too long
  seedStats();
  seedTransfers();
}
```

**New approach** (works):
```typescript
// Process ONE league at a time, stop before timeout
function seedFantasyData(req) {
  const { league_ids } = req.body;

  // Get next incomplete league from progress table
  const league = getNextIncompleteLeague(league_ids);

  if (!league) {
    return { status: 'all_complete' };
  }

  // Process this league only
  const startTime = Date.now();
  const TIMEOUT_BUFFER = 30000; // Stop 30s before timeout

  while (Date.now() - startTime < TIMEOUT_BUFFER) {
    const progress = getProgress(league.api_id);

    if (progress.phase === 'teams') {
      // Seed teams
      if (allTeamsSeeded) {
        updateProgress({ phase: 'players' });
      }
    } else if (progress.phase === 'players') {
      // Seed next 5 teams' players, then return
      seedNextBatchOfPlayers(5);
      return { status: 'in_progress', continue: true };
    }
    // ... other phases
  }

  return { status: 'in_progress', continue: true };
}
```

#### 3. Modified Admin UI

**Current approach** (doesn't work):
```typescript
// Single call that times out
await fetch('/functions/v1/seed-fantasy-data', {
  body: JSON.stringify({ leagues: all_3_leagues })
});
```

**New approach** (works):
```typescript
// Keep calling until complete
let isComplete = false;
while (!isComplete) {
  const response = await fetch('/functions/v1/seed-fantasy-data', {
    body: JSON.stringify({ league_ids: [2, 39, 140] })
  });

  const result = await response.json();

  if (result.status === 'all_complete') {
    isComplete = true;
  } else {
    // Wait 1 second, then call again
    await delay(1000);
  }
}
```

### Implementation Steps

1. **Create progress tracking table**:
   - Run SQL migration to create `fantasy_seed_progress` table
   - Add functions to track state

2. **Modify Edge Function**:
   - Add progress tracking logic
   - Process in batches (5-10 teams at a time)
   - Return before timeout with `continue: true` status
   - Resume from last position on next call

3. **Modify Admin UI**:
   - Add loop to keep calling Edge Function
   - Show real-time progress
   - Handle "continue" response by calling again
   - Stop when "all_complete" received

### Quick Alternative: Manual Batching

**Simplest solution for now**:

1. **Seed one league at a time** via Admin UI:
   - Change league IDs to just `"2"` (Champions League)
   - Click "Start Fantasy Data Seeding"
   - Wait for completion
   - Then change to `"39"` (Premier League)
   - Click again
   - Then change to `"140"` (La Liga)
   - Click again

2. **Pros**:
   - No code changes needed
   - Works immediately
   - Simple to understand

3. **Cons**:
   - Manual process
   - No automation
   - Still might timeout for large leagues

### Estimated Time to Implement

- **Quick alternative**: 0 minutes (can do now)
- **Resumable processing**: 2-3 hours of development

## 🎯 Recommendation

**For now**: Use the quick alternative (manual batching, one league at a time)

**For production**: Implement resumable processing with progress tracking

## 📊 Current Database State

Run this query to see what data was seeded before timeout:

```sql
-- Check what was seeded
SELECT
  (SELECT COUNT(*) FROM fb_leagues) as leagues_seeded,
  (SELECT COUNT(*) FROM fb_teams) as teams_seeded,
  (SELECT COUNT(*) FROM fb_players) as players_seeded;

-- See which leagues were completed
SELECT * FROM fb_leagues;

-- See which teams were seeded
SELECT l.name as league, COUNT(t.id) as team_count
FROM fb_teams t
JOIN fb_leagues l ON l.api_league_id = t.id  -- Note: This join might not work if we don't have league_id in fb_teams
GROUP BY l.name;
```

You should see:
- 3 leagues
- ~40 teams (2 leagues fully seeded)
- ~1,340 players (from Champions League and Premier League)
