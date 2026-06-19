import { supabase } from './supabase';

// Read-only Results + leaderboard for the 3 live games (FOMO: visible to everyone).
// Crowd stats are computed & cached server-side on first read after the game is over.

export type GameType = 'live_prediction' | 'match_royale' | 'live_fantasy';

export interface ResultsIndexEntry {
  game_type: GameType;
  status: string;
  players: number;
  winners?: number;
}

export interface GameResults {
  game_type: GameType;
  game_id: string;
  status: string;
  crowd_stats: any;
  i_played: boolean;
  leaderboard: any[];
}

/** Which live games ran on this fixture (+ teaser counts) for the chooser modal. */
export async function getResultsIndex(fixtureId: string): Promise<ResultsIndexEntry[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc('live_results_index', { p_fixture_id: fixtureId });
  const games = (data as any)?.games ?? {};
  return Object.values(games).filter(Boolean) as ResultsIndexEntry[];
}

const fetchResults = (rpc: string) => async (fixtureId: string): Promise<GameResults | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(rpc, { p_fixture_id: fixtureId });
  if (error || !data) return null;
  return data as GameResults;
};

export const getLpResults = fetchResults('lp_results');
export const getMrResults = fetchResults('mr_results');
export const getLfResults = fetchResults('lf_results');

export function getResults(gameType: GameType, fixtureId: string): Promise<GameResults | null> {
  if (gameType === 'live_prediction') return getLpResults(fixtureId);
  if (gameType === 'match_royale') return getMrResults(fixtureId);
  return getLfResults(fixtureId);
}
