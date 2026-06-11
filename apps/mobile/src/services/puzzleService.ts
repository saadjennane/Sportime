import { supabase } from './supabase';

export type PuzzleHint = 'easy' | 'medium' | 'hard';
export type PuzzleScope = 'big' | 'all';
export interface PuzzleRound {
  round_no: number;
  home_name: string; home_logo?: string;
  away_name: string; away_logo?: string;
  season: number; competition: string; stage?: string; match_date?: string;
  hints: string[];
  attempt?: { guesses: { h: number; a: number; heat?: string; fb?: any }[]; solved: boolean; attempts: number };
  reveal?: { home: number; away: number } | null;
}
export interface PuzzleToday {
  ok: boolean; scope: PuzzleScope; hint: PuzzleHint; has_prefs: boolean; date: string;
  config?: { max_attempts: number; heat_bands: any; rounds: number };
  play?: { id: string; started_at: string; finished_at: string | null; rounds_solved: number; score: number };
  game?: { id: string; difficulty: number } | null;
  rounds?: PuzzleRound[];
}

export async function getPuzzleToday(scope?: PuzzleScope): Promise<PuzzleToday> {
  const { data } = await supabase.rpc('puzzle_get_today', { p_level: scope ?? null });
  return (data ?? { ok: false }) as PuzzleToday;
}
export async function setPuzzlePrefs(scope: PuzzleScope, hint: PuzzleHint, gameType: string = 'guess_score') {
  const { data } = await supabase.rpc('puzzle_set_prefs', { p_scope: scope, p_hint: hint, p_game_type: gameType });
  return data;
}
export async function puzzleStart(gameId: string) {
  const { data } = await supabase.rpc('puzzle_start', { p_game_id: gameId });
  return data as any;
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
// ── Guess the Player ─────────────────────────────────────────────────────────
export interface PlayerRound {
  round_no: number;
  trail: { name: string; id: number }[];
  trail_total: number;
  hints: { k: string; v: string }[];
  answer: { id: number; name: string; photo?: string };   // sent to the client; validated locally
  attempt?: { guesses: { pid: number; name: string; correct: boolean }[]; solved: boolean; attempts: number };
  reveal?: { name: string; photo?: string } | null;
}
export interface PlayerToday {
  ok: boolean; scope: PuzzleScope; hint: PuzzleHint; has_prefs: boolean; date: string;
  config?: { max_attempts: number; rounds: number; freeze_every_days?: number; max_freezes?: number };
  play?: { id: string; started_at: string; finished_at: string | null; rounds_solved: number; score: number };
  game?: { id: string } | null;
  dist?: number[];                                                  // other players' scores today (for local percentile)
  progress?: { streak: number; freezes: number; last_played: string | null };
  rounds?: PlayerRound[];
}
let ptCache: { key: string; data: PlayerToday; ts: number } | null = null;
let ptInflight: { key: string; p: Promise<PlayerToday> } | null = null;
export async function finishPlayer(gameId: string, roundsSolved: number, timeMs: number) {
  ptCache = null;   // result changes after finishing
  const { data } = await supabase.rpc('puzzle_finish_player', { p_game_id: gameId, p_rounds_solved: roundsSolved, p_time_ms: timeMs });
  return data as any;
}
export function prefetchPlayerToday(scope?: PuzzleScope) { getPlayerToday(scope).catch(() => {}); }
export async function getPlayerToday(scope?: PuzzleScope): Promise<PlayerToday> {
  const key = scope ?? '';
  if (ptCache && ptCache.key === key && Date.now() - ptCache.ts < 20000) return ptCache.data;
  if (ptInflight && ptInflight.key === key) return ptInflight.p;   // dedupe concurrent (prefetch + open)
  const p = (async () => {
    const { data } = await supabase.rpc('puzzle_get_today_player', { p_scope: scope ?? null });
    const d = (data ?? { ok: false }) as PlayerToday;
    if (d.ok) ptCache = { key, data: d, ts: Date.now() };
    ptInflight = null;
    return d;
  })();
  ptInflight = { key, p };
  return p;
}
export async function guessPlayer(gameId: string, roundNo: number, playerId: number) {
  const { data, error } = await supabase.rpc('puzzle_guess_player', { p_game_id: gameId, p_round_no: roundNo, p_player_id: playerId });
  if (error) return { ok: false, error: error.message };
  return data as any;
}
export async function giveupPlayer(gameId: string, roundNo: number) {
  const { data } = await supabase.rpc('puzzle_giveup_player', { p_game_id: gameId, p_round_no: roundNo });
  return data as any;
}
export async function revealLetters(gameId: string, roundNo: number, n: number) {
  const { data } = await supabase.rpc('puzzle_reveal_letters', { p_game_id: gameId, p_round_no: roundNo, p_n: n });
  return data as any;
}

export async function getPuzzleStats(scope?: PuzzleScope, gameType: string = 'guess_score') {
  const { data } = await supabase.rpc('puzzle_my_stats', { p_scope: scope ?? null, p_game_type: gameType });
  return data as any;
}
