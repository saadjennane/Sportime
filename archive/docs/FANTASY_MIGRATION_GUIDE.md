# Fantasy Game - Supabase Migration Guide

This guide shows how to migrate Fantasy components from mock data (`useMockStore`) to Supabase.

## Overview

The Fantasy game now has full Supabase backend support:
- ✅ Database schema (6 tables)
- ✅ PostgreSQL functions (5 RPC functions)
- ✅ RLS policies
- ✅ Seed data (13 players, 6 game weeks, 3 boosters)
- ✅ Service layer ([fantasyService.ts](src/services/fantasyService.ts))
- ✅ React hooks ([useFantasy.ts](src/hooks/useFantasy.ts))

## Migration Steps

### Step 1: Update Component Imports

**Before:**
```typescript
import { useMockStore } from '../store/useMockStore';
import { mockFantasyPlayers, mockBoosters } from '../data/mockFantasy';
```

**After:**
```typescript
import { useFantasyPlayers, useCurrentGameWeek, useFantasyTeam, useFantasyBoosters } from '../hooks/useFantasy';
import { FANTASY_GAME_ID } from '../config/constants';
```

### Step 2: Replace Mock Store with Hooks

**Before:**
```typescript
const {
  fantasyGames,
  userFantasyTeams,
  updateUserFantasyTeam
} = useMockStore();

const userTeam = userFantasyTeams.find(
  t => t.gameWeekId === selectedGameWeek.id && t.userId === currentUserId
);
```

**After:**
```typescript
const { players, isLoading: loadingPlayers } = useFantasyPlayers();
const { gameWeek, isLoading: loadingGameWeek } = useCurrentGameWeek(FANTASY_GAME_ID);
const { team, saveTeam, isSaving } = useFantasyTeam(currentUserId, gameWeek?.id || null);
const { boosters } = useFantasyBoosters();
```

### Step 3: Update Team Save Logic

**Before:**
```typescript
const handleUpdateUserTeam = (updatedTeam: UserFantasyTeam) => {
  updateUserFantasyTeam(updatedTeam);
};
```

**After:**
```typescript
const handleUpdateUserTeam = async (updatedTeam: UserFantasyTeam) => {
  const success = await saveTeam(updatedTeam);
  if (!success) {
    // Handle error (show toast, etc.)
    console.error('Failed to save Fantasy team');
  }
};
```

### Step 4: Handle Loading States

**Before:**
```typescript
// No loading states with mock data
return (
  <div>
    {/* Render content */}
  </div>
);
```

**After:**
```typescript
if (loadingPlayers || loadingGameWeek) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white">Loading Fantasy game...</p>
      </div>
    </div>
  );
}

if (!gameWeek) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white">No active game week found</p>
    </div>
  );
}

return (
  <div>
    {/* Render content */}
  </div>
);
```

## Example: Complete Component Migration

### Before (FantasyGameWeekPage.tsx - Mock Version)

```typescript
import { useMockStore } from '../store/useMockStore';
import { mockFantasyPlayers, mockBoosters } from '../data/mockFantasy';

export const FantasyGameWeekPage: React.FC<Props> = (props) => {
  const { userFantasyTeams, updateUserFantasyTeam } = useMockStore();

  const userTeam = userFantasyTeams.find(
    t => t.gameWeekId === selectedGameWeek.id && t.userId === currentUserId
  );

  const handleUpdateUserTeam = (updatedTeam: UserFantasyTeam) => {
    updateUserFantasyTeam(updatedTeam);
  };

  return (
    <div>
      {/* Component content */}
    </div>
  );
};
```

### After (FantasyGameWeekPage.tsx - Supabase Version)

