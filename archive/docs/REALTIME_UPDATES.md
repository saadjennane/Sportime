# Real-time Balance & XP Updates

## Overview

The application now supports real-time updates for user balances and XP. When rewards are distributed (coins, XP, tickets, etc.), the changes are immediately reflected in the UI without requiring manual refresh.

## How It Works

### 1. Database Layer

**Migration:** `supabase/migrations/20251113000007_enable_realtime_updates.sql`

The `users` table is added to the Supabase realtime publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
```

This enables the database to broadcast changes to subscribed clients whenever user records are updated.

### 2. AuthContext Real-time Subscription

**File:** [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx:76-101)

The AuthContext subscribes to changes on the `users` table for the current user:

```typescript
const channel = supabase
  .channel(`user_profile_${user.id}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `id=eq.${user.id}`,
    },
    (payload) => {
      console.log('[AuthContext] Real-time profile update received:', payload)
      if (payload.new) {
        setProfile(prev => prev ? { ...prev, ...payload.new } as Profile : null)
      }
    }
  )
  .subscribe()
```

When the user's row in the `users` table is updated (e.g., coins_balance, total_xp), the callback receives the new data and updates the profile state.

### 3. UI Components

Components automatically react to profile state changes:

- **Header** ([src/components/Header.tsx:48](src/components/Header.tsx#L48)): Displays `profile.coins_balance` which updates in real-time
- **XPProgressBar** ([src/components/progression/XPProgressBar.tsx](src/components/progression/XPProgressBar.tsx)): Uses `useProgression` hook which also has real-time subscriptions
- **ProfilePage**: All profile data updates automatically

### 4. Progression Hook

**File:** [src/hooks/useProgression.ts:102-126](src/hooks/useProgression.ts#L102-L126)

The `useProgression` hook has its own real-time subscription that refetches progression data when the users table changes:

```typescript
useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel(`user-progression-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        console.log('[useProgression] User updated, refetching...');
        fetchProgression();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId, fetchProgression]);
```

## What Updates in Real-time

When any of these fields change in the `users` table, the UI updates immediately:

- `coins_balance` - User's coin balance
- `total_xp` - Total XP earned
- `level` - Current level name
- `is_premium` - Premium status
- `premium_expires_at` - Premium expiration
- Any other profile fields

## Reward Distribution Flow

1. User earns a reward (e.g., wins a challenge, completes an activity)
2. Backend function updates the `users` table (e.g., `UPDATE users SET coins_balance = coins_balance + 100 WHERE id = '...'`)
3. Supabase broadcasts the change via realtime
4. AuthContext subscription receives the update
5. Profile state is updated with new values
6. React components re-render with new data
7. User sees updated balance instantly

## Testing Real-time Updates

To test real-time updates:

1. Open the app in two browser windows/tabs with the same user
2. In one window, trigger a reward (e.g., win a challenge, use admin panel to add coins)
3. Watch the balance update in the other window without refresh

## Performance Considerations

- **Efficient Updates**: Only the changed fields are broadcast, not the entire profile
- **Filtered Subscriptions**: Each subscription filters by user ID, so users only receive their own updates
- **Channel Cleanup**: Channels are properly removed when components unmount to prevent memory leaks
- **Minimal Re-renders**: Profile state is only updated when actual changes occur

## Debugging

Console logs help track real-time updates:

```
[AuthContext] Real-time profile update received: { old: {...}, new: {...} }
[useProgression] User updated, refetching...
```

These logs show when updates are received and processed.

## Future Enhancements

Potential improvements:

- Add optimistic updates for instant UI feedback before server confirmation
- Implement exponential backoff for reconnection on network errors
- Add real-time notifications for other users' activities (squad members, league updates)
- Consider using presence for online/offline status
