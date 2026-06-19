/**
 * Odds Sync Service
 *
 * Automatically detects fixtures without odds and triggers a sync from the API.
 * Uses a cooldown to prevent excessive API calls.
 */

import { supabase } from '../lib/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SYNC_ODDS_COOLDOWN = 60000; // 1 minute between syncs per league
const lastSyncByLeague: Record<number, number> = {};

/**
 * Triggers an odds sync for a given league
 * Uses a cooldown to prevent excessive API calls
 */
export async function triggerOddsSync(leagueApiId: number): Promise<boolean> {
  const now = Date.now();
  const lastSync = lastSyncByLeague[leagueApiId] || 0;

  // Cooldown check
  if (now - lastSync < SYNC_ODDS_COOLDOWN) {
    console.log(`[oddsSyncService] Sync cooldown active for league ${leagueApiId}`);
    return false;
  }

  lastSyncByLeague[leagueApiId] = now;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      console.warn('[oddsSyncService] No auth token available, skipping sync');
      return false;
    }

    console.log(`[oddsSyncService] Triggering sync for league ${leagueApiId}...`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-odds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ league_id: leagueApiId }),
    });

    if (!response.ok) {
      console.error('[oddsSyncService] Sync failed:', await response.text());
      return false;
    }

    const result = await response.json();
    console.log('[oddsSyncService] Sync completed:', result);
    return result.success && result.synced > 0;
  } catch (err) {
    console.error('[oddsSyncService] Error triggering sync:', err);
    return false;
  }
}

export interface FixtureForOddsCheck {
  id: string;
  league_id?: string;
  odds?: unknown[];
}

/**
 * Detects fixtures without odds and triggers sync if needed
 * Returns true if a sync was triggered
 */
export async function detectAndSyncMissingOdds(
  fixtures: FixtureForOddsCheck[]
): Promise<boolean> {
  // Find fixtures without odds
  const fixturesWithoutOdds = fixtures.filter(f =>
    !f.odds || f.odds.length === 0
  );

  if (fixturesWithoutOdds.length === 0) {
    return false;
  }

  console.log(`[oddsSyncService] ${fixturesWithoutOdds.length} fixtures without odds detected`);

  // Get unique league UUIDs
  const leagueUuids = new Set<string>();
  for (const fixture of fixturesWithoutOdds) {
    if (fixture.league_id) {
      leagueUuids.add(fixture.league_id);
    }
  }

  if (leagueUuids.size === 0) {
    console.warn('[oddsSyncService] No league IDs found on fixtures');
    return false;
  }

  // Fetch api_ids for each league UUID
  const leagueApiIds = new Set<number>();
  for (const leagueUuid of leagueUuids) {
    try {
      const { data } = await supabase
        .from('fb_leagues')
        .select('api_id')
        .eq('id', leagueUuid)
        .single();

      if (data?.api_id) {
        leagueApiIds.add(data.api_id);
      }
    } catch (err) {
      console.error(`[oddsSyncService] Error fetching league api_id for ${leagueUuid}:`, err);
    }
  }

  if (leagueApiIds.size === 0) {
    console.warn('[oddsSyncService] No league API IDs found');
    return false;
  }

  // Trigger sync for each league
  let syncTriggered = false;
  for (const leagueApiId of leagueApiIds) {
    const triggered = await triggerOddsSync(leagueApiId);
    if (triggered) syncTriggered = true;
  }

  return syncTriggered;
}

/**
 * Check if any matches have default/missing odds
 * Default odds from swipeMappers: { home: 1.5, draw: 3.5, away: 2.5 }
 */
export function hasMatchesWithMissingOdds(
  matches: Array<{ odds: { teamA: number; draw: number; teamB: number } }>
): boolean {
  // Real odds are always > 1.0; anything <= 1 (incl. the 0 sentinel) means odds aren't ready.
  return matches.some(m => m.odds.teamA <= 1 || m.odds.draw <= 1 || m.odds.teamB <= 1);
}