```typescript
import {
  useFantasyPlayers,
  useCurrentGameWeek,
  useFantasyTeam,
  useFantasyBoosters,
  useFantasyLeaderboard
} from '../hooks/useFantasy';
import { FANTASY_GAME_ID } from '../config/constants';

export const FantasyGameWeekPage: React.FC<Props> = (props) => {
  const { currentUserId } = props;

  // Fetch data using hooks
  const { players, isLoading: loadingPlayers } = useFantasyPlayers();
  const { gameWeek, isLoading: loadingGameWeek } = useCurrentGameWeek(FANTASY_GAME_ID);
  const { team, saveTeam, isSaving, isLoading: loadingTeam } = useFantasyTeam(
    currentUserId,
    gameWeek?.id || null
  );
  const { boosters } = useFantasyBoosters();
  const { leaderboard } = useFantasyLeaderboard(FANTASY_GAME_ID, gameWeek?.id || null);

  // Handle loading states
  if (loadingPlayers || loadingGameWeek) {
    return <LoadingSpinner />;
  }

  if (!gameWeek) {
    return <NoGameWeekMessage />;
  }

  // Update team save handler
  const handleUpdateUserTeam = async (updatedTeam: UserFantasyTeam) => {
    const success = await saveTeam(updatedTeam);
    if (!success) {
      showToast('Failed to save team', 'error');
    }
  };

  return (
    <div>
      {/* Component content - use team instead of userTeam */}
      {team && (
        <FantasyPitch
          team={team}
          players={players}
          gameWeek={gameWeek}
          onUpdateTeam={handleUpdateUserTeam}
        />
      )}
    </div>
  );
};
```

## Available Hooks

### useFantasyPlayers()
Fetches all available Fantasy players with fatigue > 0.

```typescript
const { players, isLoading, error, refetch } = useFantasyPlayers();
```

### useCurrentGameWeek(gameId)
Fetches the current live game week for a game.

```typescript
const { gameWeek, isLoading, error, refetch } = useCurrentGameWeek(FANTASY_GAME_ID);
```

### useGameWeeks(gameId)
Fetches all game weeks for a game (past, current, upcoming).

```typescript
const { gameWeeks, isLoading, error, refetch } = useGameWeeks(FANTASY_GAME_ID);
```

### useFantasyTeam(userId, gameWeekId)
Fetches user's team for a game week. Supports save/update operations.

```typescript
const { team, saveTeam, isSaving, isLoading, error, refetch } = useFantasyTeam(
  userId,
  gameWeekId
);

// Save/update team
const success = await saveTeam({
  userId,
  gameId: FANTASY_GAME_ID,
  gameWeekId,
  starters: ['player-id-1', 'player-id-2', ...],
  substitutes: ['player-id-8', 'player-id-9'],
  captain_id: 'player-id-1',
  booster_used: 1, // 1=Double Impact, 2=Golden Game, 3=Recovery Boost
  fatigue_state: { 'player-id-1': 85.5, 'player-id-2': 92.0, ... }
});
```

### useFantasyLeaderboard(gameId, gameWeekId)
Fetches Fantasy leaderboard for a game week.

```typescript
const { leaderboard, isLoading, error, refetch } = useFantasyLeaderboard(
  FANTASY_GAME_ID,
  gameWeekId
);
```

### useFantasyBoosters()
Fetches available Fantasy boosters.

```typescript
const { boosters, isLoading, error, refetch } = useFantasyBoosters();
```

## Database Schema Reference

### fantasy_players
```sql
- id (UUID)
- api_player_id (INTEGER) - Unique player ID from API-Sports
- name, photo, position, team_name, team_logo
- status ('Star' | 'Key' | 'Wild')
- fatigue (0-100)
- pgs (Points per Game Score)
```

### fantasy_game_weeks
```sql
- id (UUID)
- fantasy_game_id (UUID)
- name, start_date, end_date
- leagues (TEXT[]) - e.g., ['LaLiga', 'Premier League']
- status ('upcoming' | 'live' | 'finished')
- conditions (JSONB) - Game week constraints
```

