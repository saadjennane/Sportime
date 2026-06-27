import { supabase } from './supabase';

// F1 games create already-playable (status 'open', defaults baked in). These helpers
// wrap the existing RPCs used by the F1 admin tabs so the Quick Game Builder can reuse them.

export interface F1Race { id: number; name: string; round: number | null; race_at: string; }

/** Upcoming, non-cancelled GPs (the pool a game can be built on). */
export async function listUpcomingRaces(): Promise<F1Race[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('f1_races')
    .select('id,name,round,race_at')
    .neq('status', 'Cancelled')
    .gt('race_at', new Date().toISOString())
    .order('race_at');
  return (data ?? []) as F1Race[];
}

// Defaults mirror the SQL creation defaults so set_config is a safe no-op on scoring/rewards.
export const DEFAULT_PRED_SCORING = { pole: 10, winner: 15, top5_exact: 10, top5_partial: 4, fastest_lap: 8, first_dnf: 8, sprint: 10 };
export const DEFAULT_PRED_REWARDS = [{ upto: 1, coins: 1000 }, { upto: 3, coins: 500 }, { upto: 10, coins: 150 }];
export const DEFAULT_DUEL_REWARDS = { '0': 800, '1': 400, '2': 150, '3': 50 };

// GP Predictor (multi-race)
export async function createPredGame(name: string, raceIds: number[]) {
  return supabase!.rpc('f1_pred_create_game', { p_name: name, p_race_ids: raceIds });
}
export async function setPredConfig(id: string, p: { scoring: any; rewards: any; entry_cost: number; is_active: boolean }) {
  return supabase!.rpc('f1_pred_set_config', { p_game_id: id, p_scoring: p.scoring, p_rewards: p.rewards, p_entry_cost: p.entry_cost, p_is_active: p.is_active });
}

// Season Forecast
export async function createSeason(name: string, season: number, lockAt: string | null) {
  return supabase!.rpc('f1_pred_create_season', { p_name: name, p_season: season, p_lock_at: lockAt });
}

// Teammates Duels (single race)
export async function createDuel(raceId: number) {
  return supabase!.rpc('f1_duel_create_game', { p_race_id: raceId });
}
export async function setDuelConfig(id: string, p: { rewards: any; entry_cost: number; is_active: boolean; upset_bonus: number }) {
  return supabase!.rpc('f1_duel_set_config', { p_game_id: id, p_rewards: p.rewards, p_entry_cost: p.entry_cost, p_is_active: p.is_active, p_upset_bonus: p.upset_bonus });
}

// Fantasy F1 (single race + condition)
export async function createFantasy(raceId: number, condition: string) {
  return supabase!.rpc('f1_fantasy_create_game', { p_race_id: raceId, p_condition: condition });
}
