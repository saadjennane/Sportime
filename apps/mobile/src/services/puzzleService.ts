import { supabase } from './supabase';

export type PuzzleLevel = 'easy' | 'medium' | 'hard';
export interface PuzzleRound {
  round_no: number;
  home_name: string; home_logo?: string;
  away_name: string; away_logo?: string;
  season: number; competition: string; stage?: string; match_date?: string;
  hints: string[];
  attempt?: { guesses: { h: number; a: number; heat: string }[]; solved: boolean; attempts: number };
  reveal?: { home: number; away: number } | null;
}
export interface PuzzleToday {
  ok: boolean; level: PuzzleLevel; date: string;
  config?: { max_attempts: number; heat_bands: any; rounds: number };
  play?: { id: string; started_at: string; finished_at: string | null; rounds_solved: number; score: number };
  game?: { id: string; difficulty: number } | null;
  rounds?: PuzzleRound[];
}

export async function getPuzzleToday(level?: PuzzleLevel): Promise<PuzzleToday> {
  const { data } = await supabase.rpc('puzzle_get_today', { p_level: level ?? null });
  return (data ?? { ok: false }) as PuzzleToday;
}
export async function setPuzzleLevel(level: PuzzleLevel) {
  const { data } = await supabase.rpc('puzzle_set_level', { p_level: level });
  return data;
}
export async function puzzleGuess(gameId: string, roundNo: number, home: number, away: number) {
  const { data, error } = await supabase.rpc('puzzle_guess', { p_game_id: gameId, p_round_no: roundNo, p_home: home, p_away: away });
  if (error) return { ok: false, error: error.message };
  return data as any;
}
export async function puzzleFinish(gameId: string) {
  const { data } = await supabase.rpc('puzzle_finish', { p_game_id: gameId });
  return data as any;
}
export async function getPuzzleStats(level?: PuzzleLevel) {
  const { data } = await supabase.rpc('puzzle_my_stats', { p_level: level ?? null });
  return data as any;
}