### user_fantasy_teams
```sql
- id (UUID)
- user_id, game_id, game_week_id
- starters (UUID[]) - 7 player IDs
- substitutes (UUID[]) - Up to 2 player IDs
- captain_id (UUID)
- booster_used (INTEGER) - 1, 2, or 3
- fatigue_state (JSONB) - { "player_id": fatigue_percentage }
- total_points (DECIMAL)
```

## PostgreSQL Functions

### get_available_fantasy_players()
Returns all players with fatigue > 0.

### calculate_fantasy_leaderboard(p_game_id, p_game_week_id)
Calculates and returns leaderboard rankings for a game week.

### check_team_composition(p_starters)
Validates team composition (1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT).

## Real-time Updates

All hooks automatically subscribe to Supabase real-time updates:

- **useFantasyPlayers** - Updates when `fantasy_players` table changes
- **useCurrentGameWeek** - Updates when `fantasy_game_weeks` table changes
- **useFantasyTeam** - Updates when `user_fantasy_teams` table changes
- **useFantasyLeaderboard** - Updates when `fantasy_leaderboard` table changes

This ensures all clients see live updates when:
- Player fatigue changes
- Game week status changes (upcoming → live → finished)
- Other users update their teams
- Leaderboard rankings update

## Migration Checklist

Use this checklist for each Fantasy component:

- [ ] Replace `useMockStore` with appropriate `useFantasy` hooks
- [ ] Add loading states (`isLoading`, `loadingPlayers`, etc.)
- [ ] Add error handling
- [ ] Update team save logic to handle async operations
- [ ] Replace mock data imports with Supabase hooks
- [ ] Test real-time updates
- [ ] Remove mock data dependencies

## Components to Migrate

### Priority 1 (Core Fantasy)
- [ ] [FantasyGameWeekPage.tsx](src/pages/FantasyGameWeekPage.tsx)
- [ ] [FantasyLeaderboardModal.tsx](src/components/FantasyLeaderboardModal.tsx)
- [ ] [FantasyPlayerModal.tsx](src/components/FantasyPlayerModal.tsx)

### Priority 2 (Live Fantasy)
- [ ] [FantasyLiveGamePage.tsx](src/pages/live-game/FantasyLiveGamePage.tsx)
- [ ] [FantasyLiveTeamSelectionPage.tsx](src/pages/live-game/FantasyLiveTeamSelectionPage.tsx)

### Priority 3 (Supporting Components)
- [ ] [FantasyPitch.tsx](src/components/fantasy/FantasyPitch.tsx)
- [ ] [FantasyPlayerCard.tsx](src/components/FantasyPlayerCard.tsx)
- [ ] [FantasyPointsPopup.tsx](src/components/FantasyPointsPopup.tsx)
- [ ] [FantasyRulesModal.tsx](src/components/FantasyRulesModal.tsx)

## Testing

After migrating a component:

1. **Test loading states**: Simulate slow network to verify loading UI
2. **Test error handling**: Disconnect from Supabase to verify error states
3. **Test team operations**: Create, update, delete teams
4. **Test real-time updates**: Open multiple browser tabs and verify updates sync
5. **Test boosters**: Verify booster selection and application
6. **Test leaderboard**: Verify rankings update correctly

## Common Issues

### Issue: Team not saving
**Solution**: Check RLS policies. Ensure user is authenticated and `auth.uid()` matches `user_id`.

### Issue: Players not loading
**Solution**: Verify `fantasy_players` table has data. Run seed migration if needed.

### Issue: Real-time updates not working
**Solution**: Check Supabase realtime is enabled for the tables in dashboard.

### Issue: TypeScript errors
**Solution**: Ensure types in [src/types/index.ts](src/types/index.ts) match database schema.

## Next Steps

After completing component migration:
1. Run Phase 7: End-to-end testing
2. Create API-Sports sync Edge Function (Phase 6)
3. Clean up mock data files (Phase 8)
