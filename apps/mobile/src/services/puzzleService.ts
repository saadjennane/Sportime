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
  ptCache = null; luCache = null; cnCache = null; gdCache = null;   // result changes after finishing (shared generic finish)
  for (let i = 0; i < 3; i++) {   // retry so a weak network still records finished_at server-side
    try {
      const { data, error } = await supabase.rpc('puzzle_finish_player', { p_game_id: gameId, p_rounds_solved: roundsSolved, p_time_ms: timeMs });
      if (!error && data) return data as any;
    } catch { /* network — retry */ }
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
  }
  return { ok: false };
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

// ---- Guess the Lineup ------------------------------------------------------
export interface LineupHole { grid: string; answer: { id: number; name: string; number?: number; position?: string; photo?: string; nationality?: string | null; goal?: boolean; assist?: boolean } }
export interface LineupStarter { id: number; name: string; number?: number; pos?: string; grid: string; photo?: string; goal?: boolean; assist?: boolean }
export interface LineupRoundPayload {
  team: { id: number; name: string; logo?: string }; opponent: { id: number; name: string; logo?: string };
  competition?: string; date: string; score: { team: number; opp: number }; formation: string;
  starters: LineupStarter[]; holes: LineupHole[];
}
export interface LineupRound { round_no: number; payload: LineupRoundPayload }
export interface LineupToday {
  ok: boolean; scope: PuzzleScope; holes: number; has_prefs: boolean; date: string;
  config?: { rounds: number };
  play?: { id: string; finished_at: string | null; rounds_solved: number; score: number };
  game?: { id: string } | null;
  dist?: number[]; progress?: { streak: number; freezes: number; last_played: string | null };
  rounds?: LineupRound[];
}
let luCache: { key: string; data: LineupToday; ts: number } | null = null;
let luInflight: { key: string; p: Promise<LineupToday> } | null = null;
export function invalidateLineupToday() { luCache = null; }
export function prefetchLineupToday() { getLineupToday().catch(() => {}); }
export async function getLineupToday(scope?: PuzzleScope, holes?: number): Promise<LineupToday> {
  const key = `${scope ?? ''}_${holes ?? ''}`;
  if (luCache && luCache.key === key && Date.now() - luCache.ts < 20000) return luCache.data;
  if (luInflight && luInflight.key === key) return luInflight.p;
  const p = (async () => {
    try {
      const { data } = await supabase.rpc('puzzle_get_today_lineup', { p_scope: scope ?? null, p_holes: holes ?? null });
      const d = (data ?? { ok: false }) as LineupToday;
      if (d.ok) luCache = { key, data: d, ts: Date.now() };
      return d;
    } catch { return { ok: false } as LineupToday; }
    finally { luInflight = null; }
  })();
  luInflight = { key, p };
  return p;
}

// ---- Football Connections ---------------------------------------------------
export interface ConnGroup { key: string; label: string; color: string; playerIds: number[] }
export interface ConnPayload { players: { id: number; name: string; photo?: string }[]; groups: ConnGroup[] }
export interface ConnectionsToday {
  ok: boolean; date: string;
  play?: { id: string; finished_at: string | null; rounds_solved: number; score: number };
  game?: { id: string } | null;
  dist?: number[]; progress?: { streak: number; freezes: number; last_played: string | null };
  payload?: ConnPayload;
}
let cnCache: { data: ConnectionsToday; ts: number } | null = null;
let cnInflight: Promise<ConnectionsToday> | null = null;
export async function replayGame(gameId: string) {
  cnCache = null; ptCache = null; luCache = null; gdCache = null;
  await supabase.rpc('puzzle_replay', { p_game_id: gameId });
}
export function prefetchConnectionsToday() { getConnectionsToday().catch(() => {}); }

// ---- Box2Box grid -----------------------------------------------------------
export interface GridToday {
  ok: boolean; date: string;
  play?: { id: string; finished_at: string | null; rounds_solved: number; score: number };
  game?: { id: string } | null;
  dist?: number[]; progress?: { streak: number; freezes: number; last_played: string | null };
  payload?: { rows: { type: string; value: any; label: string }[]; cols: { type: string; value: any; label: string }[] };
}
let gdCache: { data: GridToday; ts: number } | null = null;
let gdInflight: Promise<GridToday> | null = null;
export function prefetchGridToday() { getGridToday().catch(() => {}); }
export async function getGridToday(): Promise<GridToday> {
  if (gdCache && Date.now() - gdCache.ts < 20000) return gdCache.data;
  if (gdInflight) return gdInflight;
  gdInflight = (async () => {
    try {
      const { data } = await supabase.rpc('puzzle_get_today_grid');
      const d = (data ?? { ok: false }) as GridToday;
      if (d.ok) gdCache = { data: d, ts: Date.now() };
      return d;
    } catch { return { ok: false } as GridToday; }
    finally { gdInflight = null; }
  })();
  return gdInflight;
}
export async function getConnectionsToday(): Promise<ConnectionsToday> {
  if (cnCache && Date.now() - cnCache.ts < 20000) return cnCache.data;
  if (cnInflight) return cnInflight;
  cnInflight = (async () => {
    try {
      const { data } = await supabase.rpc('puzzle_get_today_connections');
      const d = (data ?? { ok: false }) as ConnectionsToday;
      if (d.ok) cnCache = { data: d, ts: Date.now() };
      return d;
    } catch { return { ok: false } as ConnectionsToday; }
    finally { cnInflight = null; }
  })();
  return cnInflight;
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
